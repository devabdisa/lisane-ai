"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentProducts, type PaymentProductId } from "@/config/plans";
import { cn } from "@/lib/cn";

function PlansChooser({
  remainingMinutes,
  plusUntil,
  schoolName,
  ownedCode,
}: {
  remainingMinutes: number;
  plusUntil: string | null;
  schoolName: string | null;
  ownedCode: string | null;
}) {
  const t = useTranslations("Plans");
  const locale = useLocale();
  const [selected, setSelected] = useState<PaymentProductId>("plus");
  const [organizationName, setOrganizationName] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const product = paymentProducts.find((item) => item.id === selected) ?? paymentProducts[0];

  async function pay() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          locale,
          organizationName: product.kind === "school" ? organizationName : undefined,
        }),
      });
      const body = await response.json().catch(() => null) as { checkoutUrl?: string } | null;
      if (!response.ok || !body?.checkoutUrl) {
        setMessage(t("payFailed"));
        return;
      }
      window.location.assign(body.checkoutUrl);
    } catch {
      setMessage(t("payFailed"));
    } finally {
      setPending(false);
    }
  }

  async function join() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/plans/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json().catch(() => null) as { name?: string } | null;
      setMessage(response.ok && body?.name ? t("joined", { name: body.name }) : t("joinFailed"));
    } catch {
      setMessage(t("joinFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-6">
      <p className="text-body text-fg-muted">
        {schoolName ? t("schoolActive", { name: schoolName }) : plusUntil ? t("plusActive") : t("freeLeft", { minutes: remainingMinutes })}
      </p>
      <fieldset className="flex flex-col gap-2.5" aria-label={t("title")}>
        {paymentProducts.map((item) => {
          const active = selected === item.id;
          return (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-16 border px-4 py-3",
                active ? "border-fg bg-field" : "border-line bg-card",
              )}
            >
              <input type="radio" name="plan" checked={active} onChange={() => setSelected(item.id)} className="sr-only" />
              <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", active ? "border-fg" : "border-fg-muted")}>
                {active ? <span className="size-2.5 rounded-full bg-fg" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-label font-semibold">{t(item.titleKey)}</span>
                  <span className="text-label font-semibold">{t("price", { amount: item.amountEtb })}</span>
                </span>
                <span className="mt-1 block text-caption text-fg-muted">{t(item.detailKey)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {product.kind === "school" ? (
        <label className="flex flex-col gap-2">
          <span className="text-label font-semibold">{t("schoolName")}</span>
          <Input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} autoComplete="organization" />
        </label>
      ) : null}
      {message ? <p role="status" className="text-label">{message}</p> : null}
      <Button type="button" width="full" disabled={pending || (product.kind === "school" && organizationName.trim().length < 2)} onClick={() => void pay()}>
        {pending ? t("paying") : t("pay")}
      </Button>
      {ownedCode ? <p className="text-label">{t("yourCode", { code: ownedCode })}</p> : null}
      <form
        className="flex flex-col gap-2 border-t border-line pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void join();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-label font-semibold">{t("joinLabel")}</span>
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" />
        </label>
        <Button type="submit" hierarchy="secondary" width="full" disabled={pending || code.trim().length < 4}>
          {t("join")}
        </Button>
      </form>
    </div>
  );
}

export { PlansChooser };
