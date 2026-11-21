import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/shell/app-nav";
import { requireAppUser } from "@/lib/require-app-user";

async function SignedInShell({ children }: { children: ReactNode }) {
  await requireAppUser();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-28 md:pb-0">{children}</div>
      <AppNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}
