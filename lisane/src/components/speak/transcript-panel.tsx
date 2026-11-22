"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { BrandMark } from "@/components/shell/brand";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import { cn } from "@/lib/cn";
import type { LiveCorrection } from "@/schemas/live";
import type { TranscriptItem } from "./transcript-store";

const correctionTypeKey = { GRAMMAR: "typeGrammar", VOCABULARY: "typeVocabulary", PHRASING: "typePhrasing" } as const;

export function TranscriptPanel({ items, expanded }: { items: TranscriptItem[]; expanded: boolean }) {
  const t = useTranslations("Speak");
  const scroll = useRef<HTMLDivElement>(null);
  const followsLatest = useRef(true);
  const visible = expanded ? items : items.slice(-3);

  useEffect(() => {
    followsLatest.current = true;
  }, [expanded]);

  useEffect(() => {
    const panel = scroll.current;
    if (panel && followsLatest.current) panel.scrollTop = panel.scrollHeight;
  }, [items, expanded]);

  return (
    <section className="w-full min-w-0 rounded-16 border border-line bg-canvas">
      <div className="border-b border-line px-3 py-2.5 sm:px-4">
        <h2 className="text-label font-semibold">{t("transcriptTitle")}</h2>
      </div>
      <div
        ref={scroll}
        tabIndex={0}
        role="region"
        aria-label={t("transcriptTitle")}
        onScroll={(event) => {
          const panel = event.currentTarget;
          followsLatest.current = panel.scrollHeight - panel.clientHeight - panel.scrollTop < 32;
        }}
        className={cn(
          "flex flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4",
          "focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-fg",
          expanded ? "max-h-[min(52dvh,28rem)]" : "max-h-64 sm:max-h-80",
        )}
      >
        {visible.length
          ? visible.map((item) => <TranscriptBubble key={item.id} item={item} />)
          : <p className="py-4 text-center text-label text-fg-muted">{t("startSayingHello")}</p>}
      </div>
    </section>
  );
}

export function TranscriptBubble({ item, showCorrection = true }: { item: TranscriptItem; showCorrection?: boolean }) {
  const t = useTranslations("Speak");
  const fromLearner = item.speaker === "USER";
  return (
    <div className={cn("flex min-w-0 items-start gap-2", fromLearner ? "justify-end" : "justify-start")}>
      {fromLearner ? null : <BrandMark className="mt-1 size-7 rounded-[0.55rem] text-caption" />}
      <div className={cn(
        "min-w-0 max-w-[86%] rounded-16 border border-line px-3 py-2 sm:px-4",
        fromLearner ? "rounded-tr-sm bg-raised" : "rounded-tl-sm bg-card",
      )}>
        <p className="text-caption font-semibold text-fg-muted">{fromLearner ? t("you") : t("coach")}</p>
        <p dir="auto" className={cn("whitespace-pre-wrap break-words text-body", !item.final && "text-fg-muted")}>{item.text}</p>
        {item.warning ? <p className="mt-1 text-caption text-fg-muted">{t("transcriptUncertain")}</p> : null}
        {showCorrection && item.correction ? <CorrectionNote correction={item.correction} /> : null}
      </div>
    </div>
  );
}

function CorrectionNote({ correction }: { correction: LiveCorrection }) {
  const t = useTranslations("Speak");
  const language = isLanguageCode(correction.supportLanguage) ? getLanguage(correction.supportLanguage) : null;
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-caption font-semibold text-fg-muted">
        {t("tryThis")} · {t(correctionTypeKey[correction.correctionType])}
      </p>
      <p lang="en" className="break-words text-label font-semibold">{correction.corrected}</p>
      <p lang={language?.code} className={cn("mt-1 text-label text-fg-muted", language && fontClassNames[language.font])}>
        {correction.explanation}
      </p>
    </div>
  );
}
