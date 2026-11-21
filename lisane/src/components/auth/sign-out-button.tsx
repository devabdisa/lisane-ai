"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/i18n/navigation";

function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/login");
  }

  return (
    <Button type="button" hierarchy="secondary" width="full" disabled={pending} onClick={signOut}>
      {t("signOut")}
    </Button>
  );
}

export { SignOutButton };
