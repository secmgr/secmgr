import {
  Avatar,
  Badge,
  Button,
  Callout,
  ChangesBar,
  ConfirmDialog,
  EmptyState,
  EnvBadge,
  EnvDot,
  EnvEditor,
  EnvSwitcher,
  IconButton,
  Kbd,
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  n,
  PageHeader,
  relativeTime,
  SearchField,
  SecretRow,
  SecretTable,
  SegmentedControl,
  SkeletonRows,
  Tabs,
} from "@secmgr/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAY,
  diffDotenv,
  firstNameOf,
  guessSensitive,
  isLiveKey,
  nameOf,
  rotationInfo,
  serializeEnv,
} from "../shell/format.js";
import { HeaderActions } from "../shell/Header.jsx";
import { useEnvValues, useStore } from "../store";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "recent", label: "Changed recently" },
  { value: "missing", label: "Missing elsewhere" },
  { value: "rotation", label: "Rotation due" },
  { value: "sensitive", label: "Sensitive" },
];

const FILTER_EMPTY = {
  recent: "Nothing changed in the last 7 days",
  missing: "Every key here exists in the other environments",
  rotation: "No rotation is due",
  sensitive: "No sensitive secrets",
};

function exportLine(s) {
  const v = s.value || "";
  const q = /[\s"'`$\\#]/.test(v)
    ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\n/g, "\\n")}"`
    : v;
  return `export ${s.key}=${q}`;
}

function pressRowKey(id, key) {
  setTimeout(() => {
    const rows = document.querySelectorAll(".app-secrets .sg-secret-row[data-row-id]");
    const row = Array.from(rows).find((r) => r.getAttribute("data-row-id") === id);
    if (!row) return;
    row.focus({ preventScroll: true });
    row.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }, 30);
}

function EnvHealth({ env, rows }) {
  const { actions, select } = useStore();
  const insight = select
    .insightsFor(env.projectId)
    .find((i) => i.envs.includes(env.id) && (i.kind === "live-key" || i.kind === "rotation"));
  if (!insight) return null;
  const key = insight.keys[0];
  const row = rows.find((r) => r.key === key);
  if (insight.kind === "live-key") {
    return (
      <Callout
        tone="danger"
        title={insight.title}
        onDismiss={() => actions.dismissInsight(insight.id)}
        dismissLabel="Dismiss for now"
        action={
          row && select.canWrite(env.id) ? (
            <Button
              size="sm"
              icon="refresh-cw"
              onClick={() => actions.openSheet("secret", { secretId: row.id, section: "rotation" })}
            >
              Rotate key
            </Button>
          ) : null
        }
      >
        <code>{key}</code> is a live key. Anything run against {env.name} reaches real customers, and charges made from
        it are real.
      </Callout>
    );
  }
  const rot = row ? rotationInfo(row, select.now) : null;
  return (
    <Callout
      tone="warning"
      title={`${key} is due for rotation`}
      onDismiss={() => actions.dismissInsight(insight.id)}
      dismissLabel="Dismiss for now"
      action={
        row && select.canWrite(env.id) ? (
          <Button size="sm" icon="rotate-cw" onClick={() => actions.rotateNow(row)}>
            Rotate now
          </Button>
        ) : null
      }
    >
      Last rotated {rot ? rot.age : ""} days ago. This key rotates every {rot ? rot.every : 90} days. Rotating stages a
      new random value; services pick it up on their next deploy.
    </Callout>
  );
}

function RawEditor({ env, rows, readOnly }) {
  const { actions } = useStore();
  const live = useMemo(() => rows.filter((r) => r.status !== "deleted"), [rows]);
  const base = useMemo(() => serializeEnv(live), [live]);
  const [text, setText] = useState(base);
  const [hidden, setHidden] = useState(true);
  const resync = useRef(false);
  const prevBase = useRef(base);
  const dirty = text !== base;
  const diff = useMemo(() => diffDotenv(text, rows), [text, rows]);
  const errors = diff.parsed.errors.length;

  useEffect(() => {
    if (resync.current || text === prevBase.current) setText(base);
    resync.current = false;
    prevBase.current = base;
  }, [base]);

  const stage = useCallback(
    (opts = {}) => {
      if (readOnly) return 0;
      const d = diffDotenv(latest.current.text, latest.current.rows);
      if (!d.total || d.parsed.errors.length) return 0;
      const byKey = new Map(latest.current.rows.map((r) => [r.key, r]));
      for (const a of d.added) {
        const prev = byKey.get(a.key);
        if (prev && prev.status === "deleted") actions.stage(env.id, a.key, { op: "edit", value: a.value });
        else actions.stage(env.id, a.key, { op: "add", value: a.value, sensitive: guessSensitive(a.key, a.value) });
      }
      for (const e of d.edited) {
        const prev = byKey.get(e.key);
        actions.stage(env.id, e.key, { op: prev && prev.status === "added" ? "add" : "edit", value: e.value });
      }
      if (d.removed.length)
        actions.stageDelete(
          env.id,
          d.removed.map((r) => r.key),
        );
      resync.current = true;
      if (!opts.silent)
        actions.toast({
          title: `Staged ${n(d.total, "change")} in ${env.name}`,
          description: "Review them in the changes bar before you save.",
        });
      return d.total;
    },
    [env.id],
  );

  const latest = useRef({ text, rows });
  latest.current = { text, rows };
  useEffect(
    () => () => {
      const d = diffDotenv(latest.current.text, latest.current.rows);
      if (d.total && !d.parsed.errors.length) stage({ silent: false });
    },
    [],
  );

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S") && dirty) {
      e.preventDefault();
      e.stopPropagation();
      stage();
    }
  };

  const reveal = (h) => {
    setHidden(h);
    if (!h)
      actions.log({
        action: "reveal",
        projectId: env.projectId,
        envId: env.id,
        count: live.length,
        keys: live.length <= 2 ? live.map((r) => r.key) : undefined,
      });
  };

  const summary = [
    diff.added.length && `${diff.added.length} new`,
    diff.edited.length && `${diff.edited.length} edited`,
    diff.removed.length && `${diff.removed.length} deleted`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="app-raw" onKeyDown={onKeyDown}>
      <div className="app-raw__bar">
        <div className="app-raw__status" aria-live="polite">
          {errors ? (
            <span className="app-raw__error">
              {n(errors, "line")} could not be parsed. Fix the highlighted {errors === 1 ? "line" : "lines"} to stage.
            </span>
          ) : dirty && diff.total ? (
            <span>
              <span className="app-raw__count">{summary}</span> <span className="app-tertiary">not staged yet</span>
            </span>
          ) : (
            <span className="app-tertiary">
              Edit {env.name} as text. Changes stage into the bar below; nothing is saved until you save.
            </span>
          )}
        </div>
        <div className="app-raw__actions">
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setText(base)}>
            Reset
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="git-pull-request-arrow"
            kbd={dirty && diff.total && !errors ? ["mod", "s"] : undefined}
            disabled={!dirty || !diff.total || !!errors}
            onClick={() => stage()}
          >
            {diff.total && dirty ? `Stage ${n(diff.total, "change")}` : "Stage changes"}
          </Button>
        </div>
      </div>
      <EnvEditor
        value={text}
        onValueChange={setText}
        valuesHidden={hidden}
        onValuesHiddenChange={reveal}
        readOnly={readOnly}
        env={{ name: env.name, color: env.color, protected: env.protected }}
        minLines={12}
        maxHeight="none"
        aria-label={`Raw .env for ${env.name}`}
      />
    </div>
  );
}

function SecretsView({ project, env, mode }) {
  const { state, actions, select } = useStore();
  useEnvValues([env.id]);
  const prefs = state.prefs;
  const now = select.now;
  const envs = select.envsOf(project.id);
  const others = envs.filter((e) => e.id !== env.id);
  const envObj = { name: env.name, color: env.color, protected: env.protected };
  const query = state.ui.secretsQuery || "";
  const filter = state.ui.secretsFilter || "all";
  const density = prefs.density === "compact" ? "compact" : "comfortable";
  const writable = select.canWrite(env.id);
  const readable = select.canRead(env.id);
  const valuesStatus = select.valuesStatus(env.id);
  const loading =
    readable && (valuesStatus === "idle" || (valuesStatus === "loading" && !state.values[env.id]?.values));
  const valuesError = valuesStatus === "error" ? state.values[env.id]?.error : null;

  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const rows = useMemo(() => select.secretsOf(env.id), [state.data, state.staged, state.values, env.id]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const decorated = useMemo(
    () =>
      rows.map((r) => {
        const rot = rotationInfo(r, now);
        return {
          ...r,
          updatedBy: r.updatedBy ? nameOf(select, r.updatedBy) : undefined,
          missingIn: r.status === "added" ? [] : select.missingIn(r),
          rotationDue: rot?.due ? { age: rot.age, every: rot.every } : undefined,
        };
      }),
    [rows],
  );

  const live = decorated.filter((r) => r.status !== "deleted");
  const recentCut = now - 7 * DAY;
  const test = {
    all: () => true,
    recent: (r) => r.status !== "unchanged" || (r.updatedAt && new Date(r.updatedAt).getTime() > recentCut),
    missing: (r) => r.missingIn && r.missingIn.length > 0,
    rotation: (r) => !!r.rotationDue,
    sensitive: (r) => r.sensitive !== false,
  };
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, live.filter(test[f.value]).length]));
  const q = query.trim().toLowerCase();
  const filtered = decorated.filter(
    (r) => test[filter](r) && (!q || r.key.toLowerCase().includes(q) || (r.note || "").toLowerCase().includes(q)),
  );

  const latest = rows.filter((r) => r.updatedAt).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  const savedCount = rows.filter((r) => r.status !== "added").length;
  const description = latest
    ? `${n(savedCount, "secret")} · updated ${relativeTime(latest.updatedAt, Math.max(now, new Date(latest.updatedAt).getTime()))} by ${firstNameOf(select, latest.updatedBy)}`
    : `${n(savedCount, "secret")} in ${project.name}/${env.name}`;

  const staged = select.stagedOf(env.id);
  const stagedList = Object.values(staged);
  const changes = {
    edited: stagedList.filter((c) => c.op === "edit").length,
    added: stagedList.filter((c) => c.op === "add").length,
    deleted: stagedList.filter((c) => c.op === "delete").length,
  };
  const totalStaged = stagedList.length;

  useEffect(() => {
    if (!state.ui.offline) setSaveError(false);
  }, [state.ui.offline]);

  const peek = state.ui.sheet && state.ui.sheet.kind === "secret" ? state.ui.sheet.props.secretId : null;
  useEffect(() => {
    const rowsEls = document.querySelectorAll(".app-secrets .sg-secret-row[data-row-id]");
    rowsEls.forEach((el) => {
      if (el.getAttribute("data-row-id") === peek) el.setAttribute("data-peek", "");
      else el.removeAttribute("data-peek");
    });
  });

  const setMode = (m) => actions.navigate("secrets", { projectId: project.id, envId: env.id, mode: m });
  const setQuery = (v) => actions.ui({ secretsQuery: v });
  const setFilter = (v) => actions.ui({ secretsFilter: v });
  const openAdd = () => actions.openDialog("add-secrets", { envId: env.id });
  const openImport = () => actions.openSheet("import", { envId: env.id });
  const openPeek = (s) => actions.openSheet("secret", { secretId: s.id });
  const openHistory = (s) => actions.openSheet("secret", { secretId: s.id, section: "history" });
  const cli = `secmgr run --env ${env.name} -- npm run dev`;

  const onSave = (s, next) => {
    const raw = byKey.get(s.key);
    if (!raw) return;
    if (next.key !== s.key) {
      if (raw.status === "added") actions.unstage(env.id, s.key);
      else actions.stage(env.id, s.key, { op: "delete" });
      actions.stage(env.id, next.key, { op: "add", value: next.value, sensitive: raw.sensitive, note: raw.note || "" });
      actions.toast({
        title: `Renamed ${s.key} to ${next.key}`,
        description: "Staged as a new key and a deletion. Save to apply both.",
      });
      return;
    }
    if (raw.status === "added") {
      actions.stage(env.id, s.key, { op: "add", value: next.value });
      return;
    }
    const saved = raw.status === "modified" ? raw.previousValue : raw.value;
    const entry = staged[s.key] || {};
    const extra = Object.keys(entry).filter((k) => k !== "op" && k !== "value");
    if (next.value === saved && !extra.length) actions.unstage(env.id, s.key);
    else actions.stage(env.id, s.key, { op: "edit", value: next.value });
  };

  const onUndo = (s) => actions.unstage(env.id, s.key);
  const onReveal = (s, on) => {
    if (on) actions.logReveal({ ...s, projectId: project.id, envId: env.id });
  };
  const onCopy = (s) => actions.copied(s);

  const deleteKeys = (keys) => {
    const before = keys.map((k) => [k, staged[k]]);
    actions.stageDelete(env.id, keys);
    actions.toast({
      title: keys.length === 1 ? `Staged ${keys[0]} for deletion` : `Staged ${n(keys.length, "secret")} for deletion`,
      description: `Nothing leaves ${env.name} until you save.`,
      action: {
        label: "Undo",
        onClick: () =>
          before.forEach(([k, c]) => {
            actions.unstage(env.id, k);
            if (c) actions.stage(env.id, k, c);
          }),
      },
    });
  };

  const envItem = (e, onSelect) => (
    <MenuItem
      key={e.id}
      icon={<EnvDot color={e.color} size={8} />}
      label={e.name}
      description={e.protected ? "Protected, confirm on save" : undefined}
      onSelect={onSelect}
    />
  );

  const renderMenu = (s) => {
    const saved = s.status !== "added";
    return (
      <Menu align="end" trigger={<IconButton size="xs" icon="more-horizontal" label="More actions" />}>
        <MenuLabel>{s.key}</MenuLabel>
        <MenuItem icon="pencil" label="Edit" kbd="e" onSelect={() => setEditingId(s.id)} />
        <MenuItem icon="eye" label="Reveal value" kbd="r" disabled={!s.value} onSelect={() => pressRowKey(s.id, "r")} />
        <MenuItem icon="copy" label="Copy value" kbd="c" onSelect={() => actions.copyValue(s)} />
        <MenuItem
          icon="terminal"
          label="Copy as export statement"
          onSelect={() =>
            actions.copyString(
              exportLine(s),
              `Copied export statement for ${s.key}.`,
              prefs.clipboardClearSec ? `Clipboard clears in ${prefs.clipboardClearSec}s.` : undefined,
            )
          }
        />
        <MenuSub icon="arrow-right-left" label="Copy to environment">
          {others.map((e) => envItem(e, () => actions.copyToEnv([s], e.id)))}
        </MenuSub>
        <MenuSeparator />
        <MenuItem icon="history" label="Show history" disabled={!saved} onSelect={() => openHistory(s)} />
        <MenuItem
          icon="link"
          label="Share one time link"
          description="Expires after one view or 24 hours"
          disabled={!saved}
          onSelect={() => actions.openDialog("share", { secretId: s.id })}
        />
        <MenuSeparator />
        <MenuItem icon="trash-2" tone="danger" label={`Delete from ${env.name}`} onSelect={() => deleteKeys([s.key])} />
      </Menu>
    );
  };

  const bulkActions = (sel) => (
    <>
      <Menu
        trigger={
          <Button size="sm" variant="ghost" icon="arrow-right-left" iconRight="chevron-down">
            Copy to
          </Button>
        }
      >
        <MenuLabel>Copy {n(sel.length, "secret")} to</MenuLabel>
        {others.map((e) =>
          envItem(e, () => {
            actions.copyToEnv(sel, e.id);
            setSelected([]);
          }),
        )}
      </Menu>
      <Button
        size="sm"
        variant="ghost"
        icon="download"
        onClick={() => actions.openDialog("export", { envId: env.id, keys: sel.map((s) => s.key) })}
      >
        Export
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon="trash-2"
        className="app-danger-ghost"
        onClick={() => {
          deleteKeys(sel.map((s) => s.key));
          setSelected([]);
        }}
      >
        Delete
      </Button>
    </>
  );

  const save = async () => {
    if (!totalStaged || saving) return;
    if (env.protected) {
      actions.openDialog("review", { envId: env.id, confirm: true });
      return;
    }
    setSaveError(false);
    setSaving(true);
    try {
      await actions.commit(env.id);
    } catch (error) {
      if (error && error.code === "offline") setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    const before = { ...staged };
    const count = Object.keys(before).length;
    actions.discard(env.id);
    actions.toast({
      title: `Discarded ${n(count, "change")} in ${env.name}`,
      action: {
        label: "Undo",
        onClick: () => {
          for (const [k, c] of Object.entries(before)) actions.stage(env.id, k, c);
        },
      },
    });
  };

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
  };
  const filterLabel = FILTERS.find((f) => f.value === filter);
  const noResults = (
    <EmptyState
      variant="inline"
      icon="search-x"
      title={q ? `No secrets match "${query.trim()}"` : FILTER_EMPTY[filter] || "No secrets"}
      description={
        q ? (
          <>
            in {env.name}
            {filter !== "all" ? ` with the ${filterLabel.label.toLowerCase()} filter` : ""}. Check the spelling, or
            search every environment with <Kbd keys={["mod", "k"]} size="sm" />.
          </>
        ) : (
          `in ${project.name}/${env.name}.`
        )
      }
      actions={
        <Button size="sm" onClick={clearFilters}>
          {q ? "Clear search" : "Show all secrets"}
        </Button>
      }
    />
  );

  const empty = !loading && rows.length === 0;

  const pageActions = [
    <SegmentedControl
      key="mode"
      className="app-secrets__mode"
      value={mode}
      onValueChange={setMode}
      aria-label="View"
      options={[
        { value: "table", label: "Table", icon: "table-2" },
        { value: "raw", label: "Raw .env", icon: "file-code" },
      ]}
    />,
    writable ? (
      <Button key="import" icon="upload" kbd="i" onClick={openImport}>
        Import .env
      </Button>
    ) : null,
    writable ? (
      <Button key="add" variant="primary" icon="plus" kbd="c" onClick={openAdd}>
        Add secret
      </Button>
    ) : null,
    <Menu
      key="more"
      align="end"
      trigger={<IconButton variant="secondary" icon="more-horizontal" label="More actions" />}
    >
      {readable ? (
        <MenuItem
          icon="download"
          label="Export"
          description=".env, JSON, YAML, docker or Kubernetes"
          onSelect={() => actions.openDialog("export", { envId: env.id })}
        />
      ) : null}
      <MenuSub icon="git-compare-arrows" label="Compare with">
        {others.map((e) =>
          envItem(e, () =>
            actions.navigate("compare", { projectId: project.id, envs: [env.name, e.name], mode: "diff" }),
          ),
        )}
      </MenuSub>
      <MenuItem
        icon="terminal"
        label="Copy CLI command"
        description={cli}
        onSelect={() => actions.copyString(cli, "Copied CLI command", cli)}
      />
      <MenuSeparator />
      <MenuItem
        icon="settings"
        label="Environment settings"
        onSelect={() => actions.navigate("environments", { projectId: project.id, envId: env.id })}
      />
    </Menu>,
  ];

  return (
    <div className="app-page app-secrets" data-density={density} data-peek-open={peek ? "" : undefined}>
      <HeaderActions>
        <Button
          size="sm"
          variant="ghost"
          icon="git-compare-arrows"
          className="app-hide-narrow"
          onClick={() => actions.navigate("compare", { projectId: project.id })}
        >
          Compare
        </Button>
        <IconButton
          size="sm"
          icon="terminal"
          label="Copy CLI command"
          onClick={() => actions.copyString(cli, "Copied CLI command", cli)}
        />
      </HeaderActions>
      <PageHeader
        title="Secrets"
        meta={<EnvBadge env={envObj} />}
        description={description}
        actions={pageActions}
        tabs={
          <EnvSwitcher
            className="app-secrets__envs"
            environments={envs.map((e) => ({
              name: e.name,
              color: e.color,
              protected: e.protected,
              count: select.rawSecretsOf(e.id).length,
            }))}
            value={env.name}
            onValueChange={(name) => {
              const next = envs.find((e) => e.name === name);
              if (next) actions.navigate("secrets", { projectId: project.id, envId: next.id, mode });
            }}
            onAdd={() => actions.openDialog("create-environment", { projectId: project.id })}
            idPrefix="app-env"
          />
        }
      />
      <div
        className="app-page__body"
        role="tabpanel"
        id={`app-env-panel-${env.name}`}
        aria-labelledby={`app-env-tab-${env.name}`}
      >
        {!empty && <EnvHealth env={env} rows={rows} />}
        {!readable ? (
          <Callout tone="info" title={`You can see which keys exist in ${env.name}, not their values`}>
            {env.protected ? `${env.name} is protected. ` : ""}Ask an owner or admin for read access if you need the
            values.
          </Callout>
        ) : !writable ? (
          <Callout tone="info" title={`You have read access to ${env.name}`}>
            You can reveal, copy and export values. Ask an owner or admin for write access to change them.
          </Callout>
        ) : null}
        {valuesError ? (
          <Callout
            tone="danger"
            title="Could not load values"
            action={
              <Button size="sm" icon="refresh-cw" onClick={() => actions.loadValues(env.id, { force: true })}>
                Try again
              </Button>
            }
          >
            {valuesError}
          </Callout>
        ) : null}
        {empty ? (
          <EmptyState
            variant="page"
            icon="key-round"
            title={`No secrets in ${env.name} yet`}
            description={
              writable
                ? "Import a .env, paste one anywhere on this page, drop a file, or add secrets one by one."
                : `Nobody has added secrets to ${env.name} yet.`
            }
            actions={
              writable ? (
                <>
                  <Button icon="upload" onClick={openImport}>
                    Import .env
                  </Button>
                  <Button variant="primary" icon="plus" onClick={openAdd}>
                    Add secret
                  </Button>
                </>
              ) : undefined
            }
          />
        ) : mode === "raw" ? (
          !readable ? (
            <EmptyState
              variant="inline"
              icon="lock"
              title="Values are hidden"
              description={`The raw view needs read access to ${env.name}.`}
            />
          ) : loading ? (
            <SkeletonRows count={Math.min(rows.length, 10)} density={density} />
          ) : (
            <RawEditor key={env.id} env={env} rows={rows} readOnly={!writable} />
          )
        ) : (
          <>
            <div className="app-secrets__toolbar">
              <SearchField
                size="sm"
                className="app-secrets__search"
                value={query}
                onValueChange={setQuery}
                placeholder={`Search ${n(live.length, "secret")}`}
                count={filtered.filter((r) => r.status !== "deleted").length}
                total={live.length}
                noun="secret"
              />
              <Tabs
                className="app-secrets__filters"
                variant="pills"
                size="sm"
                label="Filter secrets"
                value={filter}
                onValueChange={setFilter}
                items={FILTERS.map((f) => ({
                  value: f.value,
                  label: f.label,
                  count: f.value === "all" ? undefined : counts[f.value],
                }))}
              />
              <Menu
                align="end"
                trigger={
                  <Button size="sm" variant="ghost" icon="sliders-horizontal" className="app-secrets__display">
                    Display
                  </Button>
                }
              >
                <MenuLabel>Density</MenuLabel>
                <MenuRadioGroup label="Density" value={density} onValueChange={(v) => actions.setPrefs({ density: v })}>
                  <MenuRadioItem value="comfortable" icon="rows-3" label="Comfortable" description="44px rows" />
                  <MenuRadioItem value="compact" icon="rows-4" label="Compact" description="36px rows" />
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuCheckboxItem
                  checked={prefs.groupByPrefix !== false}
                  onCheckedChange={(v) => actions.setPrefs({ groupByPrefix: v })}
                  label="Group by prefix"
                  description="STRIPE_, AWS_, DATABASE_"
                />
              </Menu>
            </div>
            {loading ? (
              <SkeletonRows count={Math.min(Math.max(rows.length, 5), 12)} density={density} />
            ) : (
              <SecretTable
                className="app-secrets__table"
                secrets={filtered}
                env={env.name}
                density={density}
                groups={prefs.groupByPrefix !== false && !q}
                selected={selected}
                onSelectedChange={setSelected}
                editingId={editingId}
                onEditingIdChange={setEditingId}
                onSave={onSave}
                onUndo={onUndo}
                onOpen={openPeek}
                onReveal={onReveal}
                onCopy={onCopy}
                onHistory={openHistory}
                renderMenu={renderMenu}
                renderAvatar={(s) => (s.updatedBy ? <Avatar name={s.updatedBy} size={16} title={null} /> : null)}
                renderBadges={(s) =>
                  (s.status === "unchanged" ? s.looksLive : isLiveKey(s.value)) && env.name !== "production" ? (
                    <Badge tone="danger" icon="circle-alert">
                      Live key
                    </Badge>
                  ) : null
                }
                readOnly={!writable}
                locked={!readable}
                revealTimeout={(prefs.revealTimeoutSec || 10) * 1000}
                now={now}
                bulkActions={bulkActions}
                onFocusCapture={(e) => {
                  if (!peek || !e.target?.getAttribute) return;
                  const id = e.target.getAttribute("data-row-id");
                  if (id && id !== peek && id !== "__draft" && !id.startsWith("group:"))
                    actions.openSheet("secret", { secretId: id });
                }}
                empty={noResults}
                footer={
                  draft || !writable ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="plus"
                      className="app-secrets__add-row"
                      onClick={() => {
                        setDraft(true);
                        clearFilters();
                      }}
                    >
                      Add secret
                    </Button>
                  )
                }
              >
                {draft ? (
                  <SecretRow
                    secret={{ id: "__draft", key: "", value: "", sensitive: true }}
                    defaultEditing
                    selectable
                    onSave={(next) => {
                      actions.stage(env.id, next.key, {
                        op: "add",
                        value: next.value,
                        sensitive: guessSensitive(next.key, next.value),
                        note: "",
                      });
                      setDraft(false);
                    }}
                    onCancel={() => setDraft(false)}
                  />
                ) : null}
              </SecretTable>
            )}
          </>
        )}
      </div>
      <ChangesBar
        changes={changes}
        env={envObj}
        saving={saving}
        error={saveError ? `Could not reach the server. ${n(totalStaged, "change")} kept.` : undefined}
        onSave={save}
        onRetry={save}
        onDiscard={() => setConfirmDiscard(true)}
        onReview={() => actions.openDialog("review", { envId: env.id })}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        tone="danger"
        title={`Discard ${n(totalStaged, "change")}?`}
        description={`Your unsaved edits to ${env.name} are removed. Saved values stay as they are.`}
        confirmLabel={`Discard ${n(totalStaged, "change")}`}
        cancelLabel="Keep editing"
        onConfirm={discard}
      />
    </div>
  );
}

export default function Secrets() {
  const { state, actions, select } = useStore();
  const p = state.route.params || {};
  const project = select.projectById(p.projectId);
  const env = p.envId ? select.envById(p.envId) : null;
  const fallback = project ? select.envsOf(project.id)[0] : null;
  const mode = p.mode === "raw" ? "raw" : "table";

  useEffect(() => {
    if (project && (!env || env.projectId !== project.id) && fallback)
      actions.navigate("secrets", { projectId: project.id, envId: fallback.id, mode });
  }, [project?.id, env?.id]);

  if (!project) {
    return (
      <div className="app-page">
        <div className="app-page__body">
          <EmptyState
            variant="page"
            icon="folder-git-2"
            title="This project does not exist"
            description="It may have been deleted, or you may not have access to it."
            actions={
              <Button variant="primary" icon="arrow-left" onClick={() => actions.navigate("projects")}>
                Go to projects
              </Button>
            }
          />
        </div>
      </div>
    );
  }
  if (!env || env.projectId !== project.id) return null;
  return <SecretsView project={project} env={env} mode={mode} />;
}
