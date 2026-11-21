import { getAppUser } from "@/lib/require-app-user";
import { liveErrorResponse, unauthenticatedResponse } from "@/server/speak/live-route-response";
import { liveSessionManager } from "@/server/speak/live-session-manager";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  const { id } = await params;
  try {
    await liveSessionManager.stopSession({ liveSessionId: id, userId: user.id });
    return new Response(null, { status: 204 });
  } catch (error) {
    return liveErrorResponse(error, "Failed to stop voice session.");
  }
}
