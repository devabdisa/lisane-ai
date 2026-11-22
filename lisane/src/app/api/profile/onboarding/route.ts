import { getAppUser } from "@/lib/require-app-user";
import { onboardingSchema } from "@/schemas/profile";
import { completeOnboarding } from "@/server/services/profile/profile";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Onboarding answers were rejected", parsed.error.issues.map((issue) => issue.path.join(".") || "body"));
    return Response.json(
      { error: { code: "invalid_input", message: "Check your answers and try again." } },
      { status: 400 },
    );
  }

  try {
    const profile = await completeOnboarding(user.id, parsed.data);
    return Response.json(profile);
  } catch (error) {
    console.error("Onboarding could not be saved", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json(
      { error: { code: "onboarding_failed", message: "That did not save. Please try again." } },
      { status: 500 },
    );
  }
}
