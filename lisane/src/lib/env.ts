import "server-only";
import { parseEnv, type Env } from "@/lib/env-schema";

export const env: Env = parseEnv(process.env);

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined) {
    throw new Error(`Missing environment variable ${String(key)}. Add it to .env.local.`);
  }
  return value;
}
