import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ENV_COLORS,
  EnvBadge,
  EnvDot,
  Field,
  Icon,
  IconButton,
  Input,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  n,
  PageHeader,
  Select,
  Switch,
  Tooltip,
} from "@secmgr/ui";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { formatWhen, liveNow, ProjectMissing, toSlug, useClosable, useConfirm, useHotkey } from "./NotFound.parts.jsx";

const HUES = ENV_COLORS || ["gray", "blue", "teal", "green", "amber", "orange", "rose", "violet"];
const hueLabel = (c) => c.charAt(0).toUpperCase() + c.slice(1);

export default function Environments() {
  const { state, select } = useStore();
  const project = select.projectById(state.route.params.projectId);
  if (!project) return <ProjectMissing projectId={state.route.params.projectId} />;
  return <EnvironmentsView project={project} />;
}

function RenameDialog({ env, envs, onClose, onRename }) {
  const { open, close, onOpenChange } = useClosable(onClose);
  const [name, setName] = useState(env.name);
  const [tried, setTried] = useState(false);
  const slug = toSlug(name, { trim: true });
  const clash = envs.some((e) => e.id !== env.id && e.name === slug);
  const error = !slug
    ? "Name the environment, for example qa-eu."
    : !/^[a-z]/.test(slug)
      ? "Start the name with a letter."
      : clash
        ? `${slug} already exists in this project. Pick another name.`
        : null;
  const submit = (e) => {
    if (e) e.preventDefault();
    setTried(true);
    if (error) return;
    if (slug !== env.name) onRename(slug);
    close();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={`Rename ${env.name}`}
      description="Scripts and CI jobs that pass the old name to the CLI stop finding it."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={slug === env.name}>
            Rename
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="envs-form">
        <Field
          label="Name"
          error={tried || clash ? error : null}
          hint={
            <>
              Lowercase letters, digits and dashes. Used as{" "}
              <code className="pg-code pg-cmd">{`secmgr run --env ${slug || "name"}`}</code>
            </>
          }
        >
          <Input mono data-autofocus value={name} onValueChange={(v) => setName(toSlug(v))} placeholder="qa-eu" />
        </Field>
      </form>
    </Dialog>
  );
}

const ACCESS_OPTIONS = [
  { value: "default", label: "Role default" },
  { value: "write", label: "Read and write" },
  { value: "read", label: "Read only" },
  { value: "none", label: "No access" },
];

function roleDefault(role, env) {
  if (role === "viewer") return env.protected ? "Sees key names only" : "Read only";
  return "Read and write";
}

function AccessDialog({ env, onClose }) {
  const { state, actions } = useStore();
  const { open, close, onOpenChange } = useClosable(onClose);
  const [busy, setBusy] = useState(null);
  const members = state.data.members.filter((m) => m.roleValue !== "owner");
  const current = (memberId) =>
    (state.data.access || []).find((a) => a.envId === env.id && a.memberId === memberId)?.access ?? "default";
  const change = async (m, value) => {
    setBusy(m.memberId);
    const ok = await actions.setAccess(env.id, m.memberId, value === "default" ? null : value);
    setBusy(null);
    if (ok)
      actions.toast({
        title:
          value === "default"
            ? `${m.name} follows their role in ${env.name}`
            : `Changed ${m.name}'s access to ${env.name}`,
      });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={`Access to ${env.name}`}
      description="Overrides apply to this environment only. Owners always have full access."
      footer={
        <Button variant="secondary" onClick={close}>
          Done
        </Button>
      }
    >
      {members.length ? (
        <ul className="envs-access">
          {members.map((m) => {
            const value = current(m.memberId);
            return (
              <li key={m.memberId} className="envs-access__row">
                <span className="envs-access__who">
                  <span className="envs-access__name pg-trunc">{m.name}</span>
                  <span className="envs-access__hint pg-trunc">{`${m.role}${value === "default" ? `, ${roleDefault(m.roleValue, env).toLowerCase()}` : ""}`}</span>
                </span>
                <Select
                  size="sm"
                  className="envs-access__select"
                  aria-label={`Access for ${m.name}`}
                  value={value}
                  disabled={busy === m.memberId}
                  onValueChange={(v) => change(m, v)}
                  options={ACCESS_OPTIONS}
                  placement="bottom-end"
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          variant="inline"
          icon="users"
          title="Nobody to configure yet"
          description="Invite members to set their access to this environment."
        />
      )}
    </Dialog>
  );
}

function EnvironmentsView({ project }) {
  const { state, actions, select } = useStore();
  const envs = select.envsOf(project.id);
  const now = liveNow(select);
  const [order, setOrder] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [accessFor, setAccessFor] = useState(null);
  const manage = select.canManage;
  const focusId = state.route.params.envId;
  const [announce, setAnnounce] = useState("");
  const [confirmNode, ask] = useConfirm();
  const rowRefs = useRef({});
  const drag = useRef(null);
  const gripRefs = useRef({});

  useHotkey("n", () => actions.openDialog("create-environment", { projectId: project.id }), manage);

  useEffect(() => {
    if (!focusId) return;
    const el = rowRefs.current[focusId];
    if (el) {
      el.scrollIntoView({ block: "center" });
      const target = el.querySelector(".envs-row__open");
      if (target) target.focus({ preventScroll: true });
    }
  }, [focusId]);

  const list = order ? order.map((id) => envs.find((e) => e.id === id)).filter(Boolean) : envs;
  const count = (e) => select.rawSecretsOf(e.id).length;
  const tokensOn = (e) => state.data.tokens.filter((t) => t.envId === e.id);
  const latest = (e) => {
    const rows = select.rawSecretsOf(e.id);
    let best = null;
    for (const s of rows) if (s.updatedAt && (!best || s.updatedAt > best.updatedAt)) best = s;
    return best;
  };

  const commitOrder = async (ids, movedId) => {
    const before = envs.map((e) => e.id);
    if (ids.join() === before.join()) return;
    await actions.reorderEnvironments(project.id, ids);
    const moved = envs.find((e) => e.id === movedId);
    const pos = ids.indexOf(movedId) + 1;
    setAnnounce(moved ? `Moved ${moved.name} to position ${pos} of ${ids.length}` : "");
    actions.toast({
      title: moved ? `Moved ${moved.name} to position ${pos}` : "Saved environment order",
      description: "Tabs, compare columns and the command menu follow this order.",
      action: { label: "Undo", onClick: () => actions.reorderEnvironments(project.id, before) },
    });
  };

  const move = (env, delta) => {
    const ids = envs.map((e) => e.id);
    const i = ids.indexOf(env.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    commitOrder(ids, env.id);
    setTimeout(() => {
      const g = gripRefs.current[env.id];
      if (g) g.focus();
    }, 0);
  };

  const onGripDown = (e, env) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      return;
    }
    drag.current = { id: env.id, ids: envs.map((x) => x.id) };
    setOrder(drag.current.ids);
    setDragging(env.id);
  };
  const onGripMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const i = d.ids.indexOf(d.id);
    const rect = (id) => rowRefs.current[id]?.getBoundingClientRect();
    const prev = d.ids[i - 1];
    const next = d.ids[i + 1];
    let ids = null;
    if (prev) {
      const r = rect(prev);
      if (r && e.clientY < r.top + r.height / 2) {
        ids = d.ids.slice();
        [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
      }
    }
    if (!ids && next) {
      const r = rect(next);
      if (r && e.clientY > r.top + r.height / 2) {
        ids = d.ids.slice();
        [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
      }
    }
    if (ids) {
      d.ids = ids;
      setOrder(ids);
    }
  };
  const onGripUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    setOrder(null);
    if (d) commitOrder(d.ids, d.id);
  };
  const onGripKey = (e, env) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      move(env, e.key === "ArrowUp" ? -1 : 1);
    }
  };

  const setProtected = (env, on) => {
    if (on) {
      actions.updateEnvironment(env.id, { protected: true }).then((ok) => {
        if (ok)
          actions.toast({
            tone: "success",
            title: `${env.name} is protected`,
            description: "Saving changes to it now asks for its name.",
          });
      });
      return;
    }
    ask({
      title: `Remove protection from ${env.name}?`,
      description: `Anyone with write access can then save changes to ${env.name} without typing its name. Reveals stay logged.`,
      confirmLabel: "Remove protection",
      tone: "danger",
      requireText: env.name,
      onConfirm: async () => {
        const ok = await actions.updateEnvironment(env.id, { protected: false, confirm: env.name });
        if (ok)
          actions.toast({
            title: `Removed protection from ${env.name}`,
            action: { label: "Undo", onClick: () => actions.updateEnvironment(env.id, { protected: true }) },
          });
      },
    });
  };

  const setColor = async (env, color) => {
    if (color === env.color) return;
    const prev = env.color;
    const ok = await actions.updateEnvironment(env.id, { color });
    if (ok)
      actions.toast({
        title: `${env.name} is ${color} now`,
        description: "Tabs, badges and the matrix use the new color.",
        action: { label: "Undo", onClick: () => actions.updateEnvironment(env.id, { color: prev }) },
      });
  };

  const rename = async (env, name) => {
    const prev = env.name;
    const ok = await actions.updateEnvironment(env.id, { name });
    if (ok)
      actions.toast({
        title: `Renamed ${prev} to ${name}`,
        description: `Use secmgr run --env ${name} from now on.`,
        action: { label: "Undo", onClick: () => actions.updateEnvironment(env.id, { name: prev }) },
      });
  };

  const remove = (env) => {
    const secrets = count(env);
    const toks = tokensOn(env);
    ask({
      title: `Delete ${env.name}?`,
      description: `Deletes ${env.name} and its ${n(secrets, "secret")} from ${project.name}. Services reading them fail on their next deploy.${toks.length ? ` ${n(toks.length, "token")} scoped to it stop working.` : ""}`,
      confirmLabel: `Delete ${env.name}`,
      tone: "danger",
      requireText: env.name,
      onConfirm: async () => {
        const ok = await actions.deleteEnvironment(env.id, env.name);
        if (ok)
          actions.toast({
            title: `Deleted ${env.name}`,
            description: `${n(secrets, "secret")} removed from ${project.name}.`,
          });
      },
    });
  };

  const protectedCount = envs.filter((e) => e.protected).length;
  const header = (
    <PageHeader
      title="Environments"
      description={
        envs.length ? (
          <>
            {n(envs.length, "environment")} in <code className="pg-code">{project.name}</code>
            {protectedCount ? `, ${protectedCount} protected` : ""}. Drag to reorder; the order sets the tabs, the
            compare columns and the command menu.
          </>
        ) : (
          <>
            No environments in <code className="pg-code">{project.name}</code> yet.
          </>
        )
      }
      actions={
        <>
          {envs.length >= 2 && (
            <Button
              variant="secondary"
              icon="git-compare-arrows"
              onClick={() => actions.navigate("compare", { projectId: project.id })}
            >
              Compare
            </Button>
          )}
          {manage && (
            <Button
              variant="primary"
              icon="plus"
              kbd="n"
              onClick={() => actions.openDialog("create-environment", { projectId: project.id })}
            >
              New environment
            </Button>
          )}
        </>
      }
    />
  );

  if (!envs.length) {
    return (
      <div className="pg">
        {header}
        <EmptyState
          variant="page"
          icon="layers"
          title="Add your first environment"
          description="An environment holds one value per key: development on laptops, staging for review, production for customers."
          actions={
            manage ? (
              <Button
                variant="primary"
                icon="plus"
                onClick={() => actions.openDialog("create-environment", { projectId: project.id })}
              >
                New environment
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="pg envs">
      {header}
      <div className="pg__body">
        <span className="sg-visually-hidden" aria-live="polite">
          {announce}
        </span>
        {
          <Card padding="none">
            <ol className="envs-list" aria-label={`Environments of ${project.name}`}>
              {list.map((env, i) => {
                const last = latest(env);
                const toks = tokensOn(env);
                const who = last ? select.memberById(last.updatedBy) : null;
                return (
                  <li
                    key={env.id}
                    ref={(el) => {
                      rowRefs.current[env.id] = el;
                    }}
                    className="envs-row"
                    data-dragging={dragging === env.id || undefined}
                    data-protected={env.protected || undefined}
                  >
                    {manage ? (
                      <Tooltip content="Drag, or press the arrow keys, to reorder">
                        <button
                          type="button"
                          ref={(el) => {
                            gripRefs.current[env.id] = el;
                          }}
                          className="envs-row__grip"
                          aria-label={`Reorder ${env.name}, position ${i + 1} of ${list.length}`}
                          aria-roledescription="sortable"
                          onPointerDown={(e) => onGripDown(e, env)}
                          onPointerMove={onGripMove}
                          onPointerUp={onGripUp}
                          onPointerCancel={onGripUp}
                          onKeyDown={(e) => onGripKey(e, env)}
                        >
                          <Icon name="grip-vertical" size={16} />
                        </button>
                      </Tooltip>
                    ) : (
                      <span className="envs-row__grip" aria-hidden="true">
                        <Icon name={env.protected ? "lock" : "layers"} size={16} />
                      </span>
                    )}
                    <div className="envs-row__main">
                      <button
                        type="button"
                        className="envs-row__open"
                        onClick={() =>
                          actions.navigate("secrets", { projectId: project.id, envId: env.id, mode: "table" })
                        }
                        aria-label={`Open ${env.name} secrets`}
                      >
                        <EnvBadge env={env} />
                        <Icon name="arrow-right" size={14} className="envs-row__arrow" />
                      </button>
                      <span className="envs-row__meta">
                        <span className="pg-tabular">{n(count(env), "secret")}</span>
                        {toks.length > 0 && <span className="pg-tabular">{n(toks.length, "token")}</span>}
                        {last && (
                          <span className="pg-trunc">{`Updated ${formatWhen(last.updatedAt, now)}${who ? ` by ${who.name.split(" ")[0]}` : ""}`}</span>
                        )}
                      </span>
                    </div>
                    {manage ? (
                      <div className="envs-row__controls">
                        <Select
                          size="sm"
                          className="envs-row__color"
                          aria-label={`Color of ${env.name}`}
                          value={env.color}
                          onValueChange={(c) => setColor(env, c)}
                          options={HUES.map((c) => ({ value: c, label: hueLabel(c), prefix: <EnvDot color={c} /> }))}
                          placement="bottom-end"
                        />
                        <Switch
                          size="sm"
                          label="Protected"
                          checked={!!env.protected}
                          onCheckedChange={(v) => setProtected(env, v)}
                          aria-label={`Protect ${env.name}`}
                        />
                        <Menu
                          align="end"
                          trigger={<IconButton icon="more-horizontal" size="sm" label={`Actions for ${env.name}`} />}
                        >
                          <MenuLabel>{env.name}</MenuLabel>
                          <MenuItem
                            icon="key-round"
                            label="Open secrets"
                            onSelect={() =>
                              actions.navigate("secrets", { projectId: project.id, envId: env.id, mode: "table" })
                            }
                          />
                          <MenuItem icon="pencil" label="Rename" onSelect={() => setRenaming(env)} />
                          <MenuItem
                            icon="users"
                            label="Member access"
                            description="Override what each role can do here"
                            onSelect={() => setAccessFor(env)}
                          />
                          <MenuItem
                            icon="copy-plus"
                            label="Clone"
                            description={`New environment with its ${n(count(env), "secret")}`}
                            onSelect={() =>
                              actions.openDialog("create-environment", { projectId: project.id, cloneFrom: env.id })
                            }
                          />
                          <MenuSeparator />
                          <MenuItem icon="arrow-up" label="Move up" disabled={i === 0} onSelect={() => move(env, -1)} />
                          <MenuItem
                            icon="arrow-down"
                            label="Move down"
                            disabled={i === list.length - 1}
                            onSelect={() => move(env, 1)}
                          />
                          <MenuSeparator />
                          <MenuItem
                            icon="trash-2"
                            tone="danger"
                            label={`Delete ${env.name}`}
                            onSelect={() => remove(env)}
                          />
                        </Menu>
                      </div>
                    ) : (
                      <span className="envs-row__controls envs-row__access">
                        {env.access === "write"
                          ? "Read and write"
                          : env.access === "read"
                            ? "Read only"
                            : "Key names only"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        }
        <p className="pg__note">
          Protected environments show a lock everywhere and ask for their name before any change is saved.
        </p>
      </div>
      {accessFor && <AccessDialog env={accessFor} onClose={() => setAccessFor(null)} />}
      {renaming && (
        <RenameDialog
          env={renaming}
          envs={envs}
          onClose={() => setRenaming(null)}
          onRename={(name) => rename(renaming, name)}
        />
      )}
      {confirmNode}
    </div>
  );
}
