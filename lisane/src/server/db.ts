import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function hasCurrentModels(client: PrismaClient) {
  return typeof client.curriculumUnit?.findMany === "function" && typeof client.learnerReward?.upsert === "function";
}

// Neon’s pooled host is fine for single queries, but it will not start a
// Prisma transaction in time. Use the direct host, same as migrations.
function directDatabaseUrl(raw: string) {
  const url = new URL(raw);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

export function getPrisma(): PrismaClient {
  // The dev server keeps one client alive. After a schema change that client
  // is missing the new models, so it is replaced.
  if (!globalForPrisma.prisma || !hasCurrentModels(globalForPrisma.prisma)) {
    void globalForPrisma.prisma?.$disconnect();
    const adapter = new PrismaPg({
      connectionString: directDatabaseUrl(requireEnv("DATABASE_URL")),
      max: 5,
      connectionTimeoutMillis: 15_000,
    });
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      transactionOptions: { maxWait: 15_000, timeout: 20_000 },
    });
  }
  return globalForPrisma.prisma;
}
