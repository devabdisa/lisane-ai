import { getTranslations } from "next-intl/server";
import { PlaceholderScreen } from "@/components/shell/placeholder-screen";

export default async function SpeakPage() {
  const t = await getTranslations("Speak");
  return <PlaceholderScreen title={t("title")} description={t("description")} />;
}
