"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";

export function SignInForm({ providers, next, error }: { providers: { google: boolean; apple: boolean; x: boolean; devLogin: boolean }; next: string; error: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");

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
      {providers.google ? (
        <Button variant="outline" size="lg" className="w-full" onClick={() => social("google")} disabled={busy !== null}>
          Continue with Google
        </Button>
      ) : null}
      {providers.apple ? (
        <Button variant="outline" size="lg" className="w-full" onClick={() => social("apple")} disabled={busy !== null}>
          Continue with Apple
        </Button>
      ) : null}
      {providers.x ? (
        <Button variant="outline" size="lg" className="w-full" onClick={() => social("twitter")} disabled={busy !== null}>
          Continue with X
        </Button>
      ) : null}
      {!anyProvider && !providers.devLogin ? <Alert tone="warn">No sign-in providers are configured. Set GOOGLE_CLIENT_ID, APPLE_CLIENT_ID or X_CLIENT_ID in the environment.</Alert> : null}
      {providers.devLogin ? (
        <form onSubmit={dev} className="space-y-3 rounded-lg border border-dashed border-line-strong bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Development login</p>
          {mode === "up" ? (
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          ) : null}
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" />
          </Field>
          <div className="flex items-center justify-between gap-2">
            <Button type="submit" disabled={busy !== null}>
              {mode === "in" ? "Sign in" : "Create account"}
            </Button>
            <button type="button" className="text-xs text-ink-3 underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Create a development account" : "I already have an account"}
            </button>
          </div>
        </form>
      ) : null}
      <p className="text-center text-xs text-ink-3">
        By continuing you agree to the <a href="/terms" className="underline">terms</a> and <a href="/privacy" className="underline">privacy policy</a>.
      </p>
    </div>
  );
}
