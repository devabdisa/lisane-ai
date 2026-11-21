import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

// Prisma's migration engine cannot use Neon's pooled URL: `channel_binding`
// makes it report the server as unreachable, and the pooler rejects migrations.
// The app keeps DATABASE_URL as Neon gives it and connects with the `pg` driver.
function migrationUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "postgresql://postgres:postgres@127.0.0.1:5432/lisane";
  const url = new URL(value);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl(process.env.DATABASE_URL),
  },
});
