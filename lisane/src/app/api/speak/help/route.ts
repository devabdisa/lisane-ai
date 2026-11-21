import { getAppUser } from "@/lib/require-app-user";
import { SPEAK_HELP_MAX_BASE64_CHARS, speakHelpInputSchema } from "@/schemas/speak-help";
import { speechLanguage } from "@/server/addis/speech";
import { AI_RATE_LIMIT_RULES } from "@/server/ai/usage-guardrails";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { getProfile } from "@/server/services/profile/profile";
import { helpSayPhrase } from "@/server/services/speak/help-say";
import { invalidInputResponse, unauthenticatedResponse } from "@/server/speak/live-route-response";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  if (Number(request.headers.get("content-length")) > SPEAK_HELP_MAX_BASE64_CHARS + 256) {
    return invalidInputResponse("Keep the recording under ten seconds.");
  }
  const parsed = speakHelpInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse("Send a short voice recording.");

  const limited = enforceRouteRateLimit({
    request,
    userId: user.id,
    bucket: "speak-help",
    ...AI_RATE_LIMIT_RULES.recordedVoiceMessage,
  });
  if (limited) return limited;

  const profile = await getProfile(user.id);
  const supportLanguage = profile?.supportLanguage;
  if (!supportLanguage || !speechLanguage(supportLanguage)) {
    return invalidInputResponse("Choose a support language with voice help.");
  }

  try {
    const result = await helpSayPhrase({
      userId: user.id,
      supportLanguage,
      ...parsed.data,
      signal: request.signal,
    });
    if (result) return Response.json(result);
    return Response.json(
      { error: { code: "unclear_audio", message: "Try saying one clear sentence." } },
      { status: 422 },
    );
  } catch (error) {
    console.info("speak help failed", { reason: error instanceof Error ? error.name : "unknown" });
    return Response.json(
      { error: { code: "speak_help_unavailable", message: "Voice help is unavailable right now." } },
      { status: 502 },
    );
  }
}
