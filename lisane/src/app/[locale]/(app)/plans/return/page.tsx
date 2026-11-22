import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { Link } from "@/i18n/navigation";
import { requireAppUser } from "@/lib/require-app-user";
import { getPrisma } from "@/server/db";
import { grantVerifiedPayment } from "@/server/services/payments/payments";

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string }> }) {
  const t = await getTranslations("Plans");
  const user = await requireAppUser();
  const { tx_ref: txRef } = await searchParams;
  const payment = txRef ? await getPrisma().payment.findUnique({ where: { txRef }, include: { organization: true } }) : null;
  const owned = payment?.userId === user.id;
  const result = owned && txRef ? await grantVerifiedPayment(txRef) : null;
  const school = owned && result?.status === "paid"
    ? await getPrisma().organization.findUnique({ where: { paymentId: payment.id } })
    : null;
  const confirmed = result?.status === "paid";

  return (
    <>
      <PageHeader title={t("returnTitle")} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-6">
        <Card>
          <p className="text-heading font-semibold">{confirmed ? t("returnPaid") : t("returnPending")}</p>
          {school ? <p className="text-body">{t("yourCode", { code: school.joinCode })}</p> : null}
          <Button asChild width="full">
            <Link href={confirmed ? "/speak" : "/plans"}>{confirmed ? t("startSpeaking") : t("backToPlans")}</Link>
          </Button>
        </Card>
      </main>
    </>
  );
}
