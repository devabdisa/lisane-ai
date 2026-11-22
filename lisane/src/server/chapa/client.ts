import "server-only";
import { requireEnv } from "@/lib/env";
import { isTestChapaKey, paymentMatches } from "@/lib/speaking-allowance";

const chapaBase = "https://api.chapa.co/v1";

export type ChapaVerification = { status: string; amount: number; currency: string; mode?: string };

export async function initializeChapa(params: {
  amount: number;
  email: string;
  firstName: string;
  lastName: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
  title: string;
}) {
  const response = await fetch(`${chapaBase}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("CHAPA_SECRET_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: String(params.amount),
      currency: "ETB",
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      tx_ref: params.txRef,
      callback_url: params.callbackUrl,
      return_url: params.returnUrl,
      customization: { title: params.title, description: "Lisane AI speaking time" },
    }),
  });
  const body = await response.json().catch(() => null) as { status?: string; data?: { checkout_url?: string } } | null;
  const checkoutUrl = body?.data?.checkout_url;
  if (!response.ok || body?.status !== "success" || !checkoutUrl) {
    throw new Error("Chapa could not start the payment.");
  }
  return checkoutUrl;
}

export async function verifyChapa(txRef: string): Promise<ChapaVerification | null> {
  const response = await fetch(`${chapaBase}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${requireEnv("CHAPA_SECRET_KEY")}` },
  });
  const body = await response.json().catch(() => null) as { data?: { status?: string; amount?: string | number; currency?: string; mode?: string } } | null;
  const data = body?.data;
  if (!response.ok || !data?.status) return null;
  return {
    status: data.status,
    amount: Number(data.amount),
    currency: data.currency ?? "",
    mode: data.mode,
  };
}

export function chapaAccepts(expectedAmount: number, actual: ChapaVerification) {
  return paymentMatches(
    { amount: expectedAmount, currency: "ETB" },
    actual,
    isTestChapaKey(requireEnv("CHAPA_SECRET_KEY")),
  );
}
