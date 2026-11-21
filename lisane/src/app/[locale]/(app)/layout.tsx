import type { ReactNode } from "react";
import { AppNav } from "@/components/shell/app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">{children}</div>
      <AppNav />
    </div>
  );
}
