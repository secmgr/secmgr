"use client";

import { Button, Callout, Icon, Wordmark } from "@secmgr/ui";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Props = {
  state: "open" | "wrong-email" | "gone";
  id: string;
  email: string;
  workspace?: string;
  slug?: string;
  inviter?: string;
  role?: string;
};

export function InviteCard({ state, id, email, workspace, slug, inviter, role }: Props) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  async function accept() {
    setBusy("accept");
    setError(null);
    const result = await authClient.organization.acceptInvitation({ invitationId: id });
    if (result.error) {
      setBusy(null);
      setError(result.error.message || "The invite could not be accepted. Ask for a new one.");
      return;
    }
    window.location.href = `/${slug}`;
  }

  async function decline() {
    setBusy("decline");
    setError(null);
    const result = await authClient.organization.rejectInvitation({ invitationId: id });
    setBusy(null);
    if (result.error) {
      setError(result.error.message || "The invite could not be declined.");
      return;
    }
    setDeclined(true);
  }

  async function switchAccount() {
    await authClient.signOut();
    window.location.href = `/sign-in?next=${encodeURIComponent(`/invite/${id}`)}`;
  }

  return (
    <main className="auth">
      <div className="auth__panel">
        <Wordmark size={20} className="auth__brand" />
        {state === "open" && !declined ? (
          <>
            <span className="auth__sent-icon" aria-hidden="true">
              <Icon name="user-plus" size={20} />
            </span>
            <div className="auth__head">
              <h1 className="auth__title">Join {workspace}</h1>
              <p className="auth__lede">
                <code className="auth__email">{inviter}</code> invited you to join as {role}. You get access to its
                projects right away.
              </p>
            </div>
            {error && (
              <Callout tone="danger" icon="circle-alert">
                {error}
              </Callout>
            )}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={busy === "accept"}
              disabled={!!busy}
              onClick={accept}
            >
              {`Join ${workspace}`}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              loading={busy === "decline"}
              disabled={!!busy}
              onClick={decline}
            >
              Decline
            </Button>
            <p className="auth__alt">
              Signed in as <code className="auth__email">{email}</code>.
            </p>
          </>
        ) : declined ? (
          <div className="auth__head">
            <h1 className="auth__title">Invite declined</h1>
            <p className="auth__lede">
              You did not join {workspace}. Ask {inviter} for a new invite if you change your mind.
            </p>
          </div>
        ) : state === "wrong-email" ? (
          <>
            <div className="auth__head">
              <h1 className="auth__title">This invite is for someone else</h1>
              <p className="auth__lede">
                You are signed in as <code className="auth__email">{email}</code>. Sign in with the address the invite
                was sent to.
              </p>
            </div>
            <Button variant="primary" size="lg" fullWidth icon="log-out" onClick={switchAccount}>
              Sign in with another email
            </Button>
          </>
        ) : (
          <>
            <div className="auth__head">
              <h1 className="auth__title">This invite no longer works</h1>
              <p className="auth__lede">
                It expired, was revoked or was already used. Ask the person who invited you to send a new one.
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Go to secmgr
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
