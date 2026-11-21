type Counter = {
  count: number;
  windowStartMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const counters = new Map<string, Counter>();
let lastCleanupMs = 0;

function maybeCleanup(nowMs: number, maxWindowMs: number) {
  if (nowMs - lastCleanupMs < 5 * 60 * 1000) return;

  for (const [key, counter] of counters) {
    if (nowMs - counter.windowStartMs > maxWindowMs * 2) counters.delete(key);
  }
  lastCleanupMs = nowMs;
}

export function hitInMemoryRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}): RateLimitResult {
  const nowMs = params.nowMs ?? Date.now();
  maybeCleanup(nowMs, params.windowMs);

  const existing = counters.get(params.key);
  if (!existing || nowMs - existing.windowStartMs >= params.windowMs) {
    counters.set(params.key, { count: 1, windowStartMs: nowMs });
    return { allowed: true, remaining: Math.max(0, params.limit - 1), retryAfterMs: 0 };
  }

  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, params.windowMs - (nowMs - existing.windowStartMs)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, params.limit - existing.count),
    retryAfterMs: 0,
  };
}
