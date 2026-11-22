import { isLanguageCode } from "@/config/languages";
import { getAppUser } from "@/lib/require-app-user";
import { startLiveSessionInputSchema } from "@/schemas/live";
import { AI_RATE_LIMIT_RULES } from "@/server/ai/usage-guardrails";
import { getPrisma } from "@/server/db";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { getProfile } from "@/server/services/profile/profile";
import { invalidInputResponse, unauthenticatedResponse } from "@/server/speak/live-route-response";
import { liveSessionManager } from "@/server/speak/live-session-manager";
import { SpeakingLimitError, assertSpeakingAllowance } from "@/server/services/payments/payments";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return unauthenticatedResponse();

  const parsed = startLiveSessionInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return invalidInputResponse("Choose a situation, or keep your own idea short.");

  const limited = enforceRouteRateLimit({
    request,
    userId: user.id,
    bucket: "live-session-start",
    ...AI_RATE_LIMIT_RULES.liveStart,
  });
  if (limited) return limited;

  try {
    await assertSpeakingAllowance(user.id);
  } catch (error) {
    if (error instanceof SpeakingLimitError) {
      return Response.json(
        { error: { code: "limit_reached", message: "Speaking time for today is used up." } },
        { status: 402 },
      );
    }
    throw error;
  }

  const profile = await getProfile(user.id).catch(() => null);
  const supportLanguage =
    profile?.supportLanguage && isLanguageCode(profile.supportLanguage) ? profile.supportLanguage : "en";
  const customIdea = parsed.data.customIdea ?? null;

  try {
    const row = await getPrisma().speakSession.create({ data: { userId: user.id } });
    const session = await liveSessionManager.startSession({
      userId: user.id,
      speakSessionId: row.id,
      scenario: customIdea ? null : (parsed.data.scenario ?? null),
      customIdea,
      supportLanguage,
      turnMode: parsed.data.turnMode,
      profile: profile
        ? { englishLevel: profile.englishLevel, goal: profile.goal, supportLanguage: profile.supportLanguage }
        : null,
    });
    return Response.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to start voice session:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: { code: "speak_unavailable", message: "The coach could not be reached. Try again in a moment." } },
      { status: 502 },
    );
  }
}
