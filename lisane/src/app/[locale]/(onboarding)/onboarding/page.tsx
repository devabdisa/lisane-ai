import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireAppUser } from "@/lib/require-app-user";
import { getLearningPath } from "@/server/services/learn/get-learning-path";
import { getProfile } from "@/server/services/profile/profile";

async function OnboardingScreen() {
  const user = await requireAppUser();
  const profile = await getProfile(user.id);
  const path = profile?.onboardingCompleted ? null : await getLearningPath(user.id).catch(() => null);
  const firstUnit = path?.sections[0]?.units[0];
  return <OnboardingFlow profile={profile} firstUnit={firstUnit ? { title: firstUnit.title, language: firstUnit.guidebook.language } : null} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      <OnboardingScreen />
    </Suspense>
  );
}
