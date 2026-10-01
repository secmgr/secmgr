"use client";

import { Button, Callout, CopyButton, Icon, toast, Wordmark } from "@secmgr/ui";
import { useEffect, useState } from "react";

type Props = { id: string; open: boolean; viewsLeft: number; expiresAt: string | null };

function fromBase64(value: string) {
  const normal = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function decrypt(keyText: string, ciphertext: string, nonce: string) {
  const key = await crypto.subtle.importKey("raw", fromBase64(keyText), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(nonce) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}

function until(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function ShareReveal({ id, open, viewsLeft, expiresAt }: Props) {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<"ready" | "opening" | "shown" | "gone" | "broken">(open ? "ready" : "gone");
  const [value, setValue] = useState("");
  const [left, setLeft] = useState(viewsLeft);

  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    setKey(fragment || null);
    if (!fragment && open) setState("broken");
  }, [open]);

  async function reveal() {
    if (!key) return;
    setState("opening");
    try {
      const response = await fetch(`/api/v1/shares/${encodeURIComponent(id)}/open`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setState("gone");
        return;
      }
      const data = (await response.json()) as { ciphertext: string; nonce: string; viewsLeft: number };
      setValue(await decrypt(key, data.ciphertext, data.nonce));
      setLeft(data.viewsLeft);
      setState("shown");
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      setState("broken");
    }
  }

  return (
    <main className="auth">
      <div className="auth__panel">
        <Wordmark size={20} className="auth__brand" />
        {state === "ready" || state === "opening" ? (
          <>
            <span className="auth__sent-icon" aria-hidden="true">
              <Icon name="lock" size={20} />
            </span>
            <div className="auth__head">
              <h1 className="auth__title">Someone shared a secret with you</h1>
              <p className="auth__lede">
                {left === 1 ? "It can be viewed once." : `It can be viewed ${left} more times.`}
                {expiresAt ? ` The link expires ${until(expiresAt)}.` : ""} Reveal it only when you are ready to copy
                it.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon="eye"
              loading={state === "opening"}
              disabled={!key}
              onClick={reveal}
            >
              Reveal secret
            </Button>
          </>
        ) : state === "shown" ? (
          <>
            <div className="auth__head">
              <h1 className="auth__title">Here is the secret</h1>
              <p className="auth__lede">
                {left > 0
                  ? `The link works ${left === 1 ? "once more" : `${left} more times`}.`
                  : "The link no longer works."}{" "}
                Store the value somewhere safe before you close this page.
              </p>
            </div>
            <div className="share__value">
              <code className="share__text">{value || "(empty)"}</code>
              <CopyButton
                variant="text"
                appearance="secondary"
                value={value}
                label="Copy secret"
                onCopied={() => toast({ title: "Copied the secret" })}
              >
                Copy
              </CopyButton>
            </div>
          </>
        ) : state === "broken" ? (
          <>
            <div className="auth__head">
              <h1 className="auth__title">This link is incomplete</h1>
              <p className="auth__lede">
                The part after # holds the key to decrypt the secret. Copy the whole link from the message you received.
              </p>
            </div>
            <Callout tone="neutral" icon="info">
              secmgr never stores that key, so it cannot recover the secret without it.
            </Callout>
          </>
        ) : (
          <div className="auth__head">
            <h1 className="auth__title">This link no longer works</h1>
            <p className="auth__lede">
              It expired, was revoked or was already opened. Ask the person who sent it for a new link.
            </p>
          </div>
        )}
      </div>
      <footer className="auth__foot">
        <span>Shared with secmgr, the open source secret manager for teams.</span>
      </footer>
    </main>
  );
}
