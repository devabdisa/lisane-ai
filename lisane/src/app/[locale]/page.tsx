import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";

// Temporary foundations preview. Replaced by the app shell in step 05.

const palette = [
  { name: "Midnight", hex: "#0B0F14", noteKey: "midnight", swatch: "bg-midnight" },
  { name: "White", hex: "#FFFFFF", noteKey: "white", swatch: "bg-white" },
  { name: "Lime", hex: "#B6F23A", noteKey: "lime", swatch: "bg-lime" },
] as const;

const surfaces = ["bg-card", "bg-field", "bg-raised"];

// Amharic specimens are sample content shown alongside English, not UI strings.
const typeScale = [
  { size: "text-display", weight: "font-semibold", en: "Speak with confidence.", am: "በራስ መተማመን ይናገሩ።", spec: "40 / 52" },
  { size: "text-title", weight: "font-semibold", en: "Your voice matters.", am: "ድምፅዎ ዋጋ አለው።", spec: "28 / 40" },
  { size: "text-heading", weight: "font-semibold", en: "A small step forward", am: "አንድ ትንሽ እርምጃ", spec: "20 / 32" },
  { size: "text-body", weight: "", en: "Take your time. I am listening.", am: "ጊዜዎን ይውሰዱ። እየሰማሁ ነው።", spec: "16 / 28" },
  { size: "text-label", weight: "font-medium", en: "Continue practising", am: "ልምምድዎን ይቀጥሉ", spec: "14 / 24" },
  { size: "text-caption", weight: "", en: "Only you can see your practice.", am: "ልምምድዎን እርስዎ ብቻ ማየት ይችላሉ።", spec: "12 / 20" },
];

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-heading font-semibold">{title}</h2>
      <p className="text-label text-fg-muted">{description}</p>
    </div>
  );
}

export default function FoundationsPreview() {
  const t = useTranslations("Foundations");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-8 lg:px-16 lg:py-16">
      <header className="flex flex-col gap-6">
        <p className="text-caption font-semibold tracking-wide">{t("eyebrow")}</p>
        <p className="text-title font-semibold">
          <span lang="am" className="font-ethiopic font-normal">ልሳኔ</span> · Lisane AI
        </p>
        <h1 className="text-title font-semibold sm:text-display">
          {t.rich("headline", { br: () => <br /> })}
        </h1>
        <p className="text-body text-fg-muted">{t("intro")}</p>
        <ul className="flex flex-wrap gap-4">
          {(["private", "progress", "clarity"] as const).map((key) => (
            <li key={key} className="rounded-full bg-card px-4 py-2 text-label">
              {t(`principles.${key}`)}
            </li>
          ))}
        </ul>
      </header>

      <section className="flex flex-col gap-6">
        <SectionHeading title={t("colors.title")} description={t("colors.description")} />
        <div className="grid gap-4 sm:grid-cols-3">
          {palette.map((color) => (
            <div key={color.name} className="flex flex-col gap-4">
              <div className={`h-24 rounded-16 border border-line ${color.swatch}`} />
              <div>
                <p className="text-body font-semibold">{color.name}</p>
                <p className="text-caption text-fg-muted">
                  {color.hex} / {t(`colors.${color.noteKey}`)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {(["dark", "light"] as const).map((theme) => (
            <div
              key={theme}
              data-theme={theme}
              className="flex flex-col gap-4 rounded-16 border border-line bg-canvas p-6 text-fg"
            >
              <p className="text-heading font-semibold">{t(`colors.${theme}`)}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <div className="h-12 rounded-8 border border-line bg-canvas" />
                  <p className="text-caption text-fg-muted">{t("colors.canvas")}</p>
                </div>
                {surfaces.map((swatch, index) => (
                  <div key={swatch} className="flex flex-col gap-2">
                    <div className={`h-12 rounded-8 border border-line ${swatch}`} />
                    <p className="text-caption text-fg-muted">
                      {t("colors.surface", { level: `0${index + 1}` })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-12 bg-accent-host p-4">
                <p className="text-label font-medium text-accent">{t("colors.accentRule")}</p>
              </div>
              <Button width="full">{t("controls.startSpeaking")}</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title={t("type.title")} description={t("type.description")} />
        <div className="flex flex-col gap-6">
          {typeScale.map((row) => (
            <div key={row.spec} className="grid gap-2 border-b border-line pb-6 lg:grid-cols-2 lg:gap-8">
              <p lang="en" className={`${row.size} ${row.weight}`}>{row.en}</p>
              <p lang="am" className={`font-ethiopic ${row.size}`}>{row.am}</p>
              <p className="text-caption text-fg-muted lg:col-span-2">{row.spec}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title={t("controls.title")} description={t("controls.description")} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardTitle>{t("controls.buttons")}</CardTitle>
            <div className="flex w-full flex-col gap-4 sm:max-w-[268px]">
              <Button width="full">{t("controls.startSpeaking")}</Button>
              <Button hierarchy="secondary" width="full">
                {t("controls.maybeLater")}
              </Button>
            </div>
            <CardDescription>{t("controls.buttonsNote")}</CardDescription>
          </Card>
          <Card>
            <CardTitle>{t("controls.textInput")}</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:max-w-[356px]">
              <Label htmlFor="practice-topic">{t("controls.topicLabel")}</Label>
              <Input id="practice-topic" placeholder={t("controls.topicPlaceholder")} />
              <FieldHint>{t("controls.topicHint")}</FieldHint>
            </div>
          </Card>
          <Card>
            <CardTitle>{t("controls.languageSwitcher")}</CardTitle>
            <LanguageSwitcher className="sm:max-w-[356px]" />
          </Card>
        </div>
      </section>
    </main>
  );
}
