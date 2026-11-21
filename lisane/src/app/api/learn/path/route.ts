import { getAppUser } from "@/lib/require-app-user";
import { getLearningPath } from "@/server/services/learn/get-learning-path";
import { enforceRouteRateLimit } from "@/server/rate-limit/route-rate-limit";

const privateResponse = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in to view your learning path." } },
      { status: 401, headers: privateResponse },
    );
  }

  const limited = enforceRouteRateLimit({
    request,
    userId: user.id,
    bucket: "learn-path",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    return Response.json(await getLearningPath(user.id), { headers: privateResponse });
  } catch (error) {
    console.error("Learning path could not be loaded", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json(
      { error: { code: "learn_path_unavailable", message: "Try opening the learning path again in a moment." } },
      { status: 500, headers: privateResponse },
    );
  }
}
