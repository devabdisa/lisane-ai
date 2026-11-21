import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getServerSession } from "@/lib/auth";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export async function getAppUser(): Promise<AppUser | null> {
  const user = (await getServerSession())?.user;
  if (!user?.id || !user.email) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.image ?? null,
  };
}

export async function requireAppUser(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) {
    redirect({ href: "/login", locale: await getLocale() });
    return null as never;
  }
  return user;
}
