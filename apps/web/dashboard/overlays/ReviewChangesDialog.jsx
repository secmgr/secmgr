import {
  Badge,
  Button,
  Callout,
  Dialog,
  diffSegments,
  EmptyState,
  EnvBadge,
  Field,
  Icon,
  IconButton,
  Input,
  n,
  Switch,
} from "@secmgr/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLatch } from "../shell/format.js";
import { useEnvValues, useStore } from "../store";

const DOTS = "••••••••••••";

function Value({ value, other, side, revealed, sensitive }) {
  if (value === undefined) return <span className="app-review__none">{side === "before" ? "Not set" : "Deleted"}</span>;
  if (value === "") return <span className="app-review__none">Empty</span>;
  if (sensitive && !revealed)
    return (
      <span className="app-review__mask" aria-label="Hidden value">
        {DOTS}
      </span>
    );
  if (other === undefined || other === value) return <span className="app-review__text">{value}</span>;
  const seg = diffSegments(side === "before" ? value : other, side === "before" ? other : value);
  const parts = side === "before" ? seg.base : seg.compare;
  return (
    <span className="app-review__text">
      {parts.map((p, i) =>
        p.changed ? (
          <mark key={i} className="app-review__mark" data-side={side}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

export default function ReviewChangesDialog({ envId, confirm, onClose }) {
  const { state, actions, select } = useStore();
  const [open, close] = useLatch(onClose, 200);
  const env = select.envById(envId);
  useEnvValues([envId]);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const confirmRef = useRef(null);
  const snapshot = useRef(null);

  const staged = env ? select.stagedOf(env.id) : {};
  const live = useMemo(() => {
    if (!env) return [];
    const values = state.values[env.id]?.values ?? {};
    return Object.entries(staged)
      .map(([key, c]) => {
        const row = state.data.secrets.find((s) => s.envId === env.id && s.key === key) || null;
        const saved = row ? { ...row, value: values[key] ?? "" } : null;
        const kind = c.op === "delete" ? "deleted" : saved ? "edited" : "new";
        const before = saved ? saved.value : undefined;
        const after = c.op === "delete" ? undefined : c.value !== undefined ? c.value : saved ? saved.value : "";
        const sensitive =
          (c.sensitive !== undefined ? c.sensitive : saved ? saved.sensitive : true) !== false ||
          (saved && saved.sensitive !== false);
        const details = [];
        if (kind === "edited" && c.value !== undefined && c.value !== before) details.push(c.summary || "Value");
        if (kind === "edited" && c.note !== undefined && c.note !== (saved.note || "")) details.push("Note");
        if (kind === "edited" && c.sensitive !== undefined && c.sensitive !== saved.sensitive)
          details.push(c.sensitive ? "Marked sensitive" : "Marked not sensitive");
        return {
          key,
          c,
          saved,
          kind,
          before,
          after,
          sensitive,
          details,
          valueChanged: kind !== "edited" || (c.value !== undefined && c.value !== before),
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [staged, state.data, state.values, envId]);
  const items = snapshot.current || live;

  useEffect(() => {
    if (open && confirm && env?.protected && confirmRef.current) setTimeout(() => confirmRef.current?.focus(), 60);
  }, []);

  if (!env) return null;
  const total = items.length;
  const needs = env.protected;
  const ok = total > 0 && (!needs || typed.trim() === env.name);
  const counts = {
    new: items.filter((i) => i.kind === "new").length,
    edited: items.filter((i) => i.kind === "edited").length,
    deleted: items.filter((i) => i.kind === "deleted").length,
  };
  const summary = [
    counts.edited && `${counts.edited} edited`,
    counts.new && `${counts.new} new`,
    counts.deleted && `${counts.deleted} deleted`,
  ]
    .filter(Boolean)
    .join(" · ");

  const toggleReveal = (v) => {
    setRevealed(v);
    if (v)
      actions.log({
        action: "reveal",
        projectId: env.projectId,
        envId: env.id,
        keys: items.filter((i) => i.sensitive).map((i) => i.key),
      });
  };

  const save = async () => {
    if (!ok || saving) return;
    snapshot.current = items;
    setSaving(true);
    try {
      await actions.commit(env.id, { message: message.trim() || undefined, confirm: needs ? typed.trim() : undefined });
      close();
    } catch {
      snapshot.current = null;
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "Enter" || e.key === "s" || e.key === "S")) {
      e.preventDefault();
      e.stopPropagation();
      save();
    }
  };

  const tone = { new: "success", edited: "warning", deleted: "danger" };
  const word = { new: "New", edited: "Edited", deleted: "Deleted" };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) close();
      }}
      size="lg"
      closeOnOverlay={false}
      title={total ? `Review ${n(total, "change")} to ${env.name}` : `Nothing to review in ${env.name}`}
      description={
        total
          ? needs
            ? `${env.name} is protected. Check every change, then type its name to save.`
            : "Every change below is staged. Saving writes them as new versions; you can undo from the toast."
          : undefined
      }
      footer={
        total ? (
          <>
            <Button onClick={close} disabled={saving}>
              Keep editing
            </Button>
            <Button
              variant="primary"
              icon={needs ? "lock" : "check"}
              kbd={ok && !saving ? ["mod", "enter"] : undefined}
              loading={saving}
              disabled={!ok}
              onClick={save}
            >
              {saving ? "Saving" : `Save ${n(total, "change")}${needs ? ` to ${env.name}` : ""}`}
            </Button>
          </>
        ) : (
          <Button onClick={close}>Close</Button>
        )
      }
    >
      <div className="app-review" onKeyDown={onKeyDown}>
        {total ? (
          <>
            <div className="app-review__bar">
              <EnvBadge env={{ name: env.name, color: env.color, protected: env.protected }} size="sm" />
              <span className="app-review__summary">{summary}</span>
              <Switch
                size="sm"
                label="Reveal values"
                labelPosition="start"
                checked={revealed}
                onCheckedChange={toggleReveal}
                className="app-review__reveal"
              />
            </div>
            <ul className="app-review__list">
              {items.map((it) => (
                <li key={it.key} className="app-review__item" data-kind={it.kind}>
                  <div className="app-review__head">
                    <Badge tone={tone[it.kind]} variant="outline">
                      {word[it.kind]}
                    </Badge>
                    <code className="app-review__key">{it.key}</code>
                    {it.details.length ? <span className="app-review__details">{it.details.join(", ")}</span> : null}
                    <IconButton
                      icon="undo-2"
                      size="xs"
                      label={`Unstage ${it.key}`}
                      onClick={() => actions.unstage(env.id, it.key)}
                      className="app-review__undo"
                    />
                  </div>
                  {it.valueChanged ? (
                    <div className="app-review__diff">
                      {it.kind !== "new" ? (
                        <div className="app-review__line" data-side="before">
                          <Icon name="minus" size={14} className="app-review__sign" />
                          <Value
                            value={it.before}
                            other={it.kind === "edited" ? it.after : undefined}
                            side="before"
                            revealed={revealed}
                            sensitive={it.sensitive}
                          />
                        </div>
                      ) : null}
                      {it.kind !== "deleted" ? (
                        <div className="app-review__line" data-side="after">
                          <Icon name="plus" size={14} className="app-review__sign" />
                          <Value
                            value={it.after}
                            other={it.kind === "edited" ? it.before : undefined}
                            side="after"
                            revealed={revealed}
                            sensitive={it.sensitive}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {it.kind === "edited" && it.c.note !== undefined && it.c.note !== (it.saved.note || "") ? (
                    <p className="app-review__note">
                      <span className="app-tertiary">Note</span> {it.c.note || <em>Removed</em>}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <Field label="Message" optional hint="Shown in activity and in each secret's history.">
              <Input value={message} onValueChange={setMessage} placeholder="Describe this change" maxLength={140} />
            </Field>
            {needs ? (
              <div className="app-review__confirm">
                <Callout tone="neutral" icon="lock" title={`${env.name} is protected`}>
                  Services reading {env.name} pick these values up on their next deploy.
                </Callout>
                <Field
                  label={
                    <>
                      Type <code>{env.name}</code> to confirm
                    </>
                  }
                >
                  <Input
                    ref={confirmRef}
                    mono
                    value={typed}
                    onValueChange={setTyped}
                    placeholder={env.name}
                    autoComplete="off"
                    invalid={!!typed && !env.name.startsWith(typed.trim())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        save();
                      }
                    }}
                  />
                </Field>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            variant="inline"
            icon="circle-check"
            title="Nothing staged"
            description={`Edits you make in ${env.name} collect here before you save them.`}
          />
        )}
      </div>
    </Dialog>
  );
}
