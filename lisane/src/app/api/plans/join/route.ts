import { getAppUser } from "@/lib/require-app-user";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";
import { joinSchool } from "@/server/services/payments/payments";
import { z } from "zod";

const bodySchema = z.object({ code: z.string().trim().min(4).max(16) });

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: { code: "unauthenticated", message: "Sign in to continue." } }, { status: 401 });
  }
  const limited = enforceRouteRateLimit({ request, userId: user.id, bucket: "school-join", limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_input", message: "Enter the school code." } }, { status: 400 });
  }
  const result = await joinSchool(user.id, parsed.data.code);
  if (result.status === "joined") return Response.json({ name: result.name });
  const message = result.status === "full"
    ? "That school has no seats left."
    : result.status === "already"
      ? "You already belong to a school."
      : "That school code is not active.";
  return Response.json({ error: { code: result.status, message } }, { status: 400 });
}
