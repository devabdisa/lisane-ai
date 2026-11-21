import { getTranslations } from "next-intl/server";
import { PlaceholderScreen } from "@/components/shell/placeholder-screen";

export default async function PracticePage() {
  const t = await getTranslations("Practice");
  return <PlaceholderScreen title={t("title")} description={t("description")} />;
}
