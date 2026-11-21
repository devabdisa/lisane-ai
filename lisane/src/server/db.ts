import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function hasCurrentModels(client: PrismaClient) {
  return typeof client.curriculumUnit?.findMany === "function";
}

export function getPrisma(): PrismaClient {
  // The dev server keeps one client alive. After a schema change that client
  // is missing the new models, so it is replaced.
  if (!globalForPrisma.prisma || !hasCurrentModels(globalForPrisma.prisma)) {
    const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
