import { getTranslations } from "next-intl/server";
import { SessionReview } from "@/components/speak/session-review";
import { PageHeader } from "@/components/shell/page-header";

export default async function SpeakReviewPage() {
  const t = await getTranslations("Speak");
  return (
    <>
      <PageHeader title={t("reviewTitle")} />
      <SessionReview />
    </>
  );
}
