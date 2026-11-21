import { getAppUser } from "@/lib/require-app-user";
import { ownsSpeakSession, subscribeSpeakSession, type SpeakEvent } from "@/server/speak/live-session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!ownsSpeakSession(id, user.id)) {
    return Response.json(
      { error: { code: "session_not_found", message: "This speaking session has ended." } },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SpeakEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      unsubscribe = subscribeSpeakSession(id, user.id, send);
      request.signal.addEventListener("abort", () => unsubscribe?.());
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
