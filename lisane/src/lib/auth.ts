import "server-only";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { env, requireEnv } from "@/lib/env";
import { getPrisma } from "@/server/db";

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }
    : null;

function httpsOrigin(host: string | undefined): string | undefined {
  if (!host) return undefined;
  return host.startsWith("http") ? host : `https://${host}`;
}

const configuredUrl = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;
const vercelOrigins = [
  httpsOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  httpsOrigin(process.env.VERCEL_URL),
].filter((origin): origin is string => Boolean(origin));

// Vercel sets its own host. A localhost default must not be the only trusted origin there.
const baseURL =
  configuredUrl.startsWith("http://localhost") && vercelOrigins[0] ? vercelOrigins[0] : configuredUrl;

export const auth = betterAuth({
  database: prismaAdapter(getPrisma(), {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: google ? { google } : undefined,
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL,
  trustedOrigins: [...new Set([configuredUrl, baseURL, ...vercelOrigins])],
  plugins: [nextCookies()],
});

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export function isGoogleAuthEnabled() {
  return google !== null;
}
