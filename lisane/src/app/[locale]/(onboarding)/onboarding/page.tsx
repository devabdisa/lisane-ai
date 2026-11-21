import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireAppUser } from "@/lib/require-app-user";
import { getProfile } from "@/server/services/profile/profile";

async function OnboardingScreen() {
  const user = await requireAppUser();
  const profile = await getProfile(user.id);
  return <OnboardingFlow profile={profile} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      <OnboardingScreen />
    </Suspense>
  );
}
