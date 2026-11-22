import { getTranslations } from "next-intl/server";
import { PlansChooser } from "@/components/plans/plans-chooser";
import { PageHeader } from "@/components/shell/page-header";
import { requireAppUser } from "@/lib/require-app-user";
import { getSpeakingStatus, ownedSchool } from "@/server/services/payments/payments";

export default async function PlansPage() {
  const t = await getTranslations("Plans");
  const user = await requireAppUser();
  const [status, school] = await Promise.all([getSpeakingStatus(user.id), ownedSchool(user.id)]);

  return (
    <>
      <PageHeader title={t("title")} />
      <PlansChooser
        remainingMinutes={Math.ceil(status.remainingSeconds / 60)}
        plusUntil={status.plusUntil}
        schoolName={status.schoolName}
        ownedCode={school?.joinCode ?? null}
      />
    </>
  );
}
