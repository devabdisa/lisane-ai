import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-grid size-9 shrink-0 place-items-center rounded-[0.7rem] border border-accent/30 bg-accent-host text-accent", className)}
    >
      <span className="font-ethiopic text-[1.35em] leading-none font-black">ል</span>
    </span>
  );
}

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-fg">
      <BrandMark />
      <span lang="en" className="font-sans text-body font-bold tracking-tight">Lisane AI</span>
    </span>
  );
}
