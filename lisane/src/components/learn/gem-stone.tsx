"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

function GemStone({ fill, className, label }: { fill: number; className?: string; label: string }) {
  const clipId = useId();
  const amount = Math.min(1, Math.max(0, fill));
  return (
    <svg viewBox="0 0 80 96" className={cn("size-16", className)} role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <polygon points="40,6 70,30 62,88 18,88 10,30" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="80" height="96" className="fill-white/15" />
        <rect y={88 - amount * 82} width="80" height="96" className="fill-accent" />
      </g>
      <polygon points="40,6 70,30 40,30 10,30" className="fill-white/25" />
      <polygon points="40,6 70,30 62,88 18,88 10,30" fill="none" className="stroke-white/70" strokeWidth="3" />
    </svg>
  );
}

function RewardStrip({ xp, streak, gems, gemInto, gemGoal, gemFill }: { xp: number; streak: number; gems: number; gemInto: number; gemGoal: number; gemFill: number }) {
  const t = useTranslations("Learn");
  return (
    <div className="mx-auto flex w-full max-w-sm items-center gap-3 px-4 pb-2">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-host">
        <GemStone fill={gemFill} className="size-10" label={t("gemLabel")} />
      </div>
      <div className="min-w-0">
        <p className="text-label font-semibold">{t("gemAmount", { into: gemInto, goal: gemGoal })}</p>
        <p className="text-caption text-fg-muted">{t("xpTotal", { count: xp })} · {t("gemCount", { count: gems })}{streak > 0 ? ` · ${t("streakCount", { count: streak })}` : ""}</p>
      </div>
    </div>
  );
}

export { GemStone, RewardStrip };
