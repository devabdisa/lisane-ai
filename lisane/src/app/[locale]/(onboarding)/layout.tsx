import { Suspense, type ReactNode } from "react";
import { requireAppUser } from "@/lib/require-app-user";

async function SignedIn({ children }: { children: ReactNode }) {
  await requireAppUser();
  return children;
}

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      <SignedIn>{children}</SignedIn>
    </Suspense>
  );
}
