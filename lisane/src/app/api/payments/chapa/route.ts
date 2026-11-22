import { chapaSignatureMatches } from "@/lib/chapa-signature";
import { requireEnv } from "@/lib/env";
import { grantVerifiedPayment } from "@/server/services/payments/payments";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-chapa-signature") ?? request.headers.get("chapa-signature");
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();
  if (!secret || !chapaSignatureMatches(raw, signature, secret)) {
    return Response.json({ error: { code: "invalid_signature", message: "The payment notice could not be verified." } }, { status: 401 });
  }

  let txRef = "";
  try {
    const body = JSON.parse(raw) as { tx_ref?: string; trx_ref?: string };
    txRef = body.tx_ref || body.trx_ref || "";
  } catch {
    txRef = "";
  }
  if (!txRef) {
    return Response.json({ error: { code: "invalid_input", message: "The payment notice had no reference." } }, { status: 400 });
  }

  requireEnv("CHAPA_SECRET_KEY");
  const result = await grantVerifiedPayment(txRef);
  if (result.status === "missing") {
    return Response.json({ error: { code: "not_found", message: "That payment is not in Lisane." } }, { status: 404 });
  }
  return Response.json({ received: true });
}
