import { getAppUser } from "@/lib/require-app-user";
import type { LiveRelayEvent } from "@/schemas/live";
import { unauthenticatedResponse } from "@/server/speak/live-route-response";
import { liveSessionManager } from "@/server/speak/live-session-manager";

const PING_INTERVAL_MS = 15_000;

function toSsePayload(event: LiveRelayEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  const { id } = await params;
  const encoder = new TextEncoder();

  // A session that is gone fails the stream, so the browser keeps retrying
  // inside the screen's reconnect window instead of giving up on one blip.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const subscription = liveSessionManager.subscribe({
        liveSessionId: id,
        userId: user.id,
        onEvent: (event) => {
          try {
            controller.enqueue(encoder.encode(toSsePayload(event)));
          } catch {
            // The stream may already be closed.
          }
        },
      });

      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // The stream may already be closed.
        }
      }, PING_INTERVAL_MS);

      request.signal.addEventListener(
        "abort",
        () => {
          clearInterval(pingInterval);
          subscription.unsubscribe();
          try {
            controller.close();
          } catch {
            // The stream may already be closed.
          }
        },
        { once: true },
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
