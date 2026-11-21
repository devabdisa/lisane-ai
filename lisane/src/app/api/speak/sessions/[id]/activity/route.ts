import { getAppUser } from "@/lib/require-app-user";
import { liveActivityInputSchema } from "@/schemas/live";
import {
  invalidInputResponse,
  liveErrorResponse,
  unauthenticatedResponse,
} from "@/server/speak/live-route-response";
import { liveSessionManager } from "@/server/speak/live-session-manager";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  const parsed = liveActivityInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse("Send start or end.");

  const { id } = await params;
  try {
    if (parsed.data.type === "start") {
      liveSessionManager.startUserActivity({ liveSessionId: id, userId: user.id });
    } else {
      liveSessionManager.endUserActivity({ liveSessionId: id, userId: user.id });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return liveErrorResponse(error, "Failed to update live activity.");
  }
}
