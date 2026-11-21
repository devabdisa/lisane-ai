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
  baseURL: env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
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
