import { EnvBadge, parseDotenv } from "@secmgr/ui";
import * as React from "react";

export const DAY = 86400000;

export function nameOf(select, id) {
  if (!id) return "";
  const m = select.memberById(id);
  return m?.name || id;
}

export function firstNameOf(select, id) {
  return nameOf(select, id).split(" ")[0];
}

export function isToken(select, id) {
  const m = select.memberById(id);
  return !!(m && m.kind === "token");
}

export function rotationInfo(secret, now) {
  if (!secret?.rotateEveryDays || !secret.lastRotatedAt) return null;
  const age = Math.floor((now - new Date(secret.lastRotatedAt).getTime()) / DAY);
  return { age, every: secret.rotateEveryDays, due: age > secret.rotateEveryDays };
}

export function guessSensitive(key, value) {
  const v = String(value || "").trim();
  if (/^(true|false|on|off|yes|no|\d+(\.\d+)?|debug|info|warn|warning|error|trace)$/i.test(v)) return false;
  if (
    /(^|_)(REGION|BUCKET|PORT|HOST|LOG_LEVEL|ENV|ENVIRONMENT|FROM|ORIGINS|DOMAIN)$/.test(key) &&
    !/:\/\/[^/\s]*@/.test(v)
  )
    return false;
  if (/_URL$/.test(key) && /^https?:\/\//.test(v) && !/:\/\/[^/\s]*@/.test(v) && !/[?&](token|key|secret)=/i.test(v))
    return false;
  return true;
}

export function isLiveKey(value) {
  return /(^|[^A-Za-z0-9])(sk|rk|pk)_live_/.test(value || "");
}

export function envByName(select, projectId, name) {
  return select.envsOf(projectId).find((e) => e.name === name) || null;
}

export function contextEnvId(state, select) {
  const p = state.route.params || {};
  if (p.envId && select.envById(p.envId)) return p.envId;
  const last = state.ui.lastEnvId && select.envById(state.ui.lastEnvId);
  if (p.projectId) {
    if (last && last.projectId === p.projectId) return last.id;
    const envs = select.envsOf(p.projectId);
    return envs.length ? envs[0].id : null;
  }
  if (last) return last.id;
  const first = state.data.environments.find((e) => e.access === "write") || state.data.environments[0];
  return first ? first.id : null;
}

export function contextProjectId(state, select) {
  const p = state.route.params || {};
  if (p.projectId && select.projectById(p.projectId)) return p.projectId;
  const last = state.ui.lastEnvId && select.envById(state.ui.lastEnvId);
  if (last) return last.projectId;
  const first = state.data.projects.find((p) => !p.archived) || state.data.projects[0];
  return first ? first.id : null;
}

function quoteValue(v) {
  const value = v == null ? "" : String(v);
  if (value === "") return "";
  const needs = /[\n\r"'`#]|^\s|\s$|\s/.test(value);
  if (!needs) return value;
  if (!/[\n'\\]/.test(value) && /"/.test(value)) return `'${value}'`;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function serializeEnv(rows, { header } = {}) {
  const lines = [];
  if (header) lines.push(`# ${header}`, "");
  for (const r of rows) lines.push(`${r.key}=${quoteValue(r.value)}`);
  return lines.join("\n");
}

export function formatExport(rows, format, { envName, projectId, masked } = {}) {
  const v = (r) => (masked ? (r.value ? "••••••••••••" : "") : r.value || "");
  if (format === "json") {
    const obj = {};
    for (const r of rows) obj[r.key] = v(r);
    return JSON.stringify(obj, null, 2);
  }
  if (format === "yaml") {
    return rows.map((r) => `${r.key}: ${JSON.stringify(v(r))}`).join("\n");
  }
  if (format === "docker") {
    const flags = rows.map((r) => `  -e ${r.key}=${shellQuote(v(r))} \\`);
    return [`docker run \\`, ...flags, `  ${projectId || "app"}:latest`].join("\n");
  }
  if (format === "k8s") {
    return [
      "apiVersion: v1",
      "kind: Secret",
      "metadata:",
      `  name: ${projectId || "app"}-${envName || "env"}`,
      "type: Opaque",
      "stringData:",
      ...rows.map((r) => `  ${r.key}: ${JSON.stringify(v(r))}`),
    ].join("\n");
  }
  return rows.map((r) => `${r.key}=${masked ? v(r) : quoteValue(r.value)}`).join("\n");
}

function shellQuote(s) {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export function diffDotenv(text, rows) {
  const parsed = parseDotenv(text);
  const current = new Map(rows.filter((r) => r.status !== "deleted").map((r) => [r.key, r]));
  const next = new Map();
  for (const e of parsed.entries) next.set(e.key, e.value);
  const added = [];
  const edited = [];
  const removed = [];
  for (const [key, value] of next) {
    const cur = current.get(key);
    if (!cur) added.push({ key, value });
    else if ((cur.value || "") !== value) edited.push({ key, value, previous: cur.value });
  }
  for (const [key] of current) if (!next.has(key)) removed.push({ key });
  return { parsed, added, edited, removed, total: added.length + edited.length + removed.length };
}

const ACTIONS = {
  update: "updated",
  create: "created",
  delete: "deleted",
  reveal: "revealed",
  read: "read",
  rotate: "rotated",
  import: "imported",
  protect: "protected",
  unprotect: "unprotected",
  copy: "copied",
  restore: "restored",
};

const ROLE_NAMES = { owner: "Owner", admin: "Admin", developer: "Developer", viewer: "Viewer" };

function envOfEntry(a, select) {
  const env = a.envId ? select.envById(a.envId) : null;
  if (env) return { name: env.name, color: env.color, protected: env.protected };
  return a.detail?.environment ? String(a.detail.environment) : undefined;
}

export function activityItem(a, select) {
  const envProp = envOfEntry(a, select);
  const token = a.actorKind === "token";
  const actor = a.actorName || nameOf(select, a.actor);
  const d = a.detail || {};
  const keys = a.keys?.length ? a.keys : undefined;
  const count = typeof d.count === "number" ? d.count : undefined;
  const base = { id: a.id, actor, actorType: token ? "token" : "member", date: a.at, env: envProp, keys, count };
  const who = token ? (
    <code className="sg-activity-item__actor sg-activity-item__actor--token">{actor}</code>
  ) : (
    <span className="sg-activity-item__actor">{actor}</span>
  );
  const where = envProp ? <EnvBadge env={envProp} size="sm" className="sg-activity-item__env" /> : null;
  const project = d.project ? <code className="sg-activity-item__key">{String(d.project)}</code> : null;
  if (a.action === "export")
    return {
      ...base,
      action: "read",
      icon: "download",
      children: (
        <>
          {who} exported {count ? `${count} secrets` : "secrets"} from {where}
          {d.format ? ` as ${d.format}` : ""}
        </>
      ),
    };
  if (ACTIONS[a.action]) return { ...base, action: ACTIONS[a.action] };
  if (a.action === "token")
    return {
      ...base,
      action: "updated",
      icon: "bot",
      children: (
        <>
          {who} {d.verb || "changed"} token <code className="sg-activity-item__key">{a.target}</code> for {where}
        </>
      ),
    };
  if (a.action === "invite")
    return {
      ...base,
      action: "created",
      icon: "user-plus",
      children: (
        <>
          {who} invited <span className="sg-activity-item__actor">{a.target}</span> as {ROLE_NAMES[d.role] || d.role}
        </>
      ),
    };
  if (a.action === "member") {
    const target = nameOf(select, a.target);
    if (d.removed)
      return {
        ...base,
        action: "deleted",
        icon: "user-minus",
        children: (
          <>
            {who} removed <span className="sg-activity-item__actor">{target}</span> from the workspace
          </>
        ),
      };
    return {
      ...base,
      action: "updated",
      icon: "user-cog",
      children: (
        <>
          {who} made <span className="sg-activity-item__actor">{target}</span> {ROLE_NAMES[d.role] || d.role}
        </>
      ),
    };
  }
  if (a.action === "access")
    return {
      ...base,
      action: "updated",
      icon: "shield",
      children: (
        <>
          {who} set access for{" "}
          <span className="sg-activity-item__actor">{nameOf(select, select.memberByMemberId(a.target)?.id)}</span> in{" "}
          {where} to {d.access}
        </>
      ),
    };
  if (a.action === "create-env")
    return {
      ...base,
      action: "created",
      icon: "layers",
      children: (
        <>
          {who} created {where}
          {d.message ? `. ${d.message}.` : ""}
        </>
      ),
    };
  if (a.action === "update-env")
    return {
      ...base,
      action: "updated",
      icon: "layers",
      children: (
        <>
          {who}{" "}
          {d.renamedFrom ? (
            <>
              renamed <code className="sg-activity-item__key">{String(d.renamedFrom)}</code> to
            </>
          ) : (
            "changed"
          )}{" "}
          {where}
        </>
      ),
    };
  if (a.action === "delete-env")
    return {
      ...base,
      action: "deleted",
      icon: "layers",
      children: (
        <>
          {who} deleted <code className="sg-activity-item__key">{a.target}</code> from {project}
        </>
      ),
    };
  if (a.action === "share")
    return {
      ...base,
      action: "copied",
      icon: "link",
      children: (
        <>
          {who} created a one time link for <code className="sg-activity-item__key">{(a.keys || [])[0]}</code> in{" "}
          {where}
        </>
      ),
    };
  if (a.action === "create-project")
    return {
      ...base,
      action: "created",
      icon: "folder-git-2",
      children: (
        <>
          {who} created {project}
        </>
      ),
    };
  if (a.action === "update-project")
    return {
      ...base,
      action: "updated",
      icon: "folder-git-2",
      children: (
        <>
          {who}{" "}
          {d.renamedFrom ? (
            <>
              renamed <code className="sg-activity-item__key">{String(d.renamedFrom)}</code> to
            </>
          ) : (
            "updated"
          )}{" "}
          {project}
        </>
      ),
    };
  if (a.action === "archive-project")
    return {
      ...base,
      action: "updated",
      icon: "archive",
      children: (
        <>
          {who} {d.archived ? "archived" : "restored"} {project}
        </>
      ),
    };
  if (a.action === "delete-project")
    return {
      ...base,
      action: "deleted",
      icon: "folder-git-2",
      children: (
        <>
          {who} deleted {project}
        </>
      ),
    };
  if (a.action === "workspace")
    return {
      ...base,
      action: "updated",
      icon: "building-2",
      children: (
        <>
          {who} renamed the workspace to {a.target}
        </>
      ),
    };
  return {
    ...base,
    action: "updated",
    children: (
      <>
        {who} {d.message ? String(d.message).charAt(0).toLowerCase() + String(d.message).slice(1) : `did ${a.action}`}
      </>
    ),
  };
}

export function activitySentence(a, select) {
  if (!a) return null;
  const who = (a.actorName || nameOf(select, a.actor)).split(" ")[0];
  const envProp = envOfEntry(a, select);
  const env = envProp ? (typeof envProp === "string" ? envProp : envProp.name) : "";
  const count = a.keys?.length ? a.keys.length : a.detail?.count || 0;
  const what =
    a.keys && a.keys.length === 1 ? <code>{a.keys[0]}</code> : `${count} ${count === 1 ? "secret" : "secrets"}`;
  switch (a.action) {
    case "update":
      return (
        <>
          {who} changed {what} in {env}
        </>
      );
    case "create":
      return (
        <>
          {who} added {what} to {env}
        </>
      );
    case "delete":
      return (
        <>
          {who} deleted {what} from {env}
        </>
      );
    case "reveal":
      return (
        <>
          {who} revealed {what} in {env}
        </>
      );
    case "read":
      return a.actorKind === "token" ? (
        <>
          <code>{a.actorName}</code> read {env}
        </>
      ) : (
        <>
          {who} opened {env}
        </>
      );
    case "export":
      return (
        <>
          {who} exported {env}
        </>
      );
    case "rotate":
      return (
        <>
          {who} rotated {what} in {env}
        </>
      );
    case "import":
      return (
        <>
          {who} imported {what} into {env}
        </>
      );
    case "restore":
      return (
        <>
          {who} undid a change in {env}
        </>
      );
    case "protect":
      return (
        <>
          {who} protected {env}
        </>
      );
    case "unprotect":
      return (
        <>
          {who} stopped protecting {env}
        </>
      );
    case "create-env":
      return (
        <>
          {who} created {env}
        </>
      );
    case "create-project":
      return <>{who} created the project</>;
    case "token":
      return (
        <>
          {who} {a.detail?.verb || "changed"} token <code>{a.target}</code>
        </>
      );
    case "share":
      return (
        <>
          {who} shared {what} from {env}
        </>
      );
    default:
      return (
        <>
          {who} changed {env || "the project"}
        </>
      );
  }
}

export function useLatch(onClose, ms = 200) {
  const [open, setOpen] = React.useState(true);
  const timer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const close = React.useCallback(() => {
    setOpen(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onClose?.(), ms);
  }, [onClose, ms]);
  return [open, close];
}
