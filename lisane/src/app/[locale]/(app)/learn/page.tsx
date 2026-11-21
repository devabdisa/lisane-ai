import { getTranslations } from "next-intl/server";
import { LearningPath } from "@/components/learn/learning-path";
import { PageHeader } from "@/components/shell/page-header";
import { requireAppUser } from "@/lib/require-app-user";
import { getLearningPath } from "@/server/services/learn/get-learning-path";

export default async function LearnPage() {
  const t = await getTranslations("Learn");
  const user = await requireAppUser();
  const path = await getLearningPath(user.id);

  return (
    <>
      <PageHeader title={t("title")} />
      <LearningPath path={path} />
    </>
  );
}
