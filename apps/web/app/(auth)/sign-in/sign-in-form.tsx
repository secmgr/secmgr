"use client";

import { Button, Callout, CopyButton, Field, Icon, Input, toast, Wordmark } from "@secmgr/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const LINK_ERRORS = new Set(["INVALID_TOKEN", "EXPIRED_TOKEN", "invalid_token", "expired_token"]);

function describe(error: string) {
  if (LINK_ERRORS.has(error)) return "That sign in link expired or was already used. Ask for a new one.";
  if (error === "access_denied") return "GitHub sign in was cancelled.";
  if (error === "two_factor") return "The two factor step timed out. Sign in again.";
  return "Sign in did not finish. Try again.";
}

function validate(value: string) {
  const t = value.trim();
  if (!t) return "Enter the email you use at work.";
  if (!t.includes("@")) return `${t} is missing an @.`;
  if (!EMAIL.test(t)) return `${t} is not a complete email address. Check the part after the @.`;
  return null;
}

type Props = { github: boolean; emailInTerminal: boolean; error: string | null; next: string; host: string };

export function SignInForm({ github, emailInTerminal, error, next, host }: Props) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState(error ? describe(error) : null);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (sent) headingRef.current?.focus();
  }, [sent]);

  async function sendLink(address: string) {
    const result = await authClient.signIn.magicLink({
      email: address,
      callbackURL: next,
      errorCallbackURL: "/sign-in",
    });
    if (result.error) {
      setProblem(
        result.error.status === 429
          ? "Too many attempts. Wait a minute, then try again."
          : "The sign in link could not be sent. Try again.",
      );
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problemText = validate(email);
    setFieldError(problemText);
    if (problemText) {
      inputRef.current?.focus();
      return;
    }
    const address = email.trim().toLowerCase();
    setSending(true);
    setProblem(null);
    const ok = await sendLink(address);
    setSending(false);
    if (ok) setSent(address);
  }

  async function resend() {
    if (!sent) return;
    if (await sendLink(sent))
      toast({ tone: "success", title: `Sent a new link to ${sent}`, description: "The earlier link no longer works." });
  }

  async function continueWithGitHub() {
    setLeaving(true);
    setProblem(null);
    const result = await authClient.signIn.social({
      provider: "github",
      callbackURL: next,
      errorCallbackURL: "/sign-in",
    });
    if (result.error) {
      setLeaving(false);
      setProblem("GitHub sign in could not start. Try again.");
    }
  }

  const loginCommand = `secmgr login --host ${host}`;

  return (
    <main className="auth">
      <div className="auth__panel">
        <Wordmark size={20} className="auth__brand" />
        {!sent ? (
          <>
            <div className="auth__head">
              <h1 className="auth__title">Sign in to secmgr</h1>
              <p className="auth__lede">
                The open source secret manager for teams. New here? Signing in creates your account.
              </p>
            </div>
            {problem && (
              <Callout tone="danger" icon="circle-alert">
                {problem}
              </Callout>
            )}
            {github && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={leaving}
                  disabled={sending}
                  onClick={continueWithGitHub}
                >
                  Continue with GitHub
                </Button>
                <div className="auth__divider" aria-hidden="true">
                  <span>or</span>
                </div>
              </>
            )}
            <form className="auth__form" onSubmit={submit} noValidate>
              <Field label="Work email" error={fieldError}>
                <Input
                  ref={inputRef}
                  size="lg"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onValueChange={(v: string) => {
                    setEmail(v);
                    if (fieldError) setFieldError(null);
                  }}
                />
              </Field>
              <Button
                type="submit"
                variant={github ? "secondary" : "primary"}
                size="lg"
                fullWidth
                loading={sending}
                disabled={leaving}
              >
                {sending ? "Sending link" : "Send sign in link"}
              </Button>
            </form>
          </>
        ) : (
          <div className="auth__sent" aria-live="polite">
            <span className="auth__sent-icon" aria-hidden="true">
              <Icon name="mail-check" size={20} />
            </span>
            <div className="auth__head">
              <h1 className="auth__title" tabIndex={-1} ref={headingRef}>
                Check your inbox
              </h1>
              <p className="auth__lede">
                We sent a sign in link to <code className="auth__email">{sent}</code>. It works once and expires in 5
                minutes.
              </p>
            </div>
            {emailInTerminal && (
              <Callout tone="neutral" icon="terminal">
                Email is not set up on this server, so the link is printed in the terminal running{" "}
                <code>npm run dev</code>.
              </Callout>
            )}
            {problem && (
              <Callout tone="danger" icon="circle-alert">
                {problem}
              </Callout>
            )}
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => {
                setSent(null);
                setProblem(null);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              Use a different email
            </Button>
            <p className="auth__alt">
              No email after a minute? Check spam, or{" "}
              <button type="button" className="auth__link" onClick={resend}>
                send it again
              </button>
              .
            </p>
          </div>
        )}
      </div>
      <footer className="auth__foot">
        <span>Sign in from a terminal:</span>
        <span className="auth__cmd">
          <code>{loginCommand}</code>
          <CopyButton
            size="xs"
            value={loginCommand}
            label="Copy command"
            onCopied={() => toast({ title: "Copied login command" })}
          />
        </span>
      </footer>
    </main>
  );
}
