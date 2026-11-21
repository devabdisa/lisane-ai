import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";

// Temporary foundations preview (step 02). Replaced by the app shell in step 05.

const palette = [
  { name: "Midnight", hex: "#0B0F14", note: "The quiet canvas", swatch: "bg-midnight" },
  { name: "White", hex: "#FFFFFF", note: "Clear type + icons", swatch: "bg-white" },
  { name: "Lime", hex: "#B6F23A", note: "One deliberate accent", swatch: "bg-lime" },
];

const surfaces = [
  { label: "Canvas", swatch: "bg-canvas" },
  { label: "Surface 01", swatch: "bg-card" },
  { label: "Surface 02", swatch: "bg-field" },
  { label: "Surface 03", swatch: "bg-raised" },
];

const typeScale = [
  { size: "text-display font-semibold", en: "Speak with confidence.", am: "በራስ መተማመን ይናገሩ።", spec: "40 / 52" },
  { size: "text-title font-semibold", en: "Your voice matters.", am: "ድምፅዎ ዋጋ አለው።", spec: "28 / 40" },
  { size: "text-heading font-semibold", en: "A small step forward", am: "አንድ ትንሽ እርምጃ", spec: "20 / 32" },
  { size: "text-body", en: "Take your time. I am listening.", am: "ጊዜዎን ይውሰዱ። እየሰማሁ ነው።", spec: "16 / 28" },
  { size: "text-label font-medium", en: "Continue practising", am: "ልምምድዎን ይቀጥሉ", spec: "14 / 24" },
  { size: "text-caption", en: "Only you can see your practice.", am: "ልምምድዎን እርስዎ ብቻ ማየት ይችላሉ።", spec: "12 / 20" },
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
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-8 lg:px-16 lg:py-16">
      <header className="flex flex-col gap-6">
        <p className="text-caption font-semibold tracking-wide">LISANE AI / MIDNIGHT LIME / FOUNDATIONS</p>
        <p className="text-title font-semibold">
          <span lang="am" className="font-normal">ልሳኔ</span> · Lisane AI
        </p>
        <h1 className="text-title font-semibold sm:text-display">
          A quiet place.
          <br />
          A more confident voice.
        </h1>
        <p className="text-body text-fg-muted">
          Private English practice. A midnight canvas, a clear next step, and room to try again.
        </p>
        <ul className="flex flex-wrap gap-4">
          {["Private, not performative", "Progress, not perfection", "Clarity over decoration"].map((principle) => (
            <li key={principle} className="rounded-full bg-card px-4 py-2 text-label">
              {principle}
            </li>
          ))}
        </ul>
      </header>

      <section className="flex flex-col gap-6">
        <SectionHeading
          title="01 / Three colors. Clear intent."
          description="Dark by default. Every surface is derived from Midnight and White. Lime earns its place."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {palette.map((color) => (
            <div key={color.name} className="flex flex-col gap-4">
              <div className={`h-24 rounded-16 border border-line ${color.swatch}`} />
              <div>
                <p className="text-body font-semibold">{color.name}</p>
                <p className="text-caption text-fg-muted">
                  {color.hex} / {color.note}
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
              <p className="text-heading font-semibold">{theme === "dark" ? "Dark / Default" : "Light / Contrast-safe"}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {surfaces.map((surface) => (
                  <div key={surface.label} className="flex flex-col gap-2">
                    <div className={`h-12 rounded-8 border border-line ${surface.swatch}`} />
                    <p className="text-caption text-fg-muted">{surface.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-12 bg-accent-host p-4">
                <p className="text-label font-medium text-accent">Lime always meets Midnight.</p>
              </div>
              <Button hierarchy="primary" width="full">
                Start speaking
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading
          title="02 / Two scripts. One voice."
          description="Inter for English. Noto Sans Ethiopic for Amharic. Shared sizes, separate font-family variables."
        />
        <div className="flex flex-col gap-6">
          {typeScale.map((row) => (
            <div key={row.spec} className="grid gap-2 border-b border-line pb-6 lg:grid-cols-2 lg:gap-8">
              <p className={row.size}>{row.en}</p>
              <p lang="am" className={row.size.replace(/font-\w+/, "font-normal")}>
                {row.am}
              </p>
              <p className="text-caption text-fg-muted lg:col-span-2">{row.spec}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading
          title="04 / Clear next steps"
          description="Lime for the primary action. Outline for the alternative. Neutral focus and input surfaces."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Buttons</CardTitle>
            <div className="flex w-full flex-col gap-4 sm:max-w-[268px]">
              <Button width="full">Start speaking</Button>
              <Button hierarchy="secondary" width="full">
                Maybe later
              </Button>
            </div>
            <CardDescription>48px minimum height · Full radius · Editable label</CardDescription>
          </Card>
          <Card>
            <CardTitle>Text input</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:max-w-[356px]">
              <Label htmlFor="practice-topic">What would you like to practise?</Label>
              <Input id="practice-topic" placeholder="e.g. introducing yourself" />
              <FieldHint>Choose a topic that feels useful to you.</FieldHint>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
