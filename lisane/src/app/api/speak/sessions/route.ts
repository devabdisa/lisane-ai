import { getAppUser } from "@/lib/require-app-user";
import { AI_RATE_LIMIT_RULES } from "@/server/ai/usage-guardrails";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { startSpeakSession } from "@/server/speak/live-session";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const limited = enforceRouteRateLimit({
    request,
    userId: user.id,
    bucket: "speak-session",
    limit: 20,
    windowMs: AI_RATE_LIMIT_RULES.practiceMessage.windowMs,
  });
  if (limited) return limited;

  try {
    const session = await startSpeakSession(user.id);
    return Response.json(session);
  } catch {
    return Response.json(
      { error: { code: "speak_unavailable", message: "The coach could not be reached. Try again in a moment." } },
      { status: 503 },
    );
  }
}
