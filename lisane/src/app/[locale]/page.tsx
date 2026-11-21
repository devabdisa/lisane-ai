import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function LocaleIndexPage() {
  redirect({ href: "/learn", locale: await getLocale() });
}
