import {
  startLiveSessionResponseSchema,
  type LiveTurnMode,
  type StartLiveSessionResponse,
} from "@/schemas/live";

export class LiveClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LiveClientError";
  }
}

export async function startLiveSession(params: {
  scenario?: string;
  customIdea?: string;
  turnMode?: LiveTurnMode;
}): Promise<StartLiveSessionResponse> {
  const response = await fetch("/api/speak/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new LiveClientError("REQUEST_FAILED", response.status);
  }

  return startLiveSessionResponseSchema.parse(await response.json());
}

export async function sendLiveActivitySignal(params: { liveSessionId: string; type: "start" | "end" }) {
  const response = await fetch(`/api/speak/sessions/${params.liveSessionId}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: params.type }),
  });

  if (!response.ok) {
    throw new LiveClientError("REQUEST_FAILED", response.status);
  }
}

export async function stopLiveSession(liveSessionId: string) {
  const response = await fetch(`/api/speak/sessions/${liveSessionId}/stop`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new LiveClientError("REQUEST_FAILED", response.status);
  }
}

export async function sendLiveAudioChunk(params: {
  liveSessionId: string;
  audioBase64?: string;
  audioMimeType?: string;
  audioStreamEnd?: boolean;
}) {
  const response = await fetch(`/api/speak/sessions/${params.liveSessionId}/audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64: params.audioBase64,
      audioMimeType: params.audioMimeType,
      audioStreamEnd: params.audioStreamEnd,
    }),
  });

  if (!response.ok) {
    throw new LiveClientError("REQUEST_FAILED", response.status);
  }
}
