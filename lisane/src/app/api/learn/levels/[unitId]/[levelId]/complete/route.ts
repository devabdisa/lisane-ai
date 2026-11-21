import { getAppUser } from "@/lib/require-app-user";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { completeLessonLevel } from "@/server/services/learn/lesson";

const privateResponse = { "Cache-Control": "private, no-store" };
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: privateResponse });
}

export async function POST(request: Request, context: { params: Promise<{ unitId: string; levelId: string }> }) {
  const user = await getAppUser();
  if (!user) return errorResponse(401, "unauthenticated", "Sign in to save this lesson.");

  const limited = enforceRouteRateLimit({ request, userId: user.id, bucket: "learn-complete", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { unitId, levelId } = await context.params;
  if (!idPattern.test(unitId) || !idPattern.test(levelId)) {
    return errorResponse(400, "invalid_input", "That lesson could not be found.");
  }

  try {
    const result = await completeLessonLevel(user.id, unitId, levelId);
    if (result.status === "missing") return errorResponse(404, "not_found", "That step is not on your path.");
    if (result.status === "locked") return errorResponse(403, "locked", "Finish the step above before this one.");
    return Response.json({ completed: true }, { headers: privateResponse });
  } catch (error) {
    console.error("Lesson could not be saved", { error: error instanceof Error ? error.name : "unknown" });
    return errorResponse(500, "lesson_unavailable", "Try saving this lesson again in a moment.");
  }
}
