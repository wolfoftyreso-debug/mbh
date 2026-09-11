"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { useT } from "@/components/i18n/provider";

export function SignInForm({ providers, next, error }: { providers: { google: boolean; apple: boolean; x: boolean; devLogin: boolean }; next: string; error: string | null }) {
  const { t } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function social(provider: "google" | "apple" | "twitter") {
    setBusy(provider);
    setMessage(null);
    const res = await authClient.signIn.social({ provider, callbackURL: next });
    if (res.error) setMessage(res.error.message ?? "Sign-in failed");
    setBusy(null);
  }

  async function dev(e: React.FormEvent) {
    e.preventDefault();
    setBusy("dev");
    setMessage(null);
    const res = mode === "in" ? await authClient.signIn.email({ email, password, callbackURL: next }) : await authClient.signUp.email({ email, password, name: name || email.split("@")[0], callbackURL: next });
    if (res.error) setMessage(res.error.message ?? "Sign-in failed");
    else window.location.href = next;
    setBusy(null);
  }

  const anyProvider = providers.google || providers.apple || providers.x;

  return (
    <div className="space-y-4">
      {message ? <Alert tone="danger">{message}</Alert> : null}
      {providers.google ? <Button variant="outline" size="lg" className="w-full" onClick={() => social("google")} disabled={busy !== null}>{t("signin.google")}</Button> : null}
      {providers.apple ? <Button variant="outline" size="lg" className="w-full" onClick={() => social("apple")} disabled={busy !== null}>{t("signin.apple")}</Button> : null}
      {providers.x ? <Button variant="outline" size="lg" className="w-full" onClick={() => social("twitter")} disabled={busy !== null}>{t("signin.x")}</Button> : null}
      {!anyProvider && !providers.devLogin ? <Alert tone="warn">{t("signin.noProviders")}</Alert> : null}
      {providers.devLogin ? (
        <form onSubmit={dev} data-ready={ready ? "true" : "false"} className="space-y-3 rounded-lg border border-dashed border-line-strong bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{t("signin.dev")}</p>
          {mode === "up" ? (
            <Field label={t("signin.name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          ) : null}
          <Field label={t("signin.email")}>
            <Input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label={t("signin.password")}>
            <Input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" />
          </Field>
          <div className="flex items-center justify-between gap-2">
            <Button type="submit" disabled={busy !== null}>{mode === "in" ? t("signin.submit") : t("signin.create")}</Button>
            <button type="button" className="text-xs text-ink-3 underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? t("signin.switchToCreate") : t("signin.switchToSignIn")}</button>
          </div>
        </form>
      ) : null}
      <p className="text-center text-xs text-ink-3">
        <a href="/terms" className="underline">{t("footer.terms")}</a> · <a href="/privacy" className="underline">{t("footer.privacy")}</a>
        <span className="block">{t("signin.legal")}</span>
      </p>
    </div>
  );
}
