import { getLocale } from "next-intl/server";
import { getLanguage } from "@/config/languages";
import { Brand } from "./brand";

async function PageHeader({ title }: { title: string }) {
  const language = getLanguage(await getLocale());

  return (
    <header className="flex flex-col gap-2 px-4 pt-6 pb-4">
      <div className="flex items-center justify-between gap-2">
        <Brand />
        <p lang={language.code} className="text-caption text-fg-muted">
          {language.nativeName}
        </p>
      </div>
      <h1 className="text-title font-semibold text-fg">{title}</h1>
    </header>
  );
}

export { PageHeader };
