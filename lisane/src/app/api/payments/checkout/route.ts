import { getAppUser } from "@/lib/require-app-user";
import { uiLocales } from "@/config/languages";
import { paymentProduct } from "@/config/plans";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { startCheckout } from "@/server/services/payments/payments";
import { z } from "zod";

const bodySchema = z.object({
  productId: z.string(),
  locale: z.string(),
  organizationName: z.string().trim().min(2).max(80).optional(),
});

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: { code: "unauthenticated", message: "Sign in to continue." } }, { status: 401 });
  }
  const limited = enforceRouteRateLimit({ request, userId: user.id, bucket: "payment-checkout", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const product = parsed.success ? paymentProduct(parsed.data.productId) : null;
  if (!parsed.success || !product || !uiLocales.includes(parsed.data.locale as (typeof uiLocales)[number])) {
    return Response.json({ error: { code: "invalid_input", message: "Choose a plan and try again." } }, { status: 400 });
  }

  const result = await startCheckout({
    userId: user.id,
    email: user.email,
    name: user.name,
    productId: product.id,
    locale: parsed.data.locale,
    organizationName: parsed.data.organizationName,
  });
  if (result.status === "invalid") {
    return Response.json({ error: { code: "invalid_input", message: "Add the school name and try again." } }, { status: 400 });
  }
  if (result.status === "unavailable") {
    return Response.json({ error: { code: "payment_unavailable", message: "Chapa could not start the payment." } }, { status: 502 });
  }
  return Response.json({ checkoutUrl: result.checkoutUrl });
}
