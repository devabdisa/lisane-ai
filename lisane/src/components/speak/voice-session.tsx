"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { downsampleToPcm16, pcm16ToBase64, playPcm16Base64 } from "./pcm";

type Line = { id: string; speaker: "user" | "coach"; text: string };
type Status = "idle" | "connecting" | "listening" | "ended" | "error";

const FLUSH_MS = 100;

function VoiceSession() {
  const t = useTranslations("Speak");
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const events = useRef<EventSource | null>(null);
  const capture = useRef<Capture | null>(null);
  const playback = useRef<AudioContext | null>(null);
  const cursor = useRef({ time: 0 });

  function addLine(speaker: Line["speaker"], text: string, final: boolean) {
    setLines((current) => {
      const last = current.at(-1);
      if (last && last.speaker === speaker && last.id.startsWith("partial")) {
        const next = current.slice(0, -1);
        next.push({ id: final ? crypto.randomUUID() : last.id, speaker, text });
        return next;
      }
      return [...current, { id: final ? crypto.randomUUID() : `partial-${speaker}`, speaker, text }];
    });
  }

  async function start() {
    setError(null);
    setLines([]);
    setStatus("connecting");
    const response = await fetch("/api/speak/sessions", { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? t("unavailable"));
      setStatus("error");
      return;
    }
    const body = (await response.json()) as { id: string };
    sessionId.current = body.id;
    events.current = new EventSource(`/api/speak/sessions/${body.id}/events`);
    events.current.onmessage = (event) => {
      const data = JSON.parse(event.data) as
        | { type: "status"; status: "active" | "ended" | "error" }
        | { type: "transcript"; speaker: "user" | "coach"; text: string; final: boolean }
        | { type: "coach_audio"; data: string };
      if (data.type === "transcript") addLine(data.speaker, data.text, data.final);
      if (data.type === "coach_audio") {
        playback.current ??= new AudioContext();
        playPcm16Base64(playback.current, data.data, cursor.current);
      }
      if (data.type === "status" && data.status === "error") {
        setStatus("error");
        setError(t("unavailable"));
      }
      if (data.type === "status" && data.status === "ended") setStatus("ended");
    };
    try {
      capture.current = await startCapture((pcm) => {
        const id = sessionId.current;
        if (!id || pcm.length === 0) return;
        void fetch(`/api/speak/sessions/${id}/audio`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ audioBase64: pcm16ToBase64(pcm) }),
        });
      });
      setStatus("listening");
    } catch {
      setError(t("microphone"));
      setStatus("error");
      await stop();
    }
  }

  async function stop() {
    capture.current?.stop();
    capture.current = null;
    const id = sessionId.current;
    sessionId.current = null;
    events.current?.close();
    events.current = null;
    if (id) {
      await fetch(`/api/speak/sessions/${id}/stop`, { method: "POST" });
    }
    setStatus((current) => (current === "error" ? current : "idle"));
  }

  const listening = status === "listening" || status === "connecting";

  return (
    <div className="flex flex-1 flex-col px-4 pb-4">
      <div className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="rounded-16 border border-line bg-card p-6 text-body text-fg-muted">{t("empty")}</p>
        ) : (
          lines.map((line) => (
            <p
              key={line.id}
              className={cn(
                "max-w-[85%] rounded-16 border border-line px-4 py-3 text-body",
                line.speaker === "user" ? "self-end bg-field" : "self-start bg-card",
              )}
            >
              <span className="mb-1 block text-caption text-fg-muted">
                {line.speaker === "user" ? t("you") : t("coach")}
              </span>
              {line.text}
            </p>
          ))
        )}
      </div>
      <div className="flex flex-col items-center gap-3 pt-4">
        <p className="text-caption text-fg-muted">{t(status)}</p>
        {error ? (
          <p role="alert" className="text-center text-label">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          aria-pressed={listening}
          onClick={() => void (listening ? stop() : start())}
          className="flex size-20 items-center justify-center rounded-full bg-action text-on-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          <MicIcon />
          <span className="sr-only">{listening ? t("stop") : t("start")}</span>
        </button>
        </div>
      </div>
    </div>
  );
}

const scenarioLabel = {
  self_introduction: "selfIntroduction",
  job_interview: "jobInterview",
  workplace: "workplace",
  university: "university",
} as const;

type Capture = { stop: () => void };

async function startCapture(onPcm: (pcm: Int16Array) => void, isCoachSpeaking: () => boolean): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  let pending: number[] = [];
  let lastSpeechAt = 0;
  let timer = 0;
  const silent = context.createGain();
  silent.gain.value = 0;
  let processor: ScriptProcessorNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  const acceptFrame = (pcm: Int16Array, rms: number) => {
    if (isCoachSpeaking()) {
      pending = [];
      return;
    }
    const now = Date.now();
    if (rms >= SPEECH_RMS) lastSpeechAt = now;
    if (rms < SPEECH_RMS && (lastSpeechAt === 0 || now - lastSpeechAt > SILENCE_TAIL_MS)) return;
    for (let index = 0; index < pcm.length; index += 1) pending.push(pcm[index] ?? 0);
  };

  if (context.audioWorklet) {
    try {
      await context.audioWorklet.addModule("/worklets/lisane-mic-processor.js");
      worklet = new AudioWorkletNode(context, "lisane-mic-processor", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      });
      worklet.port.onmessage = (event: MessageEvent<{ type?: string; pcmBuffer?: ArrayBuffer; rms?: number }>) => {
        if (event.data?.type !== "audio" || !event.data.pcmBuffer) return;
        acceptFrame(new Int16Array(event.data.pcmBuffer), event.data.rms ?? 0);
      };
      source.connect(worklet);
      worklet.connect(silent);
    } catch {
      worklet?.disconnect();
      worklet = null;
    }
  }

  if (!worklet) {
    processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      let sum = 0;
      for (const sample of channel) sum += sample * sample;
      acceptFrame(downsampleToPcm16(channel, context.sampleRate), Math.sqrt(sum / Math.max(1, channel.length)));
    };
    source.connect(processor);
    processor.connect(silent);
  }
  silent.connect(context.destination);
  timer = window.setInterval(() => {
    if (pending.length === 0) return;
    const chunk = Int16Array.from(pending);
    pending = [];
    onPcm(chunk);
  }, FLUSH_MS);

  return {
    stop: () => {
      window.clearInterval(timer);
      processor?.disconnect();
      worklet?.port.close();
      worklet?.disconnect();
      source.disconnect();
      void context.close();
      for (const track of stream.getAudioTracks()) track.stop();
    },
  };
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" strokeLinecap="round" />
    </svg>
  );
}

export { VoiceSession };
