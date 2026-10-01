import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  EnvDot,
  Icon,
  IconButton,
  n,
  SecretInput,
  SecretKeyInput,
  Switch,
} from "@secmgr/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { guessSensitive, useLatch } from "../shell/format.js";
import { useStore } from "../store";

let seq = 1;
const blank = () => ({ id: seq++, key: "", value: "", sensitive: true });

export default function AddSecretsDialog({ envId, onClose }) {
  const { select } = useStore();
  const env = select.envById(envId);
  if (!env || !select.canWrite(env.id)) return null;
  return <AddSecrets env={env} onClose={onClose} />;
}

function AddSecrets({ env, onClose }) {
  const { state, actions, select } = useStore();
  const [open, close] = useLatch(onClose, 200);
  const project = select.projectById(env.projectId);
  const envs = select.envsOf(project.id).filter((e) => select.canWrite(e.id));
  const [rows, setRows] = useState(() => [blank()]);
  const [targets, setTargets] = useState([env.id]);
  const [showErrors, setShowErrors] = useState(false);
  const [keyErrors, setKeyErrors] = useState({});
  const listRef = useRef(null);
  const focusNew = useRef(false);

  const liveKeys = useMemo(() => {
    const out = {};
    for (const e of envs)
      out[e.id] = new Set(
        select
          .secretsOf(e.id)
          .filter((r) => r.status !== "deleted")
          .map((r) => r.key),
      );
    return out;
  }, [state.data, state.staged, project.id]);

  const primary = targets.includes(env.id) ? env : select.envById(targets[0]) || env;
  const counts = {};
  rows.forEach((r) => {
    if (r.key) counts[r.key] = (counts[r.key] || 0) + 1;
  });
  const filled = rows.filter((r) => r.key || r.value);
  const listError = (r) => (r.key && counts[r.key] > 1 ? `${r.key} is already in this list.` : undefined);
  const invalid = filled.some((r) => !r.key || keyErrors[r.id] || listError(r));
  const conflicts = targets
    .filter((t) => t !== primary.id)
    .flatMap((t) =>
      filled.filter((r) => r.key && liveKeys[t]?.has(r.key)).map((r) => ({ env: select.envById(t), key: r.key })),
    );

  useEffect(() => {
    if (!focusNew.current || !listRef.current) return;
    focusNew.current = false;
    const last = listRef.current.querySelector(".app-add__row:last-child input");
    if (last) last.focus();
  }, [rows.length]);

  const update = (id, patch) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (!next.touched && ("key" in patch || "value" in patch) && (next.key || next.value))
          next.sensitive = guessSensitive(next.key, next.value);
        return next;
      }),
    );
  const remove = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [blank()]));
  const addRow = () => {
    focusNew.current = true;
    setRows((rs) => [...rs, blank()]);
  };
  const toggleTarget = (id, on) =>
    setTargets((ts) =>
      on ? envs.map((e) => e.id).filter((x) => x === id || ts.includes(x)) : ts.filter((x) => x !== id),
    );

  const submit = () => {
    setShowErrors(true);
    if (!filled.length || invalid || !targets.length) {
      const bad = listRef.current?.querySelector("[aria-invalid='true'], input:placeholder-shown");
      if (bad?.focus) bad.focus();
      return;
    }
    for (const t of targets) {
      const saved = new Set(state.data.secrets.filter((s) => s.envId === t).map((s) => s.key));
      for (const r of filled)
        actions.stage(t, r.key, {
          op: saved.has(r.key) ? "edit" : "add",
          value: r.value,
          sensitive: r.sensitive,
          ...(saved.has(r.key) ? {} : { note: "" }),
        });
    }
    const route = state.route;
    if (!(route.name === "secrets" && targets.includes(route.params.envId)))
      actions.navigate("secrets", { projectId: project.id, envId: primary.id, mode: "table" });
    const names = targets.map((t) => select.envById(t).name);
    actions.toast({
      tone: "success",
      title:
        filled.length === 1
          ? `Staged ${filled[0].key} in ${targets.length === 1 ? names[0] : n(targets.length, "environment")}`
          : `Staged ${n(filled.length, "secret")} in ${targets.length === 1 ? names[0] : n(targets.length, "environment")}`,
      description: targets.some((t) => select.envById(t).protected)
        ? "Review and save them from the changes bar. Protected environments ask for their name."
        : "Review and save them from the changes bar.",
    });
    close();
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const count = Math.max(filled.length, 1);
  const label =
    targets.length > 1
      ? `Add ${n(count, "secret")} to ${n(targets.length, "environment")}`
      : `Add ${count === 1 ? "secret" : n(count, "secret")} to ${primary.name}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      size="lg"
      closeOnOverlay={false}
      title={`Add secrets to ${project.name}`}
      description="Type a key and a value, or paste a whole .env into a key field to import it. Nothing is saved until you review the changes bar."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" icon="plus" kbd={["mod", "enter"]} disabled={!targets.length} onClick={submit}>
            {label}
          </Button>
        </>
      }
    >
      <div className="app-add" onKeyDown={onKeyDown} ref={listRef}>
        <div className="app-add__grid" role="group" aria-label="Secrets to add">
          <div className="app-add__head" aria-hidden="true">
            <span>Key</span>
            <span>Value</span>
            <span className="app-add__head-sensitive">Sensitive</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={r.id} className="app-add__row">
              <SecretKeyInput
                value={r.key}
                onValueChange={(k) => update(r.id, { key: k })}
                existingKeys={Array.from(liveKeys[primary.id] || [])}
                env={primary.name}
                showErrors={showErrors && (i === 0 || !!(r.key || r.value))}
                error={listError(r)}
                onErrorChange={(m) => setKeyErrors((es) => (es[r.id] === m ? es : { ...es, [r.id]: m }))}
                onPasteEnv={(text) => {
                  close();
                  actions.openSheet("import", { envId: primary.id, text });
                }}
                onPastePair={(p) => update(r.id, { key: p.key, value: p.value })}
                aria-label={`Key ${i + 1}`}
                data-autofocus={i === 0 ? "" : undefined}
              />
              <SecretInput
                value={r.value}
                onValueChange={(v) => update(r.id, { value: v })}
                defaultRevealed
                keys={Array.from(liveKeys[primary.id] || [])}
                placeholder="Value"
                aria-label={`Value ${i + 1}`}
              />
              <div className="app-add__sensitive">
                <Switch
                  size="sm"
                  checked={r.sensitive}
                  onCheckedChange={(v) => update(r.id, { sensitive: v, touched: true })}
                  aria-label={`${r.key || `Secret ${i + 1}`} is sensitive`}
                />
              </div>
              <IconButton
                icon="x"
                size="sm"
                label="Remove row"
                disabled={rows.length === 1 && !r.key && !r.value}
                onClick={() => remove(r.id)}
              />
            </div>
          ))}
        </div>
        <div className="app-add__more">
          <Button size="sm" variant="ghost" icon="plus" onClick={addRow}>
            Add another
          </Button>
          <span className="app-add__tip">
            <Icon name="clipboard-paste" size={14} /> Paste KEY=value lines into a key field to import them all
          </span>
        </div>
        <fieldset className="app-add__envs">
          <legend className="app-add__legend">Add to</legend>
          <div className="app-add__env-list">
            {envs.map((e) => (
              <Checkbox
                key={e.id}
                checked={targets.includes(e.id)}
                onCheckedChange={(on) => toggleTarget(e.id, on)}
                label={
                  <span className="app-add__env">
                    <EnvDot color={e.color} size={8} />
                    <span>{e.name}</span>
                    {e.protected ? <Icon name="lock" size={12} label="Protected" /> : null}
                  </span>
                }
              />
            ))}
          </div>
          {!targets.length && showErrors ? <p className="app-add__error">Pick at least one environment.</p> : null}
        </fieldset>
        {conflicts.length ? (
          <Callout tone="warning" title={`${n(conflicts.length, "value")} will be overwritten`}>
            {conflicts.slice(0, 3).map((c, i) => (
              <span key={`${c.env.id}${c.key}`}>
                {i ? ", " : ""}
                <code>{c.key}</code> in {c.env.name}
              </span>
            ))}
            {conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ""}. The changes bar shows each one before you
            save.
          </Callout>
        ) : null}
      </div>
    </Dialog>
  );
}
