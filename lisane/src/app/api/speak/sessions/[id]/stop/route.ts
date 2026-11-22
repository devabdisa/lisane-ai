import { getAppUser } from "@/lib/require-app-user";
import { SpeakingLimitError, assertSpeakingAllowance, recordSpeaking } from "@/server/services/payments/payments";
import { liveErrorResponse, unauthenticatedResponse } from "@/server/speak/live-route-response";
import { liveSessionManager } from "@/server/speak/live-session-manager";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  const { id } = await params;
  try {
    const usage = await liveSessionManager.stopSession({ liveSessionId: id, userId: user.id });
    const seconds = Math.min(30 * 60, Math.max(1, Math.round((Date.now() - usage.startedAt) / 1000)));
    await recordSpeaking(user.id, seconds);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof SpeakingLimitError) {
      return Response.json({ error: { code: "limit_reached", message: "Speaking time for today is used up." } }, { status: 402 });
    }
    return liveErrorResponse(error, "Failed to stop voice session.");
  }
}
