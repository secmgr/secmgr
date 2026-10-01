import { Button, Callout, CopyButton, Dialog, EnvBadge, Field, Input, n, SegmentedControl, Select } from "@secmgr/ui";
import { useState } from "react";
import { useLatch } from "../shell/format.js";
import { useStore } from "../store";

const EXPIRY = [
  { value: "1", label: "1 hour" },
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
];

function when(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} at ${time}`;
}

export default function ShareDialog({ secretId, onClose }) {
  const { state, actions, select } = useStore();
  const [open, close] = useLatch(onClose, 200);
  const secret = state.data.secrets.find((s) => s.id === secretId) || null;
  const env = secret ? select.envById(secret.envId) : null;
  const [hours, setHours] = useState("24");
  const [views, setViews] = useState("1");
  const [share, setShare] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!secret || !env) {
    return (
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        size="sm"
        title="Nothing to share"
        description="Save this secret first. One time links only work for saved values."
        footer={<Button onClick={close}>Close</Button>}
      />
    );
  }

  const active = state.data.shares
    .filter(
      (s) =>
        s.secretId === secret.id &&
        s.views < s.maxViews &&
        new Date(s.expiresAt).getTime() > select.now &&
        (!share || s.id !== share.id),
    )
    .sort((a, b) => (a.expiresAt < b.expiresAt ? 1 : -1));
  const viewsN = Number(views);
  const create = async () => {
    if (busy) return;
    setBusy(true);
    const s = await actions.createShare(secret.id, { maxViews: viewsN, expiresInHours: Number(hours) });
    setBusy(false);
    if (s) setShare(s);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      size="md"
      title={`Share ${secret.key}`}
      description={
        share
          ? `The link works ${viewsN === 1 ? "once" : `${viewsN} times`} and expires ${when(share.expiresAt)}.`
          : "Create a link that shows this one value, then expires. The recipient does not need a secmgr account."
      }
      footer={
        share ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" icon="link" loading={busy} onClick={create}>
              Create link
            </Button>
          </>
        )
      }
    >
      <div className="app-share">
        <div className="app-share__secret">
          <code>{secret.key}</code>
          <span className="app-tertiary">in</span>
          <EnvBadge env={{ name: env.name, color: env.color, protected: env.protected }} size="sm" />
        </div>
        {share ? (
          <>
            <Field label="One time link">
              <Input
                mono
                readOnly
                selectOnFocus
                value={share.url}
                suffix={
                  <CopyButton
                    value={share.url}
                    label="Copy link"
                    size="xs"
                    onCopied={() =>
                      actions.toast({
                        title: "Copied one time link",
                        description: `Send it over a channel you trust. It expires ${when(share.expiresAt)}.`,
                      })
                    }
                  />
                }
              />
            </Field>
            <Callout tone="info" icon="eye">
              Anyone with the link can view this value {viewsN === 1 ? "once" : `${viewsN} times`}. The key to decrypt
              it lives only in the link, so secmgr cannot show it to you again.
            </Callout>
          </>
        ) : (
          <div className="app-share__form">
            <Field label="Expires after">
              <Select options={EXPIRY} value={hours} onValueChange={setHours} />
            </Field>
            <Field label="Views">
              <SegmentedControl
                options={[
                  { value: "1", label: "1 view" },
                  { value: "3", label: "3 views" },
                  { value: "5", label: "5 views" },
                ]}
                value={views}
                onValueChange={setViews}
                fullWidth
              />
            </Field>
          </div>
        )}
        {active.length ? (
          <div className="app-share__active">
            <span>
              {n(active.length, "other link")} for {secret.key} {active.length === 1 ? "is" : "are"} still active.{" "}
              {active.length === 1 ? "It" : "The last"} expires {when(active[0].expiresAt)}.
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon="x"
              onClick={() =>
                Promise.all(active.map((s) => actions.revokeShare(s.id))).then(() =>
                  actions.toast({ title: `Revoked ${n(active.length, "link")}` }),
                )
              }
            >
              {active.length === 1 ? "Revoke it" : "Revoke them"}
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
