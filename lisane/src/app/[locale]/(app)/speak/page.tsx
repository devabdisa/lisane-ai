import { getTranslations } from "next-intl/server";
import { VoiceSession } from "@/components/speak/voice-session";
import { PageHeader } from "@/components/shell/page-header";

export default async function SpeakPage() {
  const t = await getTranslations("Speak");
  return (
    <>
      <PageHeader title={t("title")} />
      <VoiceSession />
    </>
  );
}
