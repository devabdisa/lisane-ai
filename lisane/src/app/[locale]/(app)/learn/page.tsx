import { getTranslations } from "next-intl/server";
import { RewardStrip } from "@/components/learn/gem-stone";
import { LearningPath } from "@/components/learn/learning-path";
import { PageHeader } from "@/components/shell/page-header";
import { requireAppUser } from "@/lib/require-app-user";
import { getLearningPath } from "@/server/services/learn/get-learning-path";
import { getLearnerReward } from "@/server/services/learn/lesson";

export default async function LearnPage() {
  const t = await getTranslations("Learn");
  const user = await requireAppUser();
  const [path, reward] = await Promise.all([getLearningPath(user.id), getLearnerReward(user.id)]);

  return (
    <>
      <PageHeader title={t("title")} />
      <RewardStrip {...reward} />
      <LearningPath path={path} />
    </>
  );
}
