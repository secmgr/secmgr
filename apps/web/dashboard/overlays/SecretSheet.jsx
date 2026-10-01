import {
  Badge,
  Button,
  Callout,
  CopyButton,
  EnvBadge,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  n,
  relativeTime,
  SecretValue,
  Select,
  Sheet,
  Switch,
  Textarea,
  VersionTimeline,
} from "@secmgr/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { isLiveKey, nameOf, rotationInfo, useLatch } from "../shell/format.js";
import { useEnvValues, useStore } from "../store";

const ROTATION = [
  { value: "0", label: "Never" },
  { value: "30", label: "Every 30 days" },
  { value: "60", label: "Every 60 days" },
  { value: "90", label: "Every 90 days" },
  { value: "180", label: "Every 180 days" },
];

function locate(secrets, secretId) {
  if (typeof secretId === "string" && secretId.startsWith("new:")) {
    const rest = secretId.slice(4);
    const i = rest.indexOf(":");
    return { envId: rest.slice(0, i), key: rest.slice(i + 1) };
  }
  const s = secrets.find((x) => x.id === secretId);
  return s ? { envId: s.envId, key: s.key } : { envId: null, key: null };
}

const refsIn = (value) =>
  Array.from(new Set(((value || "").match(/\$\{([A-Z_][A-Z0-9_]*)\}/g) || []).map((m) => m.slice(2, -1))));

function Section({ title, meta, children, id, innerRef }) {
  return (
    <section className="app-peek__section" id={id} ref={innerRef}>
      <div className="app-peek__section-head">
        <h3 className="app-peek__section-title">{title}</h3>
        {meta ? <span className="app-peek__section-meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function SecretSheet({ secretId, section, onClose }) {
  const { state, actions, select } = useStore();
  const [open, close] = useLatch(onClose, 220);
  const { envId, key } = locate(state.data.secrets, secretId);
  const env = envId ? select.envById(envId) : null;
  const project = env ? select.projectById(env.projectId) : null;
  const envs = project ? select.envsOf(project.id) : [];
  useEnvValues(envs.filter((e) => select.canRead(e.id)).map((e) => e.id));
  const rows = env ? select.secretsOf(env.id) : [];
  const secret = rows.find((r) => r.key === key) || null;
  const saved = env ? state.data.secrets.find((s) => s.envId === env.id && s.key === key) : null;
  const now = select.now;
  const writable = env ? select.canWrite(env.id) : false;
  const readable = env ? select.canRead(env.id) : false;
  const ready = env ? select.valuesStatus(env.id) === "ready" : false;

  const [versions, setVersions] = useState({ status: "idle", list: [], withValues: false });
  const loadVersions = useCallback(
    async (withValues) => {
      if (!env || !saved) return null;
      setVersions((v) => ({ ...v, status: "loading" }));
      try {
        const { versions: list } = await api.versions(env.id, saved.id, withValues);
        setVersions({ status: "ready", list, withValues });
        return list;
      } catch (error) {
        setVersions((v) => ({ ...v, status: "error" }));
        actions.fail(error, "Could not load the history");
        return null;
      }
    },
    [env?.id, saved?.id],
  );
  useEffect(() => {
    if (saved) loadVersions(false);
    else setVersions({ status: "ready", list: [], withValues: false });
  }, [saved?.id, saved?.version]);

  const [note, setNote] = useState(secret ? secret.note || "" : "");
  useEffect(() => {
    setNote(secret ? secret.note || "" : "");
  }, [secretId, secret?.note]);

  const historyRef = useRef(null);
  const rotationRef = useRef(null);
  useEffect(() => {
    const target = section === "history" ? historyRef.current : section === "rotation" ? rotationRef.current : null;
    if (!target) return undefined;
    const t = setTimeout(() => target.scrollIntoView({ block: "start", behavior: "smooth" }), 240);
    return () => clearTimeout(t);
  }, [secretId, section]);

  if (!env || !secret) {
    return (
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        modal={false}
        title={key || "Secret"}
        description="This secret is no longer here."
      >
        <div className="app-peek">
          <Callout tone="neutral" title="Not found">
            {key} was deleted or renamed. Close this panel and pick another row.
          </Callout>
        </div>
      </Sheet>
    );
  }

  const envObj = (e) => ({ name: e.name, color: e.color, protected: e.protected });
  const staged = select.stagedOf(env.id)[key];
  const deleted = secret.status === "deleted";
  const values = envs.map((e) => {
    const row =
      e.id === env.id ? secret : select.secretsOf(e.id).find((r) => r.key === key && r.status !== "deleted") || null;
    return { env: e, row };
  });
  const missing = values.filter((v) => !v.row);
  const rowRefs = (r) => (typeof r.value === "string" ? refsIn(r.value) : r.refs || []);
  const refs = rowRefs(secret);
  const referencedBy = rows
    .filter((r) => r.key !== key && r.status !== "deleted" && rowRefs(r).includes(key))
    .map((r) => r.key);
  const resolve = (k) => {
    const r = rows.find((x) => x.key === k && x.status !== "deleted");
    return r ? r.value : undefined;
  };
  const exists = (k) => rows.some((x) => x.key === k && x.status !== "deleted");
  const openKey = (k) => {
    const r = rows.find((x) => x.key === k);
    if (r) actions.openSheet("secret", { secretId: r.id });
  };
  const rot = rotationInfo(saved || secret, now);
  const lengths = new Map(versions.list.map((v) => [v.version, v]));
  const history = versions.list.map((v, i) => ({
    version: v.version,
    author: v.createdByName || "Someone who left",
    summary: v.summary,
    value: v.value,
    date: v.createdAt,
    current: i === 0,
  }));
  const historyRenderer = versions.withValues
    ? undefined
    : (_value, ctx) => {
        const v = lengths.get(ctx.version);
        if (!v) return undefined;
        return (
          <span className="app-peek__fp">
            {v.length === 0 ? "Empty" : `${n(v.length, "character")}, fingerprint ${v.fingerprint.slice(0, 8)}`}
          </span>
        );
      };
  const updated = secret.updatedAt
    ? `updated ${relativeTime(secret.updatedAt, Math.max(now, new Date(secret.updatedAt).getTime()))} by ${nameOf(select, secret.updatedBy)}`
    : "not saved yet";

  const stageField = (patch) => {
    if (secret.status === "added") actions.stage(env.id, key, { op: "add", ...patch });
    else actions.stage(env.id, key, { op: "edit", ...patch });
  };
  const commitNote = () => {
    const base = saved ? saved.note || "" : "";
    if (note === (secret.note || "")) return;
    if (saved && note === base && staged && Object.keys(staged).every((k) => k === "op" || k === "note")) {
      actions.unstage(env.id, key);
      return;
    }
    stageField({ note });
  };
  const setSensitive = (v) => {
    if (saved && v === saved.sensitive && staged && Object.keys(staged).every((k) => k === "op" || k === "sensitive")) {
      actions.unstage(env.id, key);
      return;
    }
    stageField({ sensitive: v });
  };
  const restore = async (v) => {
    const list = versions.withValues ? versions.list : await loadVersions(true);
    const ver = list?.find((h) => h.version === v);
    if (!ver || typeof ver.value !== "string") return;
    actions.stage(env.id, key, {
      op: secret.status === "added" ? "add" : "edit",
      value: ver.value,
      summary: `Restored v${v}`,
    });
    actions.toast({
      title: `Staged v${v} of ${key}`,
      description: `Save ${env.name} to restore it. History keeps every version.`,
    });
  };
  const addTo = (target) => {
    actions.copyToEnv(
      [{ key, envId: env.id, value: secret.value, sensitive: secret.sensitive, note: secret.note }],
      target.id,
    );
  };

  const footer = (
    <>
      <Button
        variant="ghost"
        icon="trash-2"
        className="app-peek__delete"
        disabled={deleted || !writable}
        onClick={() => {
          actions.stageDelete(env.id, [key]);
          actions.toast({
            title: `Staged ${key} for deletion`,
            description: `Nothing leaves ${env.name} until you save.`,
            action: { label: "Undo", onClick: () => actions.unstage(env.id, key) },
          });
        }}
      >
        Delete from {env.name}
      </Button>
      <Button
        icon="link"
        disabled={!saved || deleted || !readable || secret.status !== "unchanged"}
        onClick={() => actions.openDialog("share", { secretId: secret.id })}
      >
        Share one time link
      </Button>
    </>
  );

  const headerActions = (
    <>
      <CopyButton
        value={secret.value || ""}
        label="Copy value"
        size="sm"
        onCopied={() => actions.copied(secret)}
        disabled={deleted || !readable || !ready}
      />
      <Menu align="end" trigger={<IconButton icon="more-horizontal" label="More actions" size="sm" />}>
        <MenuItem
          icon="git-compare-arrows"
          label="Compare across environments"
          onSelect={() => actions.navigate("compare", { projectId: env.projectId })}
        />
        <MenuItem
          icon="activity"
          label="Show activity"
          onSelect={() => actions.navigate("activity", { projectId: env.projectId })}
        />
        {writable && <MenuSeparator />}
        {writable && (
          <MenuItem
            icon="trash-2"
            tone="danger"
            label={`Delete from ${env.name}`}
            disabled={deleted}
            onSelect={() => actions.stageDelete(env.id, [key])}
          />
        )}
      </Menu>
    </>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      modal={false}
      className="app-peek-sheet"
      title={<span className="app-peek__title">{key}</span>}
      description={`${project.name} · ${env.name} · ${updated}`}
      actions={headerActions}
      footer={footer}
      initialFocus={false}
    >
      <div className="app-peek">
        {deleted ? (
          <Callout
            tone="danger"
            icon="trash-2"
            title={`Staged for deletion from ${env.name}`}
            action={
              <Button size="sm" icon="undo-2" onClick={() => actions.unstage(env.id, key)}>
                Undo
              </Button>
            }
          >
            Saving {env.name} removes {key}. Services reading it fail on their next deploy.
          </Callout>
        ) : staged ? (
          <Callout tone="info" icon="pencil" title="Unsaved changes">
            This secret has staged edits in {env.name}. Review and save them from the changes bar.
          </Callout>
        ) : null}

        <Section title="Values" meta={`${values.length - missing.length} of ${values.length} environments`}>
          <div className="app-peek__values">
            {values.map(({ env: e, row }) => (
              <div key={e.id} className="app-peek__value" data-current={e.id === env.id || undefined}>
                <button
                  type="button"
                  className="app-peek__env"
                  onClick={() => {
                    actions.navigate("secrets", { projectId: e.projectId, envId: e.id, mode: "table" });
                    if (row) actions.openSheet("secret", { secretId: row.id });
                  }}
                  aria-label={`Open ${key} in ${e.name}`}
                >
                  <EnvBadge env={envObj(e)} size="sm" />
                </button>
                {row && !select.canRead(e.id) ? (
                  <div className="app-peek__value-main app-peek__value-missing">
                    <span>Set, but you cannot read {e.name}</span>
                  </div>
                ) : row ? (
                  <div className="app-peek__value-main">
                    <SecretValue
                      key={`${e.id}:${row.value}`}
                      value={row.value}
                      sensitive={row.sensitive !== false}
                      revealTimeout={(state.prefs.revealTimeoutSec || 10) * 1000}
                      resolve={e.id === env.id ? resolve : undefined}
                      secretKey={key}
                      revealable={row.sensitive !== false}
                      onRevealedChange={(on) => {
                        if (on) actions.logReveal({ ...row, projectId: e.projectId, envId: e.id });
                      }}
                    />
                    <CopyButton
                      value={row.value || ""}
                      size="xs"
                      label={`Copy value from ${e.name}`}
                      onCopied={() => actions.copied(row)}
                    />
                    {(row.status === "unchanged" ? row.looksLive : isLiveKey(row.value)) && e.name !== "production" ? (
                      <Badge tone="danger" icon="circle-alert">
                        Live key
                      </Badge>
                    ) : null}
                    {row.status === "added" || row.status === "modified" ? (
                      <Badge tone="warning" variant="outline">
                        Unsaved
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <div className="app-peek__value-main app-peek__value-missing">
                    <span>Not set</span>
                    {select.canWrite(e.id) && readable ? (
                      <Button size="sm" variant="ghost" icon="plus" onClick={() => addTo(e)}>
                        Add to {e.name}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Note">
          <Textarea
            autoGrow
            minRows={2}
            maxRows={6}
            value={note}
            onValueChange={setNote}
            onBlur={commitNote}
            placeholder="Where this value comes from, who owns it, how to rotate it"
            aria-label={`Note for ${key}`}
            disabled={deleted || !writable}
          />
        </Section>

        <Section title="Protection">
          <Switch
            label="Sensitive"
            description={
              secret.sensitive !== false
                ? `Masked everywhere and hidden again ${state.prefs.revealTimeoutSec || 10}s after a reveal. Every reveal is logged.`
                : "Shown as plain text, like LOG_LEVEL or AWS_REGION."
            }
            labelPosition="start"
            checked={secret.sensitive !== false}
            onCheckedChange={setSensitive}
            disabled={deleted || !writable}
          />
        </Section>

        {secret.sensitive !== false || saved?.rotateEveryDays ? (
          <Section
            title="Rotation"
            id="app-peek-rotation"
            innerRef={rotationRef}
            meta={
              rot?.due ? (
                <Badge tone="warning" icon="history">
                  Rotation due
                </Badge>
              ) : null
            }
          >
            <div className="app-peek__rotation">
              <Select
                size="sm"
                aria-label="Rotation policy"
                options={ROTATION}
                value={String(saved?.rotateEveryDays || 0)}
                onValueChange={(v) => actions.setRotation(secret.id, Number(v))}
                disabled={!saved || deleted || !writable}
              />
              <Button
                size="sm"
                icon="rotate-cw"
                disabled={deleted || !writable}
                onClick={() => actions.rotateNow(secret)}
              >
                Rotate now
              </Button>
            </div>
            <p className="app-peek__hint">
              {rot
                ? rot.due
                  ? `Last rotated ${rot.age} days ago, ${rot.age - rot.every} days past the ${rot.every} day policy.`
                  : `Last rotated ${rot.age} days ago. Next rotation in ${rot.every - rot.age} days.`
                : secret.looksLive && env.name !== "production"
                  ? `Replace it with a test key from the provider, or rotate it there and paste the new key. ${env.name} should not hold live keys.`
                  : "No rotation policy. Rotate now stages a new random value; services pick it up on their next deploy."}
            </p>
          </Section>
        ) : null}

        {refs.length || referencedBy.length ? (
          <Section title="References">
            <ul className="app-peek__refs">
              {refs.map((r) => (
                <li key={`to-${r}`}>
                  <Icon name="arrow-right" size={14} />
                  <span>References</span>
                  <button type="button" className="app-peek__ref" onClick={() => openKey(r)}>
                    {r}
                  </button>
                  {!exists(r) ? (
                    <Badge tone="danger" icon="circle-alert">
                      Not set in {env.name}
                    </Badge>
                  ) : null}
                </li>
              ))}
              {referencedBy.map((r) => (
                <li key={`by-${r}`}>
                  <Icon name="arrow-left" size={14} />
                  <span>Referenced by</span>
                  <button type="button" className="app-peek__ref" onClick={() => openKey(r)}>
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section
          title="History"
          id="app-peek-history"
          innerRef={historyRef}
          meta={
            readable && history.length && !versions.withValues ? (
              <Button
                size="sm"
                variant="ghost"
                icon="eye"
                loading={versions.status === "loading"}
                onClick={() => loadVersions(true)}
              >
                Show values
              </Button>
            ) : (
              n(history.length, "version")
            )
          }
        >
          {history.length || versions.status === "loading" ? (
            <VersionTimeline
              versions={history}
              avatars
              now={now}
              loading={versions.status === "loading" && !history.length}
              valueRenderer={historyRenderer}
              revealTimeout={(state.prefs.revealTimeoutSec || 10) * 1000}
              onRestore={deleted || !writable || !readable ? undefined : restore}
            />
          ) : (
            <p className="app-peek__hint">This secret has no saved versions yet. Save {env.name} to create v1.</p>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
