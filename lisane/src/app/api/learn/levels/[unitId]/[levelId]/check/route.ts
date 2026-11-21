import { getAppUser } from "@/lib/require-app-user";
import { lessonAttemptSchema } from "@/schemas/lesson-attempt";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { checkLessonAnswer } from "@/server/services/learn/lesson";

const privateResponse = { "Cache-Control": "private, no-store" };
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: privateResponse });
}

export async function POST(request: Request, context: { params: Promise<{ unitId: string; levelId: string }> }) {
  const user = await getAppUser();
  if (!user) return errorResponse(401, "unauthenticated", "Sign in to continue this lesson.");

  const limited = enforceRouteRateLimit({ request, userId: user.id, bucket: "learn-check", limit: 180, windowMs: 60_000 });
  if (limited) return limited;

  const { unitId, levelId } = await context.params;
  if (!idPattern.test(unitId) || !idPattern.test(levelId)) {
    return errorResponse(400, "invalid_input", "That lesson could not be found.");
  }

  const body: unknown = await request.json().catch(() => null);
  const attempt = lessonAttemptSchema.safeParse(body);
  if (!attempt.success) return errorResponse(400, "invalid_input", "Choose an answer first.");

  try {
    const result = await checkLessonAnswer(user.id, unitId, levelId, attempt.data);
    if (result.status === "missing") return errorResponse(404, "not_found", "That question is not in this lesson.");
    if (result.status === "locked") return errorResponse(403, "locked", "Finish the step above before this one.");
    if (result.status === "invalid") return errorResponse(400, "invalid_input", "Choose an answer first.");
    return Response.json(
      { correct: result.correct, answer: result.answer, answerLanguage: result.answerLanguage },
      { headers: privateResponse },
    );
  } catch (error) {
    console.error("Lesson answer could not be checked", { error: error instanceof Error ? error.name : "unknown" });
    return errorResponse(500, "lesson_unavailable", "Try that answer again in a moment.");
  }
}
