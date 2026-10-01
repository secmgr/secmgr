import { Badge, Button, Callout, Dialog, Field, n, RadioGroup, Textarea } from "@secmgr/ui";
import { useState } from "react";
import { ROLE_INFO } from "../screens/Members.jsx";
import { useClosable } from "../screens/NotFound.parts.jsx";
import { useStore } from "../store";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
const NOTES = {
  Admin: {
    icon: "shield-check",
    title: "Admins manage the workspace",
    body: "They create projects and environments, invite members, issue tokens and set access per environment.",
  },
  Developer: {
    icon: "key-round",
    title: "Developers read and write secrets",
    body: "They work in every environment. Protected ones ask them to type the name before a save.",
  },
  Viewer: {
    icon: "eye",
    title: "Viewers read, never write",
    body: "They see values outside protected environments and only key names inside them. Every reveal is logged.",
  },
};

export default function InviteDialog({ onClose }) {
  const { state, actions } = useStore();
  const d = state.data;
  const { open, close, onOpenChange } = useClosable(onClose);
  const [text, setText] = useState("");
  const [role, setRole] = useState("Developer");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blurred, setBlurred] = useState(false);

  const parts = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  const typing = !blurred && !tried && text && !/[\s,;]$/.test(text) ? parts[parts.length - 1] : null;
  const invalid = unique.filter((e) => !EMAIL.test(e) && e !== typing);
  const members = unique.filter((e) => d.members.some((m) => m.email === e));
  const pending = unique.filter((e) => d.invites.some((i) => i.email === e));
  const valid = unique.filter((e) => EMAIL.test(e) && !members.includes(e) && !pending.includes(e));

  let error = null;
  if (invalid.length)
    error =
      invalid.length === 1
        ? `${invalid[0]} is not a complete email address. Fix it or remove it.`
        : `${n(invalid.length, "address", "addresses")} are not complete: ${invalid.join(", ")}.`;
  else if (members.length)
    error = `${members.join(", ")} ${members.length === 1 ? "is already a member" : "are already members"}. Remove ${members.length === 1 ? "it" : "them"} to continue.`;
  else if (tried && !valid.length)
    error = pending.length
      ? `${pending.join(", ")} already ${pending.length === 1 ? "has" : "have"} a pending invite. Resend it from the members page.`
      : "Add at least one email address.";

  const submit = async (e) => {
    if (e) e.preventDefault();
    setTried(true);
    const bad = unique.filter((x) => !EMAIL.test(x));
    if (bad.length || members.length || !valid.length || busy) return;
    setBusy(true);
    const sent = [];
    for (const email of valid) {
      if (await actions.invite({ email, role })) sent.push(email);
    }
    await actions.refresh();
    setBusy(false);
    if (!sent.length) return;
    actions.toast({
      tone: "success",
      title: `Invited ${n(sent.length, "person", "people")} as ${role}`,
      description: sent.join(", "),
    });
    if (sent.length === valid.length) close();
    else setText(valid.filter((e) => !sent.includes(e)).join(", "));
  };

  const note = NOTES[role];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlay={false}
      size="md"
      title={`Invite to ${d.workspace.name}`}
      description="Each person gets an email with a link to join. It expires in 48 hours."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!!invalid.length || !!members.length}>
            {valid.length > 1 ? `Send ${valid.length} invites` : "Send invite"}
          </Button>
        </>
      }
    >
      <form className="dlg-form" onSubmit={submit}>
        <Field
          label="Email addresses"
          required
          error={error}
          hint="Separate addresses with commas, spaces or new lines."
          counter={valid.length ? n(valid.length, "invite") : null}
        >
          <Textarea
            data-autofocus
            autoGrow
            minRows={2}
            maxRows={6}
            value={text}
            onValueChange={(v) => {
              setText(v);
              setBlurred(false);
            }}
            onBlur={() => setBlurred(true)}
            placeholder="sam@example.com, ines@example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
          />
        </Field>
        {valid.length > 0 && (
          <div className="dlg-row" aria-label="Addresses to invite">
            {valid.map((e) => (
              <Badge key={e} variant="outline">
                {e}
              </Badge>
            ))}
          </div>
        )}
        <Field label="Role">
          <RadioGroup
            value={role}
            onValueChange={setRole}
            options={["Admin", "Developer", "Viewer"].map((r) => ({ value: r, label: r, description: ROLE_INFO[r] }))}
          />
        </Field>
        <Callout tone="neutral" icon={note.icon} title={note.title}>
          {note.body}
        </Callout>
      </form>
    </Dialog>
  );
}
