import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot";
import { Card } from "@/components/ui/card";
import { PageHeader } from "./page-header";

async function PlaceholderScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const t = await getTranslations("Placeholder");

  return (
    <>
      <PageHeader title={title} />
      <main className="flex flex-1 flex-col gap-6 px-4 pb-4">
        <Card className="items-center text-center">
          <Mascot />
          <p className="text-label font-semibold">{t("status")}</p>
          <p className="text-body text-fg-muted">{description}</p>
        </Card>
        {children}
      </main>
    </>
  );
}

export { PlaceholderScreen };
