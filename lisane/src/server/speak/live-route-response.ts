import "server-only";
import { LiveSessionManagerError } from "./live-session-manager";

const statusByCode: Record<LiveSessionManagerError["code"], number> = {
  LIVE_SESSION_NOT_FOUND: 404,
  LIVE_SESSION_FORBIDDEN: 403,
  LIVE_SESSION_NOT_ACTIVE: 409,
  LIVE_AUDIO_SEND_FAILED: 502,
  LIVE_SESSION_START_FAILED: 502,
};

export function unauthenticatedResponse() {
  return Response.json({ error: { code: "unauthenticated", message: "Sign in to continue." } }, { status: 401 });
}

export function invalidInputResponse(message: string) {
  return Response.json({ error: { code: "invalid_input", message } }, { status: 400 });
}

export function liveErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof LiveSessionManagerError) {
    return Response.json(
      { error: { code: error.code.toLowerCase(), message: error.message } },
      { status: statusByCode[error.code] },
    );
  }
  return Response.json({ error: { code: "live_failed", message: fallbackMessage } }, { status: 500 });
}
