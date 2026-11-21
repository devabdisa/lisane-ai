import "server-only";
import { randomUUID } from "node:crypto";
import {
  ActivityHandling,
  EndSensitivity,
  Modality,
  StartSensitivity,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import {
  LIVE_MIN_TRANSCRIPT_LENGTH,
  isLikelyWrongScriptTranscript,
  isStableEnoughForFallbackFinalization,
  isUsableEnglishTranscript,
  mergeStreamingTranscript,
  normalizeTranscriptText,
} from "@/lib/live-transcript";
import { requestedSpokenSupport } from "@/lib/spoken-support";
import { countAudiblePcm16Windows, MIN_AUDIBLE_WINDOWS } from "@/lib/voice-evidence";
import { buildLiveSystemInstruction, type LiveProfileContext } from "@/prompts/speak-live";
import {
  DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE,
  type LiveConnectionStatus,
  type LiveRelayEvent,
  type LiveTurnMode,
  type StartLiveSessionResponse,
} from "@/schemas/live";
import { GEMINI_LIVE_MODEL, getGeminiLive, toModelResource } from "@/server/ai/gemini";
import { getPrisma } from "@/server/db";
import { judgeSpeakTurn } from "@/server/services/speak/judge-turn";
import { supportOpener } from "./support-opener";

const LIVE_SESSION_MAX_AGE_MS = 1000 * 60 * 20;
const LIVE_SESSION_IDLE_TIMEOUT_MS = 1000 * 60 * 5;
const LIVE_CLEANUP_INTERVAL_MS = 1000 * 30;
const LIVE_EVENT_HISTORY_LIMIT = 150;
const LIVE_RECONNECT_MAX_ATTEMPTS = 2;
const LIVE_RECONNECT_BASE_DELAY_MS = 3000;
const LIVE_FALLBACK_FINAL_DELAY_MS = 2200;
const LIVE_ASSISTANT_FALLBACK_FINAL_DELAY_MS = 1800;
const LIVE_DUPLICATE_WINDOW_MS = 4000;
const LIVE_RECENT_TRANSCRIPT_LIMIT = 20;
const LIVE_MAX_OUTPUT_TOKENS = 380;

type StartLiveSessionParams = {
  userId: string;
  speakSessionId: string;
  scenario: string | null;
  customIdea: string | null;
  supportLanguage: string;
  turnMode: LiveTurnMode;
  profile: LiveProfileContext | null;
};

type SubscribeParams = {
  liveSessionId: string;
  userId: string;
  onEvent: (event: LiveRelayEvent) => void;
};

type StopLiveSessionParams = {
  liveSessionId: string;
  userId: string;
  reason?: string;
};

type SendAudioParams = {
  liveSessionId: string;
  userId: string;
  audioBase64?: string;
  audioMimeType: string;
  audioStreamEnd?: boolean;
};

type LiveActivityParams = {
  liveSessionId: string;
  userId: string;
};

type LiveSessionState = {
  id: string;
  userId: string;
  speakSessionId: string;
  scenario: string | null;
  customIdea: string | null;
  supportLanguage: string;
  turnMode: LiveTurnMode;
  profile: LiveProfileContext | null;
  model: string;
  baseConfig: LiveConnectConfig;
  fallbackConfig: LiveConnectConfig;
  activeConfig: LiveConnectConfig;
  connection: Session | null;
  status: LiveConnectionStatus;
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
  reconnectAttempts: number;
  reconnectPromise: Promise<void> | null;
  resumptionHandle: string | null;
  ended: boolean;
  stopRequested: boolean;
  pendingUserTranscript: string | null;
  latestAudibleTranscript: string;
  assistantSupportReplied: boolean;
  pendingAssistantTranscript: string | null;
  pendingUserFinalTimer: ReturnType<typeof setTimeout> | null;
  pendingAssistantFinalTimer: ReturnType<typeof setTimeout> | null;
  assistantTurnInProgress: boolean;
  discardAssistantTurn: boolean;
  audibleInputWindows: number;
  userTranscriptClosed: boolean;
  recentUserFinalTranscripts: Array<{ text: string; at: number }>;
  recentAiFinalTranscripts: Array<{ text: string; at: number }>;
  currentUserTurnId: string | null;
  currentAssistantTurnId: string | null;
  turnCounter: number;
  eventHistory: LiveRelayEvent[];
  subscribers: Map<string, (event: LiveRelayEvent) => void>;
};

function logInfo(event: string, payload: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "lisane-live", level: "info", event, ...payload }));
}

function logError(event: string, payload: Record<string, unknown>) {
  console.error(JSON.stringify({ scope: "lisane-live", level: "error", event, ...payload }));
}

function isRecentDuplicate(items: Array<{ text: string; at: number }>, text: string, now: number) {
  return items.some((item) => item.text === text && now - item.at <= LIVE_DUPLICATE_WINDOW_MS);
}

function pushRecentTranscript(items: Array<{ text: string; at: number }>, text: string, now: number) {
  items.push({ text, at: now });
  if (items.length > LIVE_RECENT_TRANSCRIPT_LIMIT) {
    items.splice(0, items.length - LIVE_RECENT_TRANSCRIPT_LIMIT);
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isUnsupportedModelError(error: unknown) {
  const message = toErrorMessage(error).toLowerCase();
  return message.includes("is not found") || message.includes("not supported for bidigeneratecontent");
}

function isUnsupportedModelMessage(message: string | null | undefined) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("is not found") || normalized.includes("not supported for bidigeneratecontent");
}

function getLiveModelCandidates(configuredModel: string) {
  const unique = new Set<string>();
  for (const candidate of [
    configuredModel,
    "models/gemini-3.1-flash-live-preview",
    "models/gemini-2.0-flash-live-001",
  ]) {
    unique.add(toModelResource(candidate));
  }
  return Array.from(unique);
}

function withResumptionHandle(config: LiveConnectConfig, resumeHandle: string | null): LiveConnectConfig {
  if (!resumeHandle) return config;
  return {
    ...config,
    sessionResumption: { ...(config.sessionResumption ?? {}), handle: resumeHandle },
  };
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type RealtimeInputConfig = NonNullable<LiveConnectConfig["realtimeInputConfig"]>;

function buildRealtimeInputConfig(turnMode: LiveTurnMode): RealtimeInputConfig {
  if (turnMode === "manual") {
    return { automaticActivityDetection: { disabled: true } };
  }

  return {
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      // Learners often pause while translating thoughts; this keeps the coach patient.
      prefixPaddingMs: 400,
      silenceDurationMs: 2600,
    },
    // Room noise or speaker echo must not cut the coach off mid-sentence.
    activityHandling: ActivityHandling.NO_INTERRUPTION,
  };
}

export class LiveSessionManagerError extends Error {
  constructor(
    public readonly code:
      | "LIVE_SESSION_NOT_FOUND"
      | "LIVE_SESSION_FORBIDDEN"
      | "LIVE_SESSION_NOT_ACTIVE"
      | "LIVE_SESSION_START_FAILED"
      | "LIVE_AUDIO_SEND_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "LiveSessionManagerError";
  }
}

export class LiveSessionManager {
  private readonly sessions = new Map<string, LiveSessionState>();
  private readonly activeSessionByUser = new Map<string, string>();
  private orphanCleanupStarted = false;

  constructor() {
    const interval = setInterval(() => {
      void this.cleanupSessions();
    }, LIVE_CLEANUP_INTERVAL_MS);

    if ("unref" in interval && typeof interval.unref === "function") {
      interval.unref();
    }
  }

  async startSession(params: StartLiveSessionParams): Promise<StartLiveSessionResponse> {
    if (!this.orphanCleanupStarted) {
      this.orphanCleanupStarted = true;
      void this.cleanupOrphanSessions();
    }

    const existingSessionId = this.activeSessionByUser.get(params.userId);
    if (existingSessionId) {
      await this.stopSession({
        liveSessionId: existingSessionId,
        userId: params.userId,
        reason: "replaced_by_new_session",
      }).catch(() => undefined);
    }

    const id = randomUUID();
    const now = Date.now();
    const systemInstruction = buildLiveSystemInstruction(params);
    const realtimeInputConfig = buildRealtimeInputConfig(params.turnMode);

    const fallbackConfig: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      systemInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig,
      temperature: 0.6,
      topP: 0.9,
      // Higher cap prevents clipped spoken sentences; the prompt keeps replies short.
      maxOutputTokens: LIVE_MAX_OUTPUT_TOKENS,
    };

    const baseConfig: LiveConnectConfig = {
      ...fallbackConfig,
      sessionResumption: {},
      contextWindowCompression: {
        triggerTokens: "24000",
        slidingWindow: { targetTokens: "12000" },
      },
    };

    const state: LiveSessionState = {
      id,
      userId: params.userId,
      speakSessionId: params.speakSessionId,
      scenario: params.scenario,
      customIdea: params.customIdea,
      supportLanguage: params.supportLanguage,
      turnMode: params.turnMode,
      profile: params.profile,
      model: GEMINI_LIVE_MODEL,
      baseConfig,
      fallbackConfig,
      activeConfig: baseConfig,
      connection: null,
      status: "CONNECTING",
      createdAt: now,
      expiresAt: now + LIVE_SESSION_MAX_AGE_MS,
      updatedAt: now,
      reconnectAttempts: 0,
      reconnectPromise: null,
      resumptionHandle: null,
      ended: false,
      stopRequested: false,
      pendingUserTranscript: null,
      latestAudibleTranscript: "",
      assistantSupportReplied: false,
      pendingAssistantTranscript: null,
      pendingUserFinalTimer: null,
      pendingAssistantFinalTimer: null,
      assistantTurnInProgress: false,
      discardAssistantTurn: false,
      audibleInputWindows: 0,
      userTranscriptClosed: false,
      recentUserFinalTranscripts: [],
      recentAiFinalTranscripts: [],
      currentUserTurnId: null,
      currentAssistantTurnId: null,
      turnCounter: 0,
      eventHistory: [],
      subscribers: new Map(),
    };

    this.sessions.set(id, state);
    this.activeSessionByUser.set(params.userId, id);

    this.publish(state, {
      type: "session",
      id,
      speakSessionId: params.speakSessionId,
      scenario: params.scenario,
      customIdea: params.customIdea,
      supportLanguage: params.supportLanguage,
      turnMode: params.turnMode,
      model: state.model,
    });
    this.publish(state, { type: "status", status: "CONNECTING" });

    logInfo("session.starting", {
      liveSessionId: id,
      speakSessionId: params.speakSessionId,
      userId: params.userId,
      scenario: params.scenario,
      hasCustomIdea: Boolean(params.customIdea),
      supportLanguage: params.supportLanguage,
      turnMode: params.turnMode,
      model: state.model,
    });

    void this.connectInitialSession(state.id);

    const latest = this.sessions.get(id);
    if (!latest) {
      throw new LiveSessionManagerError("LIVE_SESSION_START_FAILED", "Live session disappeared during startup.");
    }

    return {
      id: latest.id,
      speakSessionId: latest.speakSessionId,
      scenario: latest.scenario,
      customIdea: latest.customIdea,
      supportLanguage: latest.supportLanguage,
      turnMode: latest.turnMode,
      model: latest.model,
      status: latest.status,
      expiresAt: new Date(latest.expiresAt).toISOString(),
    };
  }

  subscribe(params: SubscribeParams) {
    const state = this.getOwnedSession(params.liveSessionId, params.userId);
    const listenerId = randomUUID();

    state.subscribers.set(listenerId, params.onEvent);
    for (const event of state.eventHistory) {
      params.onEvent(event);
    }

    return {
      unsubscribe: () => {
        this.sessions.get(params.liveSessionId)?.subscribers.delete(listenerId);
      },
    };
  }

  async sendAudio(params: SendAudioParams) {
    const state = this.getOwnedSession(params.liveSessionId, params.userId);

    if (state.ended || !state.connection) {
      throw new LiveSessionManagerError("LIVE_SESSION_NOT_ACTIVE", "Live session is not active.");
    }

    if (state.status === "RECONNECTING") {
      throw new LiveSessionManagerError("LIVE_SESSION_NOT_ACTIVE", "Live session is reconnecting.");
    }

    try {
      state.updatedAt = Date.now();

      if (!params.audioBase64 && !params.audioStreamEnd) {
        throw new LiveSessionManagerError("LIVE_AUDIO_SEND_FAILED", "Audio payload was empty.");
      }

      if (params.audioBase64 && !state.assistantTurnInProgress) {
        state.connection.sendRealtimeInput({
          audio: { data: params.audioBase64, mimeType: params.audioMimeType },
        });
        if (params.audioMimeType === DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE && state.audibleInputWindows < MIN_AUDIBLE_WINDOWS) {
          state.audibleInputWindows += countAudiblePcm16Windows(Buffer.from(params.audioBase64, "base64"));
        }
      }

      // The phone stops sending during silence; without this marker the
      // server never sees the end of the learner's turn.
      if (params.audioStreamEnd) {
        state.connection.sendRealtimeInput({ audioStreamEnd: true });
      }
    } catch (error) {
      logError("session.audio_send_failed", {
        liveSessionId: params.liveSessionId,
        userId: params.userId,
        message: toErrorMessage(error),
      });
      throw new LiveSessionManagerError("LIVE_AUDIO_SEND_FAILED", "Failed to forward audio to Gemini Live.");
    }
  }

  startUserActivity(params: LiveActivityParams) {
    const state = this.getOwnedSession(params.liveSessionId, params.userId);
    this.logActivityRequest(state, "start", params.userId);
    this.sendActivitySignal(state, "start");
  }

  endUserActivity(params: LiveActivityParams) {
    const state = this.getOwnedSession(params.liveSessionId, params.userId);
    this.logActivityRequest(state, "end", params.userId);
    this.sendActivitySignal(state, "end");
  }

  async stopSession(params: StopLiveSessionParams) {
    const state = this.getOwnedSession(params.liveSessionId, params.userId);
    await this.closeSession(state.id, params.reason ?? "stopped_by_user");
  }

  private sendActivitySignal(state: LiveSessionState, type: "start" | "end") {
    if (state.ended || !state.connection) {
      logInfo("session.activity_rejected", {
        liveSessionId: state.id,
        type,
        status: state.status,
        reason: state.ended ? "session_ended" : "connection_not_ready",
      });
      throw new LiveSessionManagerError("LIVE_SESSION_NOT_ACTIVE", "Live session is not active.");
    }

    if (state.status !== "ACTIVE") {
      logInfo("session.activity_rejected", {
        liveSessionId: state.id,
        type,
        status: state.status,
        reason: "session_not_active",
      });
      throw new LiveSessionManagerError(
        "LIVE_SESSION_NOT_ACTIVE",
        state.status === "RECONNECTING" ? "Live session is reconnecting." : "Live session is still connecting.",
      );
    }

    if (state.turnMode !== "manual") {
      logInfo("session.activity_rejected", {
        liveSessionId: state.id,
        type,
        turnMode: state.turnMode,
        reason: "not_manual_turn_mode",
      });
      throw new LiveSessionManagerError(
        "LIVE_SESSION_NOT_ACTIVE",
        "Activity signals are only available in manual turn mode.",
      );
    }

    try {
      state.updatedAt = Date.now();
      state.connection.sendRealtimeInput(type === "start" ? { activityStart: {} } : { activityEnd: {} });
      logInfo(type === "start" ? "session.activity_start" : "session.activity_end", { liveSessionId: state.id });
    } catch (error) {
      logError("session.activity_signal_failed", {
        liveSessionId: state.id,
        type,
        message: toErrorMessage(error),
      });
      throw new LiveSessionManagerError("LIVE_AUDIO_SEND_FAILED", "Failed to send activity signal to Gemini Live.");
    }
  }

  private async connectInitialSession(liveSessionId: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    const modelCandidates = getLiveModelCandidates(state.model);
    let latestError: unknown = null;

    for (const modelCandidate of modelCandidates) {
      const latestState = this.sessions.get(liveSessionId);
      if (!latestState || latestState.ended) return;

      latestState.model = modelCandidate;

      try {
        await this.connectWithOptionalResumption(liveSessionId, null, latestState.baseConfig);
        return;
      } catch (error) {
        latestError = error;
        logError("session.initial_connect_primary_failed", {
          liveSessionId,
          model: modelCandidate,
          message: toErrorMessage(error),
        });
      }

      try {
        await this.connectWithOptionalResumption(liveSessionId, null, latestState.fallbackConfig);
        return;
      } catch (fallbackError) {
        latestError = fallbackError;
        logError("session.initial_connect_fallback_failed", {
          liveSessionId,
          model: modelCandidate,
          message: toErrorMessage(fallbackError),
        });
      }

      if (!isUnsupportedModelError(latestError)) break;
    }

    const latest = this.sessions.get(liveSessionId);
    if (!latest || latest.ended) return;

    this.publish(latest, {
      type: "status",
      status: "ERROR",
      reason: latestError ? toErrorMessage(latestError) : "startup_failed",
    });
    await this.closeSession(liveSessionId, "startup_failed");
  }

  private async connectWithOptionalResumption(
    liveSessionId: string,
    resumeHandle: string | null,
    baseConfig: LiveConnectConfig,
  ) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    const config = withResumptionHandle(baseConfig, resumeHandle);
    let opened = false;

    const connection = await getGeminiLive().live.connect({
      model: state.model,
      config,
      callbacks: {
        onopen: () => {
          opened = true;
          this.markSessionActiveWhenReady(liveSessionId);
        },
        onmessage: (message) => {
          this.handleServerMessage(liveSessionId, message);
        },
        onerror: (errorEvent) => {
          const latest = this.sessions.get(liveSessionId);
          if (!latest || latest.ended) return;
          logError("session.connection_error", {
            liveSessionId,
            message: toErrorMessage(errorEvent.error),
          });
        },
        onclose: (closeEvent) => {
          void this.handleConnectionClosed(liveSessionId, closeEvent);
        },
      },
    });

    const latest = this.sessions.get(liveSessionId);
    if (!latest || latest.ended) {
      connection.close();
      return;
    }

    latest.connection = connection;
    latest.updatedAt = Date.now();
    latest.activeConfig = baseConfig;

    if (opened) {
      this.markSessionActiveWhenReady(liveSessionId);
    }
  }

  private markSessionActiveWhenReady(liveSessionId: string) {
    const latest = this.sessions.get(liveSessionId);
    if (!latest || latest.ended || !latest.connection) return;
    if (latest.status === "ACTIVE") return;

    latest.status = "ACTIVE";
    latest.updatedAt = Date.now();
    latest.reconnectAttempts = 0;
    this.publish(latest, { type: "status", status: "ACTIVE" });

    logInfo("session.connected", { liveSessionId, speakSessionId: latest.speakSessionId });
  }

  private shouldAcceptAssistantOutput(state: LiveSessionState) {
    if (state.assistantTurnInProgress) return true;
    if (state.discardAssistantTurn) return false;

    // A provider transcript is not evidence that the learner spoke.
    if (state.audibleInputWindows < MIN_AUDIBLE_WINDOWS) {
      state.discardAssistantTurn = true;
      logInfo("voice.assistant_turn_blocked_no_user_input", { liveSessionId: state.id });
      return false;
    }

    this.closeUserTurn(state, "assistant_started");
    state.assistantTurnInProgress = true;
    state.turnCounter += 1;
    state.currentAssistantTurnId = `t-${state.id}-${state.turnCounter}`;
    const language = requestedSpokenSupport(state.latestAudibleTranscript);
    const opening = language ? supportOpener(language) : null;
    if (opening) {
      state.assistantSupportReplied = true;
      this.clearPendingAssistantFinalTimer(state);
      state.pendingAssistantTranscript = null;
      for (const audio of opening.audio) this.publish(state, { type: "assistant_audio", ...audio });
      this.publish(state, {
        type: "transcript",
        speaker: "AI",
        text: opening.text,
        final: true,
        turnId: state.currentAssistantTurnId,
        source: "assistant_text",
      });
      this.finalizeAssistantTranscript(state.id, opening.text);
      logInfo("voice.support_opening", { liveSessionId: state.id, language });
    }
    return true;
  }

  private markAssistantTurnComplete(state: LiveSessionState) {
    this.closeUserTurn(state, "assistant_started");
    state.assistantTurnInProgress = false;
    state.audibleInputWindows = 0;
    state.userTranscriptClosed = false;
    state.latestAudibleTranscript = "";
    state.assistantSupportReplied = false;
    state.currentUserTurnId = null;
  }

  private handleServerMessage(liveSessionId: string, message: LiveServerMessage) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    state.updatedAt = Date.now();

    const resumption = message.sessionResumptionUpdate;
    if (resumption?.newHandle && resumption.resumable) {
      state.resumptionHandle = resumption.newHandle;
    }

    if (message.goAway) {
      this.publish(state, { type: "go_away", timeLeft: message.goAway.timeLeft ?? null });
      logInfo("session.go_away", { liveSessionId, timeLeft: message.goAway.timeLeft ?? null });
      void this.reconnectSession(liveSessionId, "go_away");
      return;
    }

    const serverContent = message.serverContent;
    if (!serverContent) return;

    const rawUserChunk = serverContent.inputTranscription?.text ?? "";
    const wrongScript = rawUserChunk.trim() ? isLikelyWrongScriptTranscript(rawUserChunk) : false;
    const transcriptWarning = wrongScript ? "TRANSCRIPT_SCRIPT_UNCERTAIN" : undefined;

    if (wrongScript) {
      logInfo("voice.transcript_flagged_wrong_script", { liveSessionId, textLength: rawUserChunk.length });
    }

    if (rawUserChunk.trim() && state.audibleInputWindows >= MIN_AUDIBLE_WINDOWS && !state.userTranscriptClosed) {
      if (!state.pendingUserTranscript) {
        state.turnCounter += 1;
        state.currentUserTurnId = `t-${state.id}-${state.turnCounter}`;
      }

      state.pendingUserTranscript = mergeStreamingTranscript(state.pendingUserTranscript, rawUserChunk);
      const normalizedUserTranscript = normalizeTranscriptText(state.pendingUserTranscript);
      state.latestAudibleTranscript = normalizedUserTranscript;
      const isExplicitFinal = Boolean(serverContent.inputTranscription?.finished);
      this.publish(state, {
        type: "transcript",
        speaker: "USER",
        text: normalizedUserTranscript,
        final: isExplicitFinal,
        turnId: state.currentUserTurnId ?? undefined,
        source: "user_transcription",
        warning: transcriptWarning,
      });

      if (isExplicitFinal) {
        this.clearPendingUserFinalTimer(state);
        state.pendingUserTranscript = null;
        state.userTranscriptClosed = true;
        void this.finalizeUserTranscript(liveSessionId, normalizedUserTranscript, state.currentUserTurnId);
      } else if (serverContent.turnComplete && isStableEnoughForFallbackFinalization(normalizedUserTranscript)) {
        this.scheduleFallbackUserTranscriptFinalization(liveSessionId, state.pendingUserTranscript);
      } else if (serverContent.turnComplete) {
        logInfo("voice.transcript_finalization_deferred_or_skipped", {
          liveSessionId,
          textLength: normalizedUserTranscript.length,
        });
      }
    } else if (
      serverContent.turnComplete &&
      state.pendingUserTranscript &&
      isStableEnoughForFallbackFinalization(normalizeTranscriptText(state.pendingUserTranscript))
    ) {
      this.scheduleFallbackUserTranscriptFinalization(liveSessionId, state.pendingUserTranscript);
    }

    const modelParts = (serverContent.modelTurn?.parts ?? []).filter((part) => !part.thought);
    const hasAssistantPayload =
      Boolean(serverContent.outputTranscription?.text?.trim()) ||
      modelParts.some((part) => {
        const text = part.text?.trim();
        const audioData = part.inlineData?.data;
        const audioMimeType = part.inlineData?.mimeType;
        return Boolean(text || (audioData && audioMimeType && audioMimeType.toLowerCase().startsWith("audio/")));
      });

    if (hasAssistantPayload && !this.shouldAcceptAssistantOutput(state)) {
      if (serverContent.turnComplete) state.discardAssistantTurn = false;
      return;
    }

    if (state.assistantSupportReplied) {
      // Gemini still sees the whole turn. The learner hears the prepared answer once.
      if (serverContent.turnComplete) this.completeAssistantOutput(state);
      return;
    }

    const rawAiChunk = serverContent.outputTranscription?.text ?? "";
    if (rawAiChunk.trim()) {
      this.clearPendingAssistantFinalTimer(state);
      state.pendingAssistantTranscript = mergeStreamingTranscript(state.pendingAssistantTranscript, rawAiChunk);
      const normalizedAiTranscript = normalizeTranscriptText(state.pendingAssistantTranscript);
      const isExplicitFinal = Boolean(serverContent.outputTranscription?.finished);

      this.publish(state, {
        type: "transcript",
        speaker: "AI",
        text: normalizedAiTranscript,
        final: isExplicitFinal,
        turnId: state.currentAssistantTurnId ?? undefined,
        source: "output_transcription",
      });

      if (isExplicitFinal) {
        this.clearPendingAssistantFinalTimer(state);
        state.pendingAssistantTranscript = null;
        this.finalizeAssistantTranscript(liveSessionId, normalizedAiTranscript);
      } else if (serverContent.turnComplete) {
        this.scheduleFallbackAssistantTranscriptFinalization(liveSessionId, state.pendingAssistantTranscript);
      }
    } else if (serverContent.turnComplete && state.pendingAssistantTranscript) {
      this.scheduleFallbackAssistantTranscriptFinalization(liveSessionId, state.pendingAssistantTranscript);
    }

    for (const part of modelParts) {
      const text = part.text?.trim();
      if (text) {
        if (!state.pendingAssistantTranscript) {
          state.pendingAssistantTranscript = text;
        }
        this.publish(state, {
          type: "transcript",
          speaker: "AI",
          text,
          final: true,
          turnId: state.currentAssistantTurnId ?? undefined,
          source: "assistant_text",
        });
      }

      const audioData = part.inlineData?.data;
      const audioMimeType = part.inlineData?.mimeType;
      if (audioData && audioMimeType && audioMimeType.toLowerCase().startsWith("audio/")) {
        this.publish(state, { type: "assistant_audio", mimeType: audioMimeType, data: audioData });
      }
    }

    if (serverContent.turnComplete) this.completeAssistantOutput(state);
  }

  private completeAssistantOutput(state: LiveSessionState) {
    state.discardAssistantTurn = false;
    if (!state.assistantTurnInProgress) return;
    this.markAssistantTurnComplete(state);
    this.publish(state, { type: "assistant_turn_complete" });
  }

  private clearPendingUserFinalTimer(state: LiveSessionState) {
    if (state.pendingUserFinalTimer) {
      clearTimeout(state.pendingUserFinalTimer);
      state.pendingUserFinalTimer = null;
    }
  }

  private clearPendingAssistantFinalTimer(state: LiveSessionState) {
    if (state.pendingAssistantFinalTimer) {
      clearTimeout(state.pendingAssistantFinalTimer);
      state.pendingAssistantFinalTimer = null;
    }
  }

  private scheduleFallbackUserTranscriptFinalization(liveSessionId: string, transcript: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    this.clearPendingUserFinalTimer(state);

    state.pendingUserFinalTimer = setTimeout(() => {
      const latest = this.sessions.get(liveSessionId);
      if (!latest || latest.ended || latest.pendingUserTranscript !== transcript) return;

      latest.pendingUserFinalTimer = null;
      this.closeUserTurn(latest, "fallback");
    }, LIVE_FALLBACK_FINAL_DELAY_MS);
  }

  // The learner's turn is over once the coach answers or the fallback timer fires.
  private closeUserTurn(state: LiveSessionState, reason: "fallback" | "assistant_started") {
    const pending = state.pendingUserTranscript;
    if (!pending) return;

    this.clearPendingUserFinalTimer(state);
    state.pendingUserTranscript = null;
    state.userTranscriptClosed = true;
    const text = normalizeTranscriptText(pending);
    if (!text) return;

    this.publish(state, {
      type: "transcript",
      speaker: "USER",
      text,
      final: true,
      turnId: state.currentUserTurnId ?? undefined,
      source: "user_transcription",
    });

    logInfo("voice.transcript_finalized", { liveSessionId: state.id, reason, textLength: text.length });

    void this.finalizeUserTranscript(state.id, text, state.currentUserTurnId);
  }

  private scheduleFallbackAssistantTranscriptFinalization(liveSessionId: string, transcript: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    this.clearPendingAssistantFinalTimer(state);

    state.pendingAssistantFinalTimer = setTimeout(() => {
      const latest = this.sessions.get(liveSessionId);
      if (!latest || latest.ended || latest.pendingAssistantTranscript !== transcript) return;

      latest.pendingAssistantFinalTimer = null;
      latest.pendingAssistantTranscript = null;
      const text = normalizeTranscriptText(transcript);
      this.publish(latest, {
        type: "transcript",
        speaker: "AI",
        text,
        final: true,
        turnId: latest.currentAssistantTurnId ?? undefined,
        source: "output_transcription",
      });

      logInfo("voice.assistant_transcript_fallback_finalized", { liveSessionId, textLength: text.length });

      this.finalizeAssistantTranscript(liveSessionId, text);
    }, LIVE_ASSISTANT_FALLBACK_FINAL_DELAY_MS);
  }

  private async finalizeUserTranscript(liveSessionId: string, text: string, turnId: string | null) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    // With no support language, a turn that is not English is skipped so the
    // learner gets a hint instead of a correction on broken text.
    if (state.supportLanguage === "en" && !isUsableEnglishTranscript(text)) {
      logInfo("voice.transcript_skipped_not_english", { liveSessionId, textLength: text.length });
      this.publish(state, { type: "transcript_skipped", reason: "not_english" });
      return;
    }

    const accepted = this.acceptFinalTranscript(state, "USER", text);
    if (!accepted) return;

    if (!isUsableEnglishTranscript(accepted)) {
      logInfo("voice.correction_skipped_transcript_guard", { liveSessionId });
      return;
    }

    // Recent coach lines let the judge accept short, fitting answers like "Yes".
    const recentAiContext = state.recentAiFinalTranscripts.slice(-3).map((item) => item.text);

    try {
      const correction = await judgeSpeakTurn({
        userId: state.userId,
        text: accepted,
        supportLanguage: state.supportLanguage,
        conversationContext: recentAiContext.length > 0 ? recentAiContext : undefined,
      });

      if (!correction) {
        logInfo("voice.correction_skipped", { liveSessionId });
        return;
      }

      const latest = this.sessions.get(liveSessionId);
      if (!latest || latest.ended) return;

      const id = randomUUID();
      this.publish(latest, { type: "correction", turnId: turnId ?? undefined, correction: { id, ...correction } });
      logInfo("voice.correction_created", { liveSessionId, correctionId: id });
    } catch (error) {
      logError("voice.correction_failed", { liveSessionId, message: toErrorMessage(error) });
    }
  }

  private finalizeAssistantTranscript(liveSessionId: string, text: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;
    this.acceptFinalTranscript(state, "AI", text);
  }

  // Live transcript streams may resend near-identical final updates; a short
  // recent window keeps them from running a correction twice.
  private acceptFinalTranscript(state: LiveSessionState, role: "USER" | "AI", text: string): string | null {
    const normalizedText = normalizeTranscriptText(text);

    if (normalizedText.length < LIVE_MIN_TRANSCRIPT_LENGTH) {
      logInfo("voice.transcript_skipped_short", { liveSessionId: state.id, role });
      return null;
    }

    const now = Date.now();
    const recent = role === "USER" ? state.recentUserFinalTranscripts : state.recentAiFinalTranscripts;

    if (isRecentDuplicate(recent, normalizedText, now)) {
      logInfo("voice.transcript_duplicate_avoided", { liveSessionId: state.id, role });
      return null;
    }

    pushRecentTranscript(recent, normalizedText, now);
    return normalizedText;
  }

  private logActivityRequest(state: LiveSessionState, type: "start" | "end", userId: string) {
    logInfo("session.activity_request", {
      liveSessionId: state.id,
      userId,
      type,
      status: state.status,
      turnMode: state.turnMode,
      ended: state.ended,
      hasConnection: Boolean(state.connection),
    });
  }

  private async handleConnectionClosed(liveSessionId: string, closeEvent: CloseEvent) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    state.connection = null;
    state.updatedAt = Date.now();

    logInfo("session.closed", {
      liveSessionId,
      code: closeEvent.code,
      reason: closeEvent.reason || null,
      wasClean: closeEvent.wasClean,
    });

    if (state.stopRequested) {
      await this.closeSession(liveSessionId, "stopped_by_user");
      return;
    }

    if (isUnsupportedModelMessage(closeEvent.reason)) {
      const switched = await this.tryReconnectWithFallbackModel(liveSessionId);
      if (switched) return;

      this.publish(state, { type: "status", status: "ERROR", reason: "live_model_unsupported" });
      await this.closeSession(liveSessionId, "live_model_unsupported");
      return;
    }

    await this.reconnectSession(liveSessionId, "connection_closed");
  }

  private async tryReconnectWithFallbackModel(liveSessionId: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return false;

    const candidates = getLiveModelCandidates(GEMINI_LIVE_MODEL);
    const currentIndex = candidates.indexOf(toModelResource(state.model));
    if (currentIndex < 0 || currentIndex >= candidates.length - 1) return false;

    this.publish(state, { type: "status", status: "RECONNECTING", reason: "model_fallback" });
    state.status = "RECONNECTING";

    for (let i = currentIndex + 1; i < candidates.length; i += 1) {
      const nextModel = candidates[i];
      if (!nextModel) continue;
      state.model = nextModel;

      logInfo("session.model_fallback_attempt", { liveSessionId, model: nextModel });

      try {
        await this.connectWithOptionalResumption(liveSessionId, null, state.baseConfig);
        return true;
      } catch (error) {
        logError("session.model_fallback_primary_failed", {
          liveSessionId,
          model: nextModel,
          message: toErrorMessage(error),
        });
      }

      try {
        await this.connectWithOptionalResumption(liveSessionId, null, state.fallbackConfig);
        return true;
      } catch (fallbackError) {
        logError("session.model_fallback_secondary_failed", {
          liveSessionId,
          model: nextModel,
          message: toErrorMessage(fallbackError),
        });
      }
    }

    return false;
  }

  private async reconnectSession(liveSessionId: string, reason: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    if (state.reconnectPromise) {
      await state.reconnectPromise;
      return;
    }

    state.reconnectPromise = (async () => {
      if (!state.resumptionHandle) {
        // On bad networks the handle can arrive late. Wait briefly, then start
        // a fresh connection rather than ending the conversation.
        logInfo("session.reconnect_handle_not_yet_available", { liveSessionId, reason });
        await wait(2000);

        const latest = this.sessions.get(liveSessionId);
        if (!latest || latest.ended) return;

        if (!latest.resumptionHandle) {
          logInfo("session.reconnect_handle_still_unavailable", { liveSessionId });
          try {
            await this.connectInitialSession(liveSessionId);
            return;
          } catch {
            this.publish(latest, { type: "status", status: "ERROR", reason: "resumption_unavailable" });
            await this.closeSession(liveSessionId, "resumption_unavailable");
            return;
          }
        }
      }

      this.publish(state, { type: "status", status: "RECONNECTING", reason });
      state.status = "RECONNECTING";

      while (state.reconnectAttempts < LIVE_RECONNECT_MAX_ATTEMPTS && !state.ended) {
        state.reconnectAttempts += 1;
        const attempt = state.reconnectAttempts;
        logInfo("session.reconnect_attempt", { liveSessionId, attempt });

        try {
          await this.connectWithOptionalResumption(liveSessionId, state.resumptionHandle, state.activeConfig);
          return;
        } catch (error) {
          logError("session.reconnect_failed", { liveSessionId, attempt, message: toErrorMessage(error) });
          await wait(LIVE_RECONNECT_BASE_DELAY_MS * attempt);
        }
      }

      this.publish(state, { type: "status", status: "ERROR", reason: "reconnect_failed" });
      await this.closeSession(liveSessionId, "reconnect_failed");
    })().finally(() => {
      const latest = this.sessions.get(liveSessionId);
      if (latest) latest.reconnectPromise = null;
    });

    await state.reconnectPromise;
  }

  private async closeSession(liveSessionId: string, reason: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state || state.ended) return;

    state.stopRequested = true;
    state.ended = true;
    state.status = "ENDED";
    state.updatedAt = Date.now();
    this.clearPendingUserFinalTimer(state);
    this.clearPendingAssistantFinalTimer(state);

    try {
      state.connection?.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // The socket may already be closed.
    }

    try {
      state.connection?.close();
    } catch {
      // The socket may already be closed.
    }

    state.connection = null;

    this.publish(state, { type: "status", status: "ENDED", reason });

    if (this.activeSessionByUser.get(state.userId) === state.id) {
      this.activeSessionByUser.delete(state.userId);
    }

    void getPrisma()
      .speakSession.updateMany({
        where: { id: state.speakSessionId, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      })
      .catch((error: unknown) => {
        logError("session.end_record_failed", { liveSessionId, message: toErrorMessage(error) });
      });

    logInfo("session.ended", { liveSessionId, reason });
  }

  private async cleanupSessions() {
    const now = Date.now();

    for (const state of this.sessions.values()) {
      if (state.ended && now - state.updatedAt > LIVE_CLEANUP_INTERVAL_MS * 4) {
        this.removeSession(state.id);
        continue;
      }

      if (state.ended) continue;

      if (now > state.expiresAt) {
        await this.closeSession(state.id, "session_timeout");
        continue;
      }

      if (now - state.updatedAt > LIVE_SESSION_IDLE_TIMEOUT_MS) {
        await this.closeSession(state.id, "session_idle_timeout");
      }
    }
  }

  // Live sessions only live in this process. Rows left open by a restart are closed here.
  private async cleanupOrphanSessions() {
    try {
      const result = await getPrisma().speakSession.updateMany({
        where: {
          status: "ACTIVE",
          createdAt: { lt: new Date(Date.now() - LIVE_SESSION_MAX_AGE_MS) },
        },
        data: { status: "ENDED", endedAt: new Date() },
      });
      if (result.count > 0) {
        logInfo("session.orphans_closed", { count: result.count });
      }
    } catch (error) {
      logError("session.orphan_cleanup_failed", { message: toErrorMessage(error) });
    }
  }

  private publish(state: LiveSessionState, event: LiveRelayEvent) {
    // Realtime audio, turn markers and transcripts are not replayed to a
    // reconnecting stream: the screen keeps its own transcript, and a replay
    // would duplicate learner turns.
    if (event.type !== "assistant_audio" && event.type !== "assistant_turn_complete" && event.type !== "transcript") {
      state.eventHistory.push(event);
      if (state.eventHistory.length > LIVE_EVENT_HISTORY_LIMIT) {
        state.eventHistory.splice(0, state.eventHistory.length - LIVE_EVENT_HISTORY_LIMIT);
      }
    }

    for (const notify of state.subscribers.values()) {
      notify(event);
    }
  }

  private removeSession(liveSessionId: string) {
    const state = this.sessions.get(liveSessionId);
    if (!state) return;

    this.sessions.delete(liveSessionId);
    if (this.activeSessionByUser.get(state.userId) === state.id) {
      this.activeSessionByUser.delete(state.userId);
    }
  }

  private getOwnedSession(liveSessionId: string, userId: string) {
    const state = this.sessions.get(liveSessionId);

    if (!state) {
      throw new LiveSessionManagerError("LIVE_SESSION_NOT_FOUND", "Live session not found.");
    }

    if (state.userId !== userId) {
      throw new LiveSessionManagerError("LIVE_SESSION_FORBIDDEN", "You do not have access to this live session.");
    }

    return state;
  }
}

// Sessions are in-memory, so the manager must survive dev hot reloads, and the
// deployment must keep one live conversation on one server process.
const globalForLive = globalThis as unknown as { lisaneLiveSessionManager?: LiveSessionManager };

export const liveSessionManager = globalForLive.lisaneLiveSessionManager ?? new LiveSessionManager();

if (process.env.NODE_ENV !== "production") {
  globalForLive.lisaneLiveSessionManager = liveSessionManager;
}
