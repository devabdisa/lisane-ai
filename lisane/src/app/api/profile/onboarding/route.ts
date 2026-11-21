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
    return Response.json(
      { error: { code: "invalid_input", message: "Check your answers and try again." } },
      { status: 400 },
    );
  }

  const profile = await completeOnboarding(user.id, parsed.data);
  return Response.json(profile);
}
