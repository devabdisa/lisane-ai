"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import { cn } from "@/lib/cn";
import { TranscriptBubble } from "./transcript-panel";
import { emptyReview, loadReview, subscribeReview } from "./transcript-store";

function SessionReview() {
  const t = useTranslations("Speak");
  const review = useSyncExternalStore(subscribeReview, loadReview, emptyReview);
  const notes = review?.items.filter((item) => item.correction) ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
      {review ? (
        <>
          <p className="text-body text-fg-muted">{review.situation}</p>
          <div className="flex flex-col gap-3">
            {review.items.map((item) => <TranscriptBubble key={item.id} item={item} showCorrection={false} />)}
          </div>
          {notes.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-label font-medium">{t("reviewNotes")}</h2>
              {notes.map((item) => {
                const correction = item.correction;
                if (!correction) return null;
                const language = isLanguageCode(correction.supportLanguage)
                  ? getLanguage(correction.supportLanguage)
                  : null;
                return (
                  <div key={item.id} className="rounded-16 border border-line bg-card px-4 py-3 text-body">
                    <p className="text-caption text-fg-muted">{item.text}</p>
                    <p className="mt-1">{correction.corrected}</p>
                    <p
                      lang={language?.code}
                      className={cn("mt-2 text-label text-fg-muted", language && fontClassNames[language.font])}
                    >
                      {correction.explanation}
                    </p>
                  </div>
                );
              })}
            </section>
          ) : null}
        </>
      ) : (
        <p className="rounded-16 border border-line bg-card p-6 text-body text-fg-muted">{t("reviewEmpty")}</p>
      )}
      <Link
        href="/speak"
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-6 text-label font-semibold"
      >
        {t("reviewBack")}
      </Link>
    </div>
  );
}

export { SessionReview };
