import { getTranslations } from "next-intl/server";
import { PlaceholderScreen } from "@/components/shell/placeholder-screen";

export default async function LearnPage() {
  const t = await getTranslations("Learn");
  return <PlaceholderScreen title={t("title")} description={t("description")} />;
}
