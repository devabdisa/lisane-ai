import { getAppUser } from "@/lib/require-app-user";
import { lessonRecordingMaxBytes, lessonSpeechRequestSchema } from "@/schemas/lesson-speech";
import { AI_RATE_LIMIT_RULES } from "@/server/ai/usage-guardrails";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { transcribeLessonSentence } from "@/server/services/learn/lesson-speech";

const privateResponse = { "Cache-Control": "private, no-store" };

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: privateResponse });
}

async function readRecording(request: Request) {
  if (!request.body || Number(request.headers.get("content-length")) > lessonRecordingMaxBytes) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > lessonRecordingMaxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return size > 0 && size % 2 === 0 ? Buffer.concat(chunks, size) : null;
}

export async function POST(request: Request, context: { params: Promise<{ unitId: string; levelId: string }> }) {
  const user = await getAppUser();
  if (!user) return errorResponse(401, "unauthenticated", "Sign in to continue this lesson.");

  const parsed = lessonSpeechRequestSchema.safeParse({
    ...await context.params,
    exerciseId: request.headers.get("x-exercise-id"),
    clientRequestId: request.headers.get("x-client-request-id"),
  });
  if (!parsed.success || request.headers.get("content-type") !== "application/octet-stream") {
    return errorResponse(400, "invalid_input", "Send a short lesson recording.");
  }

  const limited = enforceRouteRateLimit({
    request, userId: user.id, bucket: "learn-speech", ...AI_RATE_LIMIT_RULES.sttTranscription,
  });
  if (limited) return limited;

  const pcm = await readRecording(request).catch(() => null);
  if (!pcm) return errorResponse(400, "invalid_audio", "Send a short lesson recording.");

  try {
    const result = await transcribeLessonSentence({ userId: user.id, pcm, ...parsed.data });
    if (result.status === "missing") return errorResponse(404, "not_found", "That speaking question is not in this lesson.");
    if (result.status === "locked") return errorResponse(403, "locked", "Finish the step above before this one.");
    if (result.status === "transcribed") return Response.json({ transcript: result.transcript }, { headers: privateResponse });
    return errorResponse(422, "unclear_audio", "Try saying the sentence again.");
  } catch (error) {
    console.info("Lesson speech unavailable", { error: error instanceof Error ? error.name : "unknown" });
    return errorResponse(502, "speech_unavailable", "Try the recording again in a moment.");
  }
}
