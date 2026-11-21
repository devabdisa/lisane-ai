import { getLocale } from "next-intl/server";
import { getLanguage } from "@/config/languages";

async function PageHeader({ title }: { title: string }) {
  const language = getLanguage(await getLocale());

  return (
    <header className="flex flex-col gap-2 px-4 pt-6 pb-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-start gap-2 text-fg">
          <span lang="am" className="font-ethiopic text-heading font-normal">
            ልሳኔ
          </span>
          <span lang="en" className="font-sans text-label font-semibold">
            · Lisane AI
          </span>
        </p>
        <p lang={language.code} className="text-caption text-fg-muted">
          {language.nativeName}
        </p>
      </div>
      <h1 className="text-title font-semibold text-fg">{title}</h1>
    </header>
  );
}

export { PageHeader };
