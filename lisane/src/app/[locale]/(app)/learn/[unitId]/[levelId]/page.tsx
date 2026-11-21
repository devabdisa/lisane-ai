import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/learn/lesson-player";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAppUser } from "@/lib/require-app-user";
import { getLessonPage } from "@/server/services/learn/lesson";

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function LessonPage({ params }: { params: Promise<{ unitId: string; levelId: string }> }) {
  const { unitId, levelId } = await params;
  if (!idPattern.test(unitId) || !idPattern.test(levelId)) notFound();

  const t = await getTranslations("Learn");
  const user = await requireAppUser();
  const result = await getLessonPage(user.id, unitId, levelId);
  if (result.status === "missing") notFound();
  if (result.status === "locked") {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-body text-fg-muted">{t("lockedHint")}</p>
        <Button asChild width="full">
          <Link href="/learn">{t("backToPath")}</Link>
        </Button>
      </div>
    );
  }

  return <LessonPlayer lesson={result.lesson} />;
}
