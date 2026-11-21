import { getAppUser } from "@/lib/require-app-user";
import { DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE, sendLiveAudioInputSchema } from "@/schemas/live";
import {
  invalidInputResponse,
  liveErrorResponse,
  unauthenticatedResponse,
} from "@/server/speak/live-route-response";
import { liveSessionManager } from "@/server/speak/live-session-manager";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  const parsed = sendLiveAudioInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse("Missing audio.");

  const { id } = await params;
  try {
    await liveSessionManager.sendAudio({
      liveSessionId: id,
      userId: user.id,
      audioBase64: parsed.data.audioBase64,
      audioMimeType: parsed.data.audioMimeType ?? DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE,
      audioStreamEnd: parsed.data.audioStreamEnd,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return liveErrorResponse(error, "Failed to send live audio.");
  }
}
