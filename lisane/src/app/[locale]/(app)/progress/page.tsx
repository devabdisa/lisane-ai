import { getTranslations } from "next-intl/server";
import { PlaceholderScreen } from "@/components/shell/placeholder-screen";

export default async function ProgressPage() {
  const t = await getTranslations("Progress");
  return <PlaceholderScreen title={t("title")} description={t("description")} />;
}
