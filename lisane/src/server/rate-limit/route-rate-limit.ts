import "server-only";
import { hitInMemoryRateLimit } from "./in-memory-rate-limiter";

const RATE_LIMIT_MESSAGE = "Too many requests. Please try again in a little while.";

function resolveClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: { code: "rate_limited", message: RATE_LIMIT_MESSAGE } },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    },
  );
}

export function enforceRouteRateLimit(params: {
  request: Request;
  userId?: string | null;
  bucket: string;
  limit: number;
  windowMs: number;
}) {
  const identity = params.userId ? `user:${params.userId}` : `ip:${resolveClientIp(params.request)}`;
  const result = hitInMemoryRateLimit({
    key: `${params.bucket}:${identity}`,
    limit: params.limit,
    windowMs: params.windowMs,
  });

  if (!result.allowed) {
    return rateLimitedResponse(Math.ceil(result.retryAfterMs / 1000));
  }
  return null;
}
