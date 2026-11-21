"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Link, useRouter } from "@/i18n/navigation";

function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "login" | "signup";
  googleEnabled: boolean;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "signup" && name.trim().length === 0) {
      setError(t("nameRequired"));
      return;
    }
    if (!email.includes("@")) {
      setError(t("emailRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setPending(true);
    const result =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name: name.trim(), email, password });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? t("failed"));
      return;
    }
    router.replace("/learn");
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `/${locale}/learn`,
    });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? t("failed"));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Mascot />
        <div className="flex flex-col gap-2">
          <h1 className="text-title font-semibold">{t(mode === "login" ? "loginTitle" : "signupTitle")}</h1>
          <p className="text-body text-fg-muted">{t(mode === "login" ? "loginSubtitle" : "signupSubtitle")}</p>
        </div>
      </div>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="self-start text-caption text-fg-muted underline-offset-2 hover:underline"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? t("hidePassword") : t("showPassword")}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-label text-fg">
              {error}
            </p>
          ) : null}
          <Button type="submit" width="full" disabled={pending}>
            {t(mode === "login" ? "submitLogin" : "submitSignup")}
          </Button>
        </form>
        {googleEnabled ? (
          <Button type="button" hierarchy="secondary" width="full" disabled={pending} onClick={onGoogle}>
            {t("google")}
          </Button>
        ) : null}
        <p className="text-center text-label text-fg-muted">
          {t(mode === "login" ? "noAccount" : "hasAccount")}{" "}
          <Link href={mode === "login" ? "/signup" : "/login"} className="font-semibold text-fg underline-offset-2 hover:underline">
            {t(mode === "login" ? "signupLink" : "loginLink")}
          </Link>
        </p>
      </Card>
    </main>
  );
}

export { AuthForm };
