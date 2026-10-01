"use client";

import { Button, Callout, Field, Input, Wordmark } from "@secmgr/ui";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function TwoFactorForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = code.replace(/\s+/g, "");
    if (mode === "totp" && !/^\d{6}$/.test(clean)) {
      setError("Enter the 6 digit code from your authenticator app.");
      return;
    }
    if (mode === "backup" && clean.length < 6) {
      setError("Enter one of your recovery codes.");
      return;
    }
    setBusy(true);
    setError(null);
    const result =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: clean })
        : await authClient.twoFactor.verifyBackupCode({ code: clean });
    if (result.error) {
      setBusy(false);
      const message = result.error.message ?? "";
      setError(
        /cookie|expired/i.test(message)
          ? "This sign in took too long. Go back and sign in again."
          : /too many|locked/i.test(message)
            ? "Too many wrong codes. Wait a few minutes, then sign in again."
            : mode === "totp"
              ? "That code did not match. Check the time on your phone and try again."
              : "That recovery code did not match, or it was already used.",
      );
      return;
    }
    window.location.href = next;
  }

  return (
    <main className="auth">
      <div className="auth__panel">
        <Wordmark size={20} className="auth__brand" />
        <div className="auth__head">
          <h1 className="auth__title">{mode === "totp" ? "Enter your code" : "Use a recovery code"}</h1>
          <p className="auth__lede">
            {mode === "totp"
              ? "Open your authenticator app and enter the 6 digit code for secmgr."
              : "Each recovery code works once. Turn on two factor again from Settings after you sign in."}
          </p>
        </div>
        <form className="auth__form" onSubmit={submit} noValidate>
          <Field label={mode === "totp" ? "Code" : "Recovery code"} error={error}>
            <Input
              size="lg"
              mono
              autoFocus
              inputMode={mode === "totp" ? "numeric" : "text"}
              autoComplete="one-time-code"
              placeholder={mode === "totp" ? "123456" : "abcde-fghij"}
              value={code}
              onValueChange={(v: string) => {
                setCode(v);
                if (error) setError(null);
              }}
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>
            Verify
          </Button>
        </form>
        <p className="auth__alt">
          {mode === "totp" ? "Lost your phone? " : "Have your phone? "}
          <button
            type="button"
            className="auth__link"
            onClick={() => {
              setMode(mode === "totp" ? "backup" : "totp");
              setCode("");
              setError(null);
            }}
          >
            {mode === "totp" ? "Use a recovery code" : "Use your authenticator app"}
          </button>
        </p>
        {error && /sign in again/.test(error) && (
          <Callout tone="neutral">
            <a className="auth__link" href="/sign-in">
              Back to sign in
            </a>
          </Callout>
        )}
      </div>
    </main>
  );
}
