"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import type { SpeakScenarioId } from "@/config/scenarios";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  LiveClientError,
  sendLiveActivitySignal,
  sendLiveAudioChunk,
  startLiveSession,
  stopLiveSession,
} from "@/lib/live-client";
import {
  DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE,
  liveRelayEventSchema,
  type LiveConnectionStatus,
  type LiveCorrection,
  type LiveTurnMode,
} from "@/schemas/live";
import { ScenarioPicker } from "./scenario-picker";
import {
  clearTranscriptForResume,
  loadTranscriptForResume,
  saveReview,
  saveTranscriptForResume,
  type TranscriptItem,
} from "./transcript-store";
import {
  bytesToBase64,
  createAudioBufferFromPcm16,
  downsampleTo16kHz,
  getAudioContextConstructor,
  int16ToLittleEndianBytes,
  mergeChunks,
} from "./voice-audio";

type VoiceUiStatus =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "reconnecting"
  | "ended"
  | "failed";

// Live prefers small audio chunks. Over HTTP POST, 100ms is a pragmatic
// compromise until the relay moves to a lower-overhead streaming transport.
const LIVE_AUDIO_FLUSH_INTERVAL_MS = 100;
const MAX_PENDING_AUDIO_BYTES = 16000 * 2 * 8;
const AUDIO_SEND_RMS_THRESHOLD = 0.003;
const AUDIO_SILENCE_TAIL_MS = 1600;
const SILENT_AUDIO_THRESHOLD = 0.01;
const SILENT_AUDIO_HINT_AFTER_MS = 7000;
const SSE_RECONNECT_GRACE_MS = 45000;
const SSE_RECONNECT_SLOW_MS = 18000;
const AUDIO_SEND_MAX_RETRIES = 3;
const AUDIO_SEND_RETRY_BASE_MS = 500;
const JITTER_BUFFER_MIN_CHUNKS = 2;
const JITTER_BUFFER_FLUSH_TIMEOUT_MS = 150;
const SPEAKING_TIMER_GRACE_MS = 2200;
const ASSISTANT_TURN_COMPLETE_GRACE_MS = 900;
const MIC_WORKLET_URL = "/worklets/lisane-mic-processor.js";
const MIC_WORKLET_NAME = "lisane-mic-processor";

const VOICE_DEBUG_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VOICE_DEBUG === "true";

function debugVoice(event: string, payload?: Record<string, unknown>) {
  if (!VOICE_DEBUG_ENABLED) return;
  console.debug("[lisane-voice]", event, payload ?? {});
}

const scenarioLabel = {
  self_introduction: "selfIntroduction",
  job_interview: "jobInterview",
  workplace: "workplace",
  university: "university",
} as const;

const statusLabelKey = {
  idle: "statusIdle",
  requesting_microphone: "statusRequestingMicrophone",
  connecting: "statusConnecting",
  connected: "statusConnected",
  listening: "statusListening",
  speaking: "statusSpeaking",
  reconnecting: "statusReconnecting",
  ended: "statusEnded",
  failed: "statusFailed",
} as const;

const correctionTypeKey = {
  GRAMMAR: "typeGrammar",
  VOCABULARY: "typeVocabulary",
  PHRASING: "typePhrasing",
} as const;

function VoiceSession() {
  const t = useTranslations("Speak");
  const [scenario, setScenario] = useState<SpeakScenarioId | null>(null);
  const [customIdea, setCustomIdea] = useState("");
  const [situation, setSituation] = useState("");
  const [status, setStatus] = useState<"IDLE" | LiveConnectionStatus>("IDLE");
  const [voiceStatus, setVoiceStatus] = useState<VoiceUiStatus>("idle");
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [turnMode, setTurnMode] = useState<LiveTurnMode>("auto");
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [isSendingActivity, setIsSendingActivity] = useState(false);
  const [isMicReady, setIsMicReady] = useState(false);
  const [isManualActivityOpen, setIsManualActivityOpen] = useState(false);
  const [hasSpokenThisManualTurn, setHasSpokenThisManualTurn] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisoryHint, setAdvisoryHint] = useState<string | null>(null);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [latestCorrection, setLatestCorrection] = useState<LiveCorrection | null>(null);

  const liveSessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<"IDLE" | LiveConnectionStatus>("IDLE");
  const voiceStatusRef = useRef<VoiceUiStatus>("idle");
  const situationRef = useRef("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sinkGainRef = useRef<GainNode | null>(null);
  const playbackNodesRef = useRef(new Set<AudioBufferSourceNode>());
  const flushTimerRef = useRef<number | null>(null);
  const sseReconnectFailTimerRef = useRef<number | null>(null);
  const sseHintTimerRef = useRef<number | null>(null);
  const pendingAudioChunksRef = useRef<Uint8Array[]>([]);
  const audioSendInFlightRef = useRef(false);
  const audioFlushRequestedRef = useRef(false);
  const audioStreamEndRequestedRef = useRef(false);
  const playbackCursorRef = useRef(0);
  const speakingTimerRef = useRef<number | null>(null);
  const isAssistantSpeakingRef = useRef(false);
  const lastAudibleAtRef = useRef(0);
  const lastForwardedSpeechAtRef = useRef(0);
  const speechStreamOpenRef = useRef(false);
  const silentHintShownRef = useRef(false);
  const seenCorrectionIdsRef = useRef(new Set<string>());
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const turnModeRef = useRef<LiveTurnMode>("auto");
  const manualActivityOpenRef = useRef(false);
  const hasSpokenThisManualTurnRef = useRef(false);
  const isSendingActivityRef = useRef(false);
  const activityRetryAttemptedRef = useRef(false);
  const audioJitterQueueRef = useRef<{ data: string; mimeType: string }[]>([]);
  const jitterBufferTimerRef = useRef<number | null>(null);
  const jitterBufferReadyRef = useRef(false);
  const audioSendRetriesRef = useRef(0);
  const audioRetryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    turnModeRef.current = turnMode;
  }, [turnMode]);

  useEffect(() => {
    transcriptRef.current = transcript;
    const el = transcriptScrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, [transcript]);

  function updateConnectionStatus(next: "IDLE" | LiveConnectionStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function updateVoiceStatus(next: VoiceUiStatus) {
    voiceStatusRef.current = next;
    setVoiceStatus(next);
  }

  function updateAssistantSpeaking(next: boolean) {
    isAssistantSpeakingRef.current = next;
    setIsAssistantSpeaking(next);
  }

  function updateSendingActivity(next: boolean) {
    isSendingActivityRef.current = next;
    setIsSendingActivity(next);
  }

  function closeEventStream() {
    debugVoice("sse.close_requested");
    clearSseReconnectFailTimer();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }

  function clearSseReconnectFailTimer() {
    if (sseReconnectFailTimerRef.current) {
      window.clearTimeout(sseReconnectFailTimerRef.current);
      sseReconnectFailTimerRef.current = null;
    }
  }

  function clearSseHintTimer() {
    if (sseHintTimerRef.current) {
      window.clearTimeout(sseHintTimerRef.current);
      sseHintTimerRef.current = null;
    }
  }

  function getStatusReasonMessage(reason?: string) {
    if (reason === "session_timeout" || reason === "session_idle_timeout") {
      return t("errorTimedOut");
    }
    if (reason === "resumption_unavailable" || reason === "reconnect_failed" || reason === "connection_closed") {
      return t("errorReconnectFailed");
    }
    return t("errorUnavailable");
  }

  function keepConversation() {
    const items = transcriptRef.current;
    if (items.length === 0) return;
    saveReview({ situation: situationRef.current || t("freeTalk"), items });
  }

  function setManualActivityOpen(value: boolean) {
    manualActivityOpenRef.current = value;
    setIsManualActivityOpen(value);
  }

  function setManualTurnSpeechDetected(value: boolean) {
    hasSpokenThisManualTurnRef.current = value;
    setHasSpokenThisManualTurn(value);
  }

  function canSendManualActivity(type: "start" | "end") {
    const currentSessionId = liveSessionIdRef.current;
    if (!currentSessionId || turnModeRef.current !== "manual") return false;

    if (
      statusRef.current !== "ACTIVE" ||
      voiceStatusRef.current === "failed" ||
      voiceStatusRef.current === "ended" ||
      voiceStatusRef.current === "reconnecting" ||
      !mediaStreamRef.current ||
      isSendingActivityRef.current
    ) {
      return false;
    }

    if (type === "start" && manualActivityOpenRef.current) return false;
    if (type === "end" && !manualActivityOpenRef.current) return false;
    return true;
  }

  async function sendManualActivity(type: "start" | "end") {
    const currentSessionId = liveSessionIdRef.current;
    if (!canSendManualActivity(type) || !currentSessionId) {
      debugVoice("activity.signal_skipped", {
        sessionId: currentSessionId,
        type,
        status: statusRef.current,
        voiceStatus: voiceStatusRef.current,
      });
      return;
    }

    try {
      updateSendingActivity(true);
      debugVoice(type === "start" ? "activity.start_send" : "activity.end_send", { sessionId: currentSessionId });
      await sendLiveActivitySignal({ liveSessionId: currentSessionId, type });
      setManualActivityOpen(type === "start");
      if (type === "start") setManualTurnSpeechDetected(false);
      if (type === "start" && statusRef.current === "ACTIVE") updateVoiceStatus("listening");
    } catch (activityError) {
      debugVoice("activity.signal_failed", {
        sessionId: currentSessionId,
        type,
        status: activityError instanceof LiveClientError ? activityError.status : null,
      });

      // 409 means the session is gone. Any other failure is retried once so a
      // long-answer learner is not stuck on a single blip.
      const isGone = activityError instanceof LiveClientError && activityError.status === 409;

      if (!isGone && !activityRetryAttemptedRef.current) {
        activityRetryAttemptedRef.current = true;
        window.setTimeout(() => {
          activityRetryAttemptedRef.current = false;
          void sendManualActivity(type);
        }, 1500);
        return;
      }

      activityRetryAttemptedRef.current = false;
      setManualActivityOpen(false);
      setError(isGone ? t("errorNeedsRestart") : t("errorUnavailable"));
      saveTranscriptForResume(transcriptRef.current);
      keepConversation();
      updateConnectionStatus("ERROR");
      updateVoiceStatus("failed");
      closeEventStream();
      liveSessionIdRef.current = null;
      setLiveSessionId(null);
      await releaseAudioResources();
    } finally {
      updateSendingActivity(false);
    }
  }

  async function handleManualDoneSpeaking() {
    if (!canSendManualActivity("end")) return;

    try {
      setIsEndingTurn(true);
      await flushAudioChunk(false);
      await sendManualActivity("end");
      updateVoiceStatus("connected");
    } finally {
      setIsEndingTurn(false);
    }
  }

  async function flushAudioChunk(audioStreamEnd = false) {
    const currentSessionId = liveSessionIdRef.current;
    if (!currentSessionId) {
      pendingAudioChunksRef.current = [];
      return;
    }

    // A failed piece waits for its backoff; the regular flush must not resend it early.
    if (!audioStreamEnd && audioRetryTimerRef.current !== null) return;

    if (audioSendInFlightRef.current) {
      if (audioStreamEnd) {
        audioStreamEndRequestedRef.current = true;
      } else {
        audioFlushRequestedRef.current = true;
      }
      return;
    }

    if (!audioStreamEnd && statusRef.current !== "ACTIVE") {
      if (statusRef.current === "ERROR" || statusRef.current === "ENDED") {
        pendingAudioChunksRef.current = [];
      }
      return;
    }

    const queued = pendingAudioChunksRef.current;
    pendingAudioChunksRef.current = [];

    if (!audioStreamEnd && queued.length === 0) return;

    const merged = queued.length > 0 ? mergeChunks(queued) : new Uint8Array();

    try {
      audioSendInFlightRef.current = true;
      debugVoice("audio.chunk_send", { sessionId: currentSessionId, bytes: merged.length, streamEnd: audioStreamEnd });

      await sendLiveAudioChunk({
        liveSessionId: currentSessionId,
        audioBase64: merged.length > 0 ? bytesToBase64(merged) : undefined,
        audioMimeType: DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE,
        audioStreamEnd,
      });

      audioSendRetriesRef.current = 0;
    } catch {
      audioSendRetriesRef.current += 1;
      debugVoice("audio.chunk_send_failed", {
        sessionId: currentSessionId,
        streamEnd: audioStreamEnd,
        attempt: audioSendRetriesRef.current,
      });

      if (audioSendRetriesRef.current <= AUDIO_SEND_MAX_RETRIES) {
        if (merged.length > 0) {
          pendingAudioChunksRef.current = [merged, ...pendingAudioChunksRef.current];
        }
        const delay = AUDIO_SEND_RETRY_BASE_MS * 2 ** (audioSendRetriesRef.current - 1);
        if (audioRetryTimerRef.current !== null) window.clearTimeout(audioRetryTimerRef.current);
        audioRetryTimerRef.current = window.setTimeout(() => {
          audioRetryTimerRef.current = null;
          void flushAudioChunk(audioStreamEnd);
        }, delay);
      } else if (!audioStreamEnd) {
        audioSendRetriesRef.current = 0;
        setError(t("errorReconnectFailed"));
        saveTranscriptForResume(transcriptRef.current);
        keepConversation();
        updateConnectionStatus("ERROR");
        updateVoiceStatus("failed");
        closeEventStream();
        liveSessionIdRef.current = null;
        setLiveSessionId(null);
        void stopLiveSession(currentSessionId).catch(() => undefined);
        void releaseAudioResources();
      }
    } finally {
      audioSendInFlightRef.current = false;

      if (audioStreamEndRequestedRef.current) {
        audioStreamEndRequestedRef.current = false;
        void flushAudioChunk(true);
      } else if (audioFlushRequestedRef.current && pendingAudioChunksRef.current.length > 0) {
        audioFlushRequestedRef.current = false;
        void flushAudioChunk(false);
      } else {
        audioFlushRequestedRef.current = false;
      }
    }
  }

  function startFlushLoop() {
    if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
    flushTimerRef.current = window.setInterval(() => {
      void flushAudioChunk(false);
    }, LIVE_AUDIO_FLUSH_INTERVAL_MS);
  }

  function stopFlushLoop() {
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }

  async function releaseAudioResources() {
    playbackCursorRef.current = 0;
    debugVoice("audio.release_resources");
    stopFlushLoop();
    if (audioRetryTimerRef.current !== null) {
      window.clearTimeout(audioRetryTimerRef.current);
      audioRetryTimerRef.current = null;
    }
    audioSendRetriesRef.current = 0;
    pendingAudioChunksRef.current = [];
    audioFlushRequestedRef.current = false;
    audioStreamEndRequestedRef.current = false;
    audioSendInFlightRef.current = false;
    setManualActivityOpen(false);
    setManualTurnSpeechDetected(false);
    setIsMicReady(false);
    clearSseReconnectFailTimer();
    clearSseHintTimer();
    setAdvisoryHint(null);

    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }

    updateAssistantSpeaking(false);
    silentHintShownRef.current = false;
    lastAudibleAtRef.current = 0;
    lastForwardedSpeechAtRef.current = 0;
    speechStreamOpenRef.current = false;

    audioJitterQueueRef.current = [];
    jitterBufferReadyRef.current = false;
    if (jitterBufferTimerRef.current) {
      window.clearTimeout(jitterBufferTimerRef.current);
      jitterBufferTimerRef.current = null;
    }

    for (const node of playbackNodesRef.current) {
      try {
        node.stop();
      } catch {
        // The node may already have ended.
      }
    }
    playbackNodesRef.current.clear();

    workletNodeRef.current?.port.close();
    workletNodeRef.current?.disconnect();
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    sinkGainRef.current?.disconnect();

    workletNodeRef.current = null;
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    sinkGainRef.current = null;

    for (const track of mediaStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    mediaStreamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    playbackCursorRef.current = 0;
  }

  function dropPendingInputAudio(reason: string) {
    if (pendingAudioChunksRef.current.length > 0) {
      debugVoice("audio.input_buffer_cleared", { reason, chunks: pendingAudioChunksRef.current.length });
    }
    pendingAudioChunksRef.current = [];
    audioFlushRequestedRef.current = false;
    lastForwardedSpeechAtRef.current = 0;
    speechStreamOpenRef.current = false;
  }

  function enqueueMicAudioFrame(bytes: Uint8Array, rms: number) {
    const now = Date.now();

    if (rms > SILENT_AUDIO_THRESHOLD) {
      lastAudibleAtRef.current = now;
      if (silentHintShownRef.current) {
        silentHintShownRef.current = false;
        setAdvisoryHint(null);
      }
    } else if (
      statusRef.current === "ACTIVE" &&
      !silentHintShownRef.current &&
      now - lastAudibleAtRef.current > SILENT_AUDIO_HINT_AFTER_MS
    ) {
      silentHintShownRef.current = true;
      setAdvisoryHint(t("hintMicrophoneSilent"));
      debugVoice("mic.silent_hint_triggered", { rms });
    }

    // Mic audio is not relayed while the coach speaks; speaker echo or room
    // noise would otherwise be heard as the learner and cut the coach off.
    if (voiceStatusRef.current === "speaking" || isAssistantSpeakingRef.current) {
      dropPendingInputAudio("assistant_speaking");
      return;
    }

    const isSpeechFrame = rms >= AUDIO_SEND_RMS_THRESHOLD;
    if (isSpeechFrame) {
      lastForwardedSpeechAtRef.current = now;
      if (turnModeRef.current === "manual" && manualActivityOpenRef.current) {
        setManualTurnSpeechDetected(true);
      }
    }

    const shouldSendFrame =
      isSpeechFrame ||
      (lastForwardedSpeechAtRef.current > 0 && now - lastForwardedSpeechAtRef.current <= AUDIO_SILENCE_TAIL_MS);

    if (!shouldSendFrame) {
      // Silence is not sent, so the end of the tail must be announced or the
      // coach keeps waiting for the learner to finish.
      if (speechStreamOpenRef.current && turnModeRef.current === "auto") {
        speechStreamOpenRef.current = false;
        void flushAudioChunk(true);
      }
      return;
    }

    speechStreamOpenRef.current = true;
    pendingAudioChunksRef.current.push(bytes);

    let bufferedBytes = 0;
    for (const chunk of pendingAudioChunksRef.current) bufferedBytes += chunk.length;

    while (bufferedBytes > MAX_PENDING_AUDIO_BYTES && pendingAudioChunksRef.current.length > 1) {
      const removed = pendingAudioChunksRef.current.shift();
      bufferedBytes -= removed?.length ?? 0;
      debugVoice("audio.input_buffer_pressure_drop", { bufferedBytes });
    }
  }

  async function connectAudioWorkletCapture(params: {
    audioContext: AudioContext;
    sourceNode: MediaStreamAudioSourceNode;
    sinkGain: GainNode;
  }) {
    await params.audioContext.audioWorklet.addModule(MIC_WORKLET_URL);

    const workletNode = new AudioWorkletNode(params.audioContext, MIC_WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });

    workletNode.port.onmessage = (event: MessageEvent<{ type?: string; pcmBuffer?: ArrayBuffer; rms?: number }>) => {
      const data = event.data;
      if (data?.type !== "audio" || !data.pcmBuffer) return;
      enqueueMicAudioFrame(new Uint8Array(data.pcmBuffer), data.rms ?? 0);
    };

    workletNode.onprocessorerror = () => {
      debugVoice("audio.worklet_processor_error");
      setAdvisoryHint(t("errorUnavailable"));
    };

    params.sourceNode.connect(workletNode);
    workletNode.connect(params.sinkGain);
    params.sinkGain.connect(params.audioContext.destination);
    workletNodeRef.current = workletNode;

    debugVoice("audio.capture_worklet_ready", { sampleRate: params.audioContext.sampleRate });
  }

  function connectScriptProcessorFallback(params: {
    audioContext: AudioContext;
    sourceNode: MediaStreamAudioSourceNode;
    sinkGain: GainNode;
  }) {
    debugVoice("audio.capture_script_processor_fallback", { sampleRate: params.audioContext.sampleRate });

    const processorNode = params.audioContext.createScriptProcessor(4096, 1, 1);

    processorNode.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      let sumSquares = 0;
      for (let i = 0; i < input.length; i += 1) {
        const sample = input[i] ?? 0;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, input.length));
      const downsampled = downsampleTo16kHz(input, params.audioContext.sampleRate);
      enqueueMicAudioFrame(int16ToLittleEndianBytes(downsampled), rms);
    };

    params.sourceNode.connect(processorNode);
    processorNode.connect(params.sinkGain);
    params.sinkGain.connect(params.audioContext.destination);
    processorNodeRef.current = processorNode;
  }

  async function prepareMicrophoneCapture() {
    if (!navigator?.mediaDevices?.getUserMedia) throw new Error("MIC_UNSUPPORTED");

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) throw new Error("AUDIO_CONTEXT_UNSUPPORTED");

    debugVoice("mic.permission_requested");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Held before any further setup so a failure below still stops the microphone.
    mediaStreamRef.current = stream;

    debugVoice("mic.permission_granted", { tracks: stream.getAudioTracks().length });

    // One context for capture and playback, so the coach's voice and the mic share a clock.
    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;
    await audioContext.resume();

    lastAudibleAtRef.current = Date.now();
    lastForwardedSpeechAtRef.current = 0;
    silentHintShownRef.current = false;

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const sinkGain = audioContext.createGain();
    sinkGain.gain.value = 0;

    // The worklet keeps realtime mic conversion off the UI thread; the script
    // processor is only a fallback for browsers without worklets.
    if (audioContext.audioWorklet) {
      try {
        await connectAudioWorkletCapture({ audioContext, sourceNode, sinkGain });
      } catch (workletError) {
        debugVoice("audio.worklet_setup_failed", {
          message: workletError instanceof Error ? workletError.message : "unknown",
        });
        connectScriptProcessorFallback({ audioContext, sourceNode, sinkGain });
      }
    } else {
      connectScriptProcessorFallback({ audioContext, sourceNode, sinkGain });
    }

    sourceNodeRef.current = sourceNode;
    sinkGainRef.current = sinkGain;
  }

  function upsertTranscript(params: {
    speaker: "USER" | "AI";
    text: string;
    final: boolean;
    turnId?: string;
    source?: string;
    warning?: string;
  }) {
    const text = params.text.trim();
    if (!text) return;

    setTranscript((current) => {
      if (params.turnId) {
        const idx = current.findIndex((item) => item.turnId === params.turnId && item.speaker === params.speaker);

        if (idx >= 0) {
          const existing = current[idx];
          const nextFinal = existing.final || params.final;
          if (existing.text === text && existing.final === nextFinal) return current;

          const updated = [...current];
          updated[idx] = { ...existing, text, final: nextFinal, source: params.source, warning: params.warning };
          return updated;
        }

        return [
          ...current,
          {
            id: crypto.randomUUID(),
            turnId: params.turnId,
            speaker: params.speaker,
            text,
            final: params.final,
            source: params.source,
            warning: params.warning,
          },
        ];
      }

      const last = current[current.length - 1];

      if (last && !last.final && last.speaker === params.speaker && params.final === false) {
        return [...current.slice(0, -1), { ...last, text }];
      }

      if (last && last.speaker === params.speaker && last.text === text) {
        if (params.final && !last.final) {
          return [...current.slice(0, -1), { ...last, final: true }];
        }
        return current;
      }

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          speaker: params.speaker,
          text,
          final: params.final,
          source: params.source,
          warning: params.warning,
        },
      ];
    });
  }

  function attachCorrection(correction: LiveCorrection, turnId?: string) {
    setTranscript((current) => {
      let idx = turnId ? current.findIndex((item) => item.turnId === turnId && item.speaker === "USER") : -1;
      if (idx < 0) {
        for (idx = current.length - 1; idx >= 0; idx -= 1) {
          if (current[idx].speaker === "USER" && current[idx].final) break;
        }
      }
      if (idx < 0) return current;
      const updated = [...current];
      updated[idx] = { ...updated[idx], correction };
      return updated;
    });
  }

  function resetJitterBuffer() {
    audioJitterQueueRef.current = [];
    jitterBufferReadyRef.current = false;
    if (jitterBufferTimerRef.current) {
      window.clearTimeout(jitterBufferTimerRef.current);
      jitterBufferTimerRef.current = null;
    }
  }

  function flushJitterBuffer() {
    if (jitterBufferTimerRef.current) {
      window.clearTimeout(jitterBufferTimerRef.current);
      jitterBufferTimerRef.current = null;
    }

    jitterBufferReadyRef.current = true;
    const queued = audioJitterQueueRef.current;
    audioJitterQueueRef.current = [];
    for (const chunk of queued) {
      playAudioChunkImmediate(chunk.data, chunk.mimeType);
    }
  }

  function finishAssistantSpeaking(reason: string) {
    debugVoice("assistant.speaking_finished", { reason });
    updateAssistantSpeaking(false);
    resetJitterBuffer();

    if (statusRef.current === "ACTIVE") {
      if (turnModeRef.current === "manual") {
        void sendManualActivity("start");
      } else {
        updateVoiceStatus("listening");
      }
    }
  }

  function scheduleAssistantSpeakingEnd(reason: string, graceMs: number) {
    const audioContext = audioContextRef.current;
    if (speakingTimerRef.current) window.clearTimeout(speakingTimerRef.current);

    const msUntilPlaybackEnds = audioContext
      ? Math.max(0, (playbackCursorRef.current - audioContext.currentTime) * 1000)
      : 0;

    speakingTimerRef.current = window.setTimeout(() => {
      speakingTimerRef.current = null;
      finishAssistantSpeaking(reason);
    }, Math.max(120, msUntilPlaybackEnds + graceMs));
  }

  function handleAssistantTurnComplete() {
    debugVoice("assistant.turn_complete");
    flushJitterBuffer();
    scheduleAssistantSpeakingEnd("turn_complete", ASSISTANT_TURN_COMPLETE_GRACE_MS);
  }

  function playAssistantAudio(base64Data: string, mimeType: string) {
    dropPendingInputAudio("assistant_audio_received");

    // After the buffer opens for this reply, chunks play at once; the cursor keeps their order.
    if (jitterBufferReadyRef.current) {
      playAudioChunkImmediate(base64Data, mimeType);
      return;
    }

    audioJitterQueueRef.current.push({ data: base64Data, mimeType });

    if (audioJitterQueueRef.current.length >= JITTER_BUFFER_MIN_CHUNKS) {
      flushJitterBuffer();
      return;
    }

    // A very short reply may be a single chunk, so it plays after a brief wait.
    if (!jitterBufferTimerRef.current) {
      jitterBufferTimerRef.current = window.setTimeout(() => {
        jitterBufferTimerRef.current = null;
        flushJitterBuffer();
      }, JITTER_BUFFER_FLUSH_TIMEOUT_MS);
    }
  }

  function playAudioChunkImmediate(base64Data: string, mimeType: string) {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    try {
      const audioBuffer = createAudioBufferFromPcm16(audioContext, base64Data, mimeType);
      if (!audioBuffer) return;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        playbackNodesRef.current.delete(source);
      };
      playbackNodesRef.current.add(source);

      // A monotonic cursor keeps chunks in order and back to back, even with network jitter.
      const startTime = Math.max(audioContext.currentTime, playbackCursorRef.current);
      source.start(startTime);
      playbackCursorRef.current = startTime + audioBuffer.duration;

      updateAssistantSpeaking(true);
      updateVoiceStatus("speaking");
      scheduleAssistantSpeakingEnd("audio_gap_fallback", SPEAKING_TIMER_GRACE_MS);
    } catch (playbackError) {
      debugVoice("audio.playback_error", {
        message: playbackError instanceof Error ? playbackError.message : "unknown",
      });
    }
  }

  function connectLiveEventStream(sessionId: string) {
    closeEventStream();
    const source = new EventSource(`/api/speak/sessions/${sessionId}/events`);
    eventSourceRef.current = source;
    debugVoice("sse.opening", { sessionId });

    source.onopen = () => {
      debugVoice("sse.open", { sessionId });
      clearSseReconnectFailTimer();
      clearSseHintTimer();
      setAdvisoryHint((current) =>
        current === t("statusReconnecting") || current === t("hintReconnectSlow") ? null : current,
      );

      if (statusRef.current === "ACTIVE") {
        updateVoiceStatus(isAssistantSpeakingRef.current ? "speaking" : "listening");
        if (turnModeRef.current === "manual" && !isAssistantSpeakingRef.current) {
          void sendManualActivity("start");
        }
      }
    };

    source.onmessage = (message) => {
      try {
        const payload = message.data?.trim();
        if (!payload || payload === "undefined") return;

        const parsed = liveRelayEventSchema.safeParse(JSON.parse(payload));
        if (!parsed.success) return;

        const event = parsed.data;

        if (event.type === "status") {
          debugVoice("sse.status_event", { sessionId, status: event.status, reason: event.reason });
          updateConnectionStatus(event.status);

          if (event.status === "ACTIVE") {
            setError(null);
            updateVoiceStatus(isAssistantSpeakingRef.current ? "speaking" : "listening");
            if (turnModeRef.current === "manual" && !isAssistantSpeakingRef.current) {
              void sendManualActivity("start");
            }
            return;
          }

          if (event.status === "RECONNECTING") {
            updateVoiceStatus("reconnecting");
            return;
          }

          if (event.status === "ERROR") {
            setError(getStatusReasonMessage(event.reason));
            saveTranscriptForResume(transcriptRef.current);
            keepConversation();
            updateVoiceStatus("failed");
            closeEventStream();
            void releaseAudioResources();
            liveSessionIdRef.current = null;
            setLiveSessionId(null);
            clearSseReconnectFailTimer();
          }

          if (event.status === "ENDED") {
            if (event.reason && event.reason !== "stopped_by_user") {
              setError(getStatusReasonMessage(event.reason));
            }
            keepConversation();
            updateVoiceStatus("ended");
            closeEventStream();
            void releaseAudioResources();
            liveSessionIdRef.current = null;
            setLiveSessionId(null);
            clearSseReconnectFailTimer();
          }

          return;
        }

        if (event.type === "transcript") {
          if (event.speaker === "USER" && event.final) {
            setLatestCorrection(null);
          }
          if (event.final) {
            debugVoice("transcript.finalized", { sessionId, speaker: event.speaker, textLength: event.text.length });
          }
          upsertTranscript({
            speaker: event.speaker,
            text: event.text,
            final: event.final,
            turnId: event.turnId,
            source: event.source,
            warning: event.warning,
          });
          return;
        }

        if (event.type === "assistant_text") {
          upsertTranscript({ speaker: "AI", text: event.text, final: true, source: "assistant_text" });
          return;
        }

        if (event.type === "assistant_audio") {
          playAssistantAudio(event.data, event.mimeType);
          return;
        }

        if (event.type === "assistant_turn_complete") {
          handleAssistantTurnComplete();
          return;
        }

        if (event.type === "transcript_skipped") {
          debugVoice("sse.transcript_skipped", { sessionId, reason: event.reason });
          setAdvisoryHint(t("hintNotEnglish"));
          return;
        }

        if (event.type === "go_away") {
          debugVoice("sse.go_away", { sessionId, timeLeft: event.timeLeft });
          updateConnectionStatus("RECONNECTING");
          updateVoiceStatus("reconnecting");
          return;
        }

        if (event.type === "correction") {
          // A reconnecting stream replays earlier corrections; each one attaches once.
          if (seenCorrectionIdsRef.current.has(event.correction.id)) return;
          seenCorrectionIdsRef.current.add(event.correction.id);
          debugVoice("correction.received", { sessionId, correctionId: event.correction.id });
          attachCorrection(event.correction, event.turnId);
          setLatestCorrection(event.correction);
        }
      } catch {
        debugVoice("sse.message_parse_error", { sessionId });
      }
    };

    source.onerror = () => {
      debugVoice("sse.error", { sessionId });

      if (
        voiceStatusRef.current === "failed" ||
        voiceStatusRef.current === "ended" ||
        voiceStatusRef.current === "idle"
      ) {
        return;
      }

      updateConnectionStatus(statusRef.current === "ENDED" ? "ENDED" : "RECONNECTING");
      updateVoiceStatus("reconnecting");

      if (sseReconnectFailTimerRef.current) return;

      // Hints stay calm while the browser retries; only the grace timer ends the session.
      clearSseHintTimer();
      setAdvisoryHint(t("statusReconnecting"));

      sseHintTimerRef.current = window.setTimeout(() => {
        sseHintTimerRef.current = null;
        if (voiceStatusRef.current === "reconnecting") {
          setAdvisoryHint(t("hintReconnectSlow"));
        }
      }, SSE_RECONNECT_SLOW_MS);

      sseReconnectFailTimerRef.current = window.setTimeout(() => {
        sseReconnectFailTimerRef.current = null;
        clearSseHintTimer();

        if (voiceStatusRef.current !== "reconnecting" || !liveSessionIdRef.current) return;

        const currentSessionId = liveSessionIdRef.current;
        debugVoice("sse.reconnect_timeout", { sessionId: currentSessionId });

        saveTranscriptForResume(transcriptRef.current);
        keepConversation();

        setError(t("errorReconnectFailed"));
        updateConnectionStatus("ERROR");
        updateVoiceStatus("failed");
        closeEventStream();
        void releaseAudioResources();
        liveSessionIdRef.current = null;
        setLiveSessionId(null);
        void stopLiveSession(currentSessionId).catch(() => undefined);
      }, SSE_RECONNECT_GRACE_MS);
    };
  }

  async function handleStartVoicePractice() {
    try {
      setIsStarting(true);
      setError(null);
      setAdvisoryHint(null);
      // A conversation cut off by a dropped connection comes back here.
      const saved = loadTranscriptForResume();
      setTranscript(saved ?? []);
      clearTranscriptForResume();
      setLatestCorrection(null);
      seenCorrectionIdsRef.current.clear();
      setManualActivityOpen(false);
      setIsMicReady(false);
      setIsTranscriptOpen(false);
      updateVoiceStatus("requesting_microphone");

      if (typeof EventSource === "undefined") throw new Error("SSE_UNSUPPORTED");

      const effectiveType =
        (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "unknown";
      if (effectiveType === "slow-2g" || effectiveType === "2g") {
        setAdvisoryHint(t("hintSlowNetwork"));
      }

      await prepareMicrophoneCapture();
      setIsMicReady(true);
      updateVoiceStatus("connecting");
      updateConnectionStatus("CONNECTING");

      const idea = customIdea.trim();
      const label = idea || (scenario ? t(scenarioLabel[scenario]) : t("freeTalk"));
      situationRef.current = label;
      setSituation(label);

      const liveSession = await startLiveSession({
        scenario: idea ? undefined : (scenario ?? undefined),
        customIdea: idea || undefined,
        turnMode,
      });

      liveSessionIdRef.current = liveSession.id;
      setLiveSessionId(liveSession.id);
      updateConnectionStatus(liveSession.status);
      updateVoiceStatus(liveSession.status === "ACTIVE" ? "connected" : "connecting");

      connectLiveEventStream(liveSession.id);
      startFlushLoop();

      debugVoice("session.started", { liveSessionId: liveSession.id, scenario, turnMode });
    } catch (startError) {
      debugVoice("session.start_failed", {
        message: startError instanceof Error ? startError.message : "unknown_error",
      });

      let errorMessage = t("errorUnavailable");

      if (
        startError instanceof Error &&
        (startError.message === "MIC_UNSUPPORTED" ||
          startError.message === "AUDIO_CONTEXT_UNSUPPORTED" ||
          startError.message === "SSE_UNSUPPORTED")
      ) {
        errorMessage = t("errorMicrophoneUnsupported");
      } else if (
        startError instanceof DOMException &&
        (startError.name === "NotAllowedError" ||
          startError.name === "SecurityError" ||
          startError.name === "PermissionDeniedError" ||
          startError.name === "AbortError")
      ) {
        errorMessage = t("errorMicrophonePermission");
      } else if (
        startError instanceof DOMException &&
        (startError.name === "NotFoundError" || startError.name === "DevicesNotFoundError")
      ) {
        errorMessage = t("errorMicrophoneNotFound");
      } else if (startError instanceof LiveClientError && startError.status === 429) {
        errorMessage = t("errorRateLimited");
      } else if (startError instanceof LiveClientError && startError.status >= 500) {
        errorMessage = t("errorCoachUnreachable");
      }

      setError(errorMessage);
      updateConnectionStatus("ERROR");
      updateVoiceStatus("failed");
      liveSessionIdRef.current = null;
      setLiveSessionId(null);
      await releaseAudioResources();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStopVoicePractice() {
    try {
      setIsStopping(true);
      debugVoice("session.stop_requested", { sessionId: liveSessionIdRef.current });
      await flushAudioChunk(true).catch(() => undefined);
      await releaseAudioResources();

      // Ended is set before the stream closes, so a queued error cannot arm a reconnect timer.
      updateVoiceStatus("ended");
      updateConnectionStatus("ENDED");
      keepConversation();

      const currentSessionId = liveSessionIdRef.current;
      closeEventStream();

      if (currentSessionId) {
        await stopLiveSession(currentSessionId).catch(() => undefined);
      }

      liveSessionIdRef.current = null;
      setLiveSessionId(null);
      setError(null);
    } finally {
      setIsStopping(false);
    }
  }

  function handlePractiseAgain() {
    setError(null);
    setAdvisoryHint(null);
    setLatestCorrection(null);
    updateConnectionStatus("IDLE");
    updateVoiceStatus("idle");
  }

  useEffect(() => {
    const playbackNodes = playbackNodesRef.current;
    const seenCorrections = seenCorrectionIdsRef.current;

    return () => {
      debugVoice("component.unmount_cleanup");
      const currentSessionId = liveSessionIdRef.current;

      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      for (const timer of [sseReconnectFailTimerRef, sseHintTimerRef, speakingTimerRef, jitterBufferTimerRef, audioRetryTimerRef]) {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (flushTimerRef.current !== null) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      pendingAudioChunksRef.current = [];
      audioJitterQueueRef.current = [];
      jitterBufferReadyRef.current = false;
      silentHintShownRef.current = false;
      lastAudibleAtRef.current = 0;
      seenCorrections.clear();

      for (const node of playbackNodes) {
        try {
          node.stop();
        } catch {
          // The node may already have ended.
        }
      }
      playbackNodes.clear();

      workletNodeRef.current?.port.close();
      workletNodeRef.current?.disconnect();
      processorNodeRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();
      sinkGainRef.current?.disconnect();

      for (const track of mediaStreamRef.current?.getTracks() ?? []) {
        track.stop();
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
      }

      if (currentSessionId) {
        void stopLiveSession(currentSessionId).catch(() => undefined);
      }
    };
  }, []);

  const isActive = Boolean(liveSessionId);
  const statusLabel = t(statusLabelKey[voiceStatus]);
  const voiceModeTip =
    turnMode === "manual"
      ? isManualActivityOpen && !hasSpokenThisManualTurn
        ? t("tipSpeakFirst")
        : t("tipTapDone")
      : t("tipListening");
  const canUseManualDoneControl =
    turnMode === "manual" &&
    isActive &&
    status === "ACTIVE" &&
    isMicReady &&
    isManualActivityOpen &&
    hasSpokenThisManualTurn &&
    !isSendingActivity &&
    !isStopping &&
    !isEndingTurn &&
    !isAssistantSpeaking &&
    voiceStatus !== "failed" &&
    voiceStatus !== "ended" &&
    voiceStatus !== "reconnecting";
  const showPostSessionPanel = !isActive && voiceStatus === "ended" && !error;
  const live = voiceStatus === "speaking" || voiceStatus === "listening";
  const waiting = voiceStatus === "connecting" || voiceStatus === "reconnecting";
  const turnModeLabel = turnMode === "manual" ? t("longAnswer") : t("autoListening");

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
      {!isActive ? (
        <section className="flex flex-col gap-5 rounded-16 border border-line bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <h2 className="text-heading font-semibold">{t("lobbyTitle")}</h2>
              <p className="text-label text-fg-muted">{t("lobbyDescription")}</p>
            </div>
            <Mascot className="size-16" />
          </div>

          <ScenarioPicker
            scenario={scenario}
            customIdea={customIdea}
            onScenario={setScenario}
            onCustomIdea={setCustomIdea}
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="text-label font-medium text-fg">{t("turnModeLabel")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { id: "auto", title: t("autoListening"), description: t("autoListeningDescription") },
                  { id: "manual", title: t("longAnswer"), description: t("longAnswerDescription") },
                ] as const
              ).map((option) => {
                const selected = turnMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={isStarting || isStopping}
                    onClick={() => setTurnMode(option.id)}
                    className={cn(
                      "flex min-h-16 flex-col items-start gap-1 rounded-12 border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50",
                      selected ? "border-fg bg-field" : "border-line bg-card",
                    )}
                  >
                    <span className="text-label font-semibold">{option.title}</span>
                    <span className="text-caption text-fg-muted">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button
            width="full"
            disabled={isStarting || isStopping}
            onClick={() => void handleStartVoicePractice()}
          >
            <MicIcon />
            {isStarting ? t("starting") : t("start")}
          </Button>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-5 rounded-16 border border-line bg-card p-4">
          <header className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <span className="flex items-center gap-2 text-caption text-fg-muted">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-full",
                  live ? "bg-action motion-safe:animate-pulse" : waiting ? "bg-fg-muted motion-safe:animate-pulse" : "bg-line",
                )}
              />
              {turnModeLabel}
            </span>
            <span className="rounded-8 border border-line px-2 py-1 text-caption text-fg-muted">{situation}</span>
          </header>

          <div className="relative flex size-44 items-center justify-center">
            {live ? <div aria-hidden className="absolute inset-0 rounded-full bg-field motion-safe:animate-pulse" /> : null}
            <div
              className={cn(
                "relative flex size-32 items-center justify-center rounded-full border-2 bg-canvas",
                live ? "border-action" : "border-line",
              )}
            >
              <Mascot className="size-24" />
            </div>
          </div>

          <div aria-hidden className="flex h-8 items-center justify-center gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-7 w-1.5 origin-center rounded-full",
                  live ? "bg-action motion-safe:animate-eq-wave" : "scale-y-[0.3] bg-line",
                )}
                style={live ? { animationDelay: `${i * 150}ms` } : undefined}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1 text-center" aria-live="polite">
            <p className="text-heading font-semibold">{statusLabel}</p>
            <p className="max-w-sm text-caption text-fg-muted">{voiceModeTip}</p>
          </div>

          {transcript.some((item) => item.final) ? (
            <div className="flex w-full flex-col gap-2 rounded-12 border border-line bg-field p-3">
              {transcript
                .filter((item) => item.final)
                .slice(-3)
                .map((turn) => (
                  <p key={turn.id} className="flex gap-2 text-label">
                    <span className="w-12 shrink-0 text-caption text-fg-muted">
                      {turn.speaker === "USER" ? t("you") : t("coach")}
                    </span>
                    <span>{turn.text}</span>
                  </p>
                ))}
            </div>
          ) : null}

          <div className="flex w-full flex-wrap items-center justify-center gap-3 border-t border-line pt-4">
            <Button
              hierarchy="secondary"
              aria-pressed={isTranscriptOpen}
              onClick={() => setIsTranscriptOpen((open) => !open)}
            >
              {isTranscriptOpen ? t("hideHistory") : t("showHistory")}
            </Button>

            {turnMode === "manual" ? (
              <Button disabled={!canUseManualDoneControl} onClick={() => void handleManualDoneSpeaking()}>
                {t("doneSpeaking")}
              </Button>
            ) : null}

            <button
              type="button"
              disabled={!isActive || isStopping}
              onClick={() => void handleStopVoicePractice()}
              className="flex size-12 items-center justify-center rounded-full bg-action text-on-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50"
            >
              <HangUpIcon />
              <span className="sr-only">{t("hangUp")}</span>
            </button>
          </div>
        </section>
      )}

      {(isActive && isTranscriptOpen) || (!isActive && transcript.length > 0) ? (
        <section className="flex flex-col gap-3 rounded-16 border border-line bg-card p-4">
          <div>
            <h2 className="text-label font-semibold">{t("transcriptTitle")}</h2>
            <p className="text-caption text-fg-muted">{t("transcriptSubtitle")}</p>
          </div>
          <div ref={transcriptScrollRef} className="flex max-h-96 flex-col gap-3 overflow-y-auto">
            {transcript.length === 0 ? (
              <p className="py-6 text-center text-label text-fg-muted">{t("startSayingHello")}</p>
            ) : (
              transcript.map((item) => <TranscriptBubble key={item.id} item={item} />)
            )}
          </div>
        </section>
      ) : null}

      {advisoryHint ? (
        <p role="status" className="rounded-12 border border-line bg-field p-3 text-label text-fg-muted">
          {advisoryHint}
        </p>
      ) : null}

      {latestCorrection ? <LatestCorrection correction={latestCorrection} onDismiss={() => setLatestCorrection(null)} /> : null}

      {showPostSessionPanel ? (
        <section className="flex flex-col gap-4 rounded-16 border border-line bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <h2 className="text-heading font-semibold">{t("postSessionTitle")}</h2>
              <p className="text-label text-fg-muted">{t("postSessionSubtitle")}</p>
            </div>
            <Mascot className="size-16" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/speak/review">{t("reviewSession")}</Link>
            </Button>
            <Button hierarchy="secondary" onClick={handlePractiseAgain}>
              {t("practiseAgain")}
            </Button>
          </div>
        </section>
      ) : null}

      {error || voiceStatus === "failed" ? (
        <section role="alert" className="flex flex-col gap-3 rounded-16 border border-line bg-card p-4">
          <div className="flex flex-col gap-1">
            <p className="text-label font-semibold">{t("errorTitle")}</p>
            <p className="text-label text-fg-muted">{error ?? t("errorUnavailable")}</p>
          </div>
          <Button
            hierarchy="secondary"
            onClick={() => void handleStartVoicePractice()}
            disabled={isStarting || isStopping}
          >
            {t("restart")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function TranscriptBubble({ item }: { item: TranscriptItem }) {
  const t = useTranslations("Speak");
  return (
    <div className={cn("flex w-full", item.speaker === "USER" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-16 border border-line px-4 py-3 text-body",
          item.speaker === "USER" ? "bg-field" : "bg-raised",
          !item.final && "opacity-80",
        )}
      >
        <span className="mb-1 block text-caption text-fg-muted">
          {item.speaker === "USER" ? t("you") : t("coach")}
        </span>
        <p className="whitespace-pre-wrap">{item.text}</p>
        {item.warning ? <p className="mt-1 text-caption text-fg-muted">{t("transcriptUncertain")}</p> : null}
        {item.correction ? <CorrectionNote correction={item.correction} /> : null}
      </div>
    </div>
  );
}

function CorrectionNote({ correction }: { correction: LiveCorrection }) {
  const t = useTranslations("Speak");
  const language = isLanguageCode(correction.supportLanguage) ? getLanguage(correction.supportLanguage) : null;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-caption text-fg-muted">
        {t("tryThis")} · {t(correctionTypeKey[correction.correctionType])}
      </p>
      <p className="mt-1">{correction.corrected}</p>
      <p lang={language?.code} className={cn("mt-2 text-label text-fg-muted", language && fontClassNames[language.font])}>
        {correction.explanation}
      </p>
    </div>
  );
}

function LatestCorrection({ correction, onDismiss }: { correction: LiveCorrection; onDismiss: () => void }) {
  const t = useTranslations("Speak");
  const language = isLanguageCode(correction.supportLanguage) ? getLanguage(correction.supportLanguage) : null;
  return (
    <section className="flex flex-col gap-2 rounded-16 border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-fg-muted">
          {t("tryThis")} · {t(correctionTypeKey[correction.correctionType])}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="-m-2 flex size-10 items-center justify-center rounded-full text-fg-muted focus-visible:outline-2 focus-visible:outline-fg"
        >
          <CloseIcon />
          <span className="sr-only">{t("dismissNote")}</span>
        </button>
      </div>
      <p className="text-body">{correction.corrected}</p>
      <p lang={language?.code} className={cn("text-label text-fg-muted", language && fontClassNames[language.font])}>
        {correction.explanation}
      </p>
    </section>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" strokeLinecap="round" />
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        d="M3 14.5c5-4.7 13-4.7 18 0l-2.4 2.4-3.4-1.6v-2.5a11 11 0 0 0-6.4 0v2.5l-3.4 1.6L3 14.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export { VoiceSession };
