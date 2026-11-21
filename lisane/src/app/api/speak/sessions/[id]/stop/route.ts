import { getAppUser } from "@/lib/require-app-user";
import { stopSpeakSession } from "@/server/speak/live-session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const stopped = await stopSpeakSession(id, user.id);
  if (!stopped) {
    return Response.json(
      { error: { code: "session_not_found", message: "This speaking session has ended." } },
      { status: 404 },
    );
  }
  return new Response(null, { status: 204 });
}
