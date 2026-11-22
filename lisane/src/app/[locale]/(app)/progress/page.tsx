import { getTranslations } from "next-intl/server";
import { GemStone } from "@/components/learn/gem-stone";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { requireAppUser } from "@/lib/require-app-user";
import { getProgressSummary } from "@/server/services/learn/lesson";

export default async function ProgressPage() {
  const t = await getTranslations("Progress");
  const learn = await getTranslations("Learn");
  const user = await requireAppUser();
  const progress = await getProgressSummary(user.id);

  return (
    <>
      <PageHeader title={t("title")} />
      <main className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 pb-6">
        <Card className="flex-row items-center">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-accent-host">
            <GemStone fill={progress.gemFill} className="size-12" label={learn("gemLabel")} />
          </div>
          <div className="min-w-0">
            <p className="text-heading font-semibold">{t("xpValue", { xp: progress.xp })}</p>
            <p className="text-label text-fg-muted">{learn("gemAmount", { into: progress.gemInto, goal: progress.gemGoal })}</p>
            <p className="text-caption text-fg-muted">{learn("gemCount", { count: progress.gems })}</p>
          </div>
        </Card>
        <dl className="grid grid-cols-2 gap-3">
          <Card>
            <dt className="text-caption text-fg-muted">{t("streakLabel")}</dt>
            <dd className="text-heading font-semibold">{progress.streak}</dd>
          </Card>
          <Card>
            <dt className="text-caption text-fg-muted">{t("lessonsLabel")}</dt>
            <dd className="text-heading font-semibold">{progress.lessonsDone}</dd>
          </Card>
          {progress.dailyGoalMinutes ? (
            <Card className="col-span-2">
              <dt className="text-caption text-fg-muted">{t("dailyGoalLabel")}</dt>
              <dd className="text-heading font-semibold">{t("dailyGoalMinutes", { count: progress.dailyGoalMinutes })}</dd>
            </Card>
          ) : null}
        </dl>
      </main>
    </>
  );
}
