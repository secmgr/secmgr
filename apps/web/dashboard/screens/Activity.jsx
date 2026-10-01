import {
  ActivityFeed,
  Avatar,
  Button,
  EmptyState,
  EnvDot,
  Menu,
  MenuItem,
  n,
  PageHeader,
  SearchField,
  Select,
} from "@secmgr/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { activityItem } from "../shell/format.js";
import { useStore } from "../store";
import { liveNow, ProjectMissing } from "./NotFound.parts.jsx";

const ACTIONS = [
  { value: "update", label: "Updated", icon: "pencil" },
  { value: "create", label: "Added", icon: "plus" },
  { value: "delete", label: "Deleted", icon: "trash-2" },
  { value: "restore", label: "Undone", icon: "undo-2" },
  { value: "rotate", label: "Rotated", icon: "rotate-cw" },
  { value: "import", label: "Imported", icon: "upload" },
  { value: "reveal", label: "Revealed", icon: "eye" },
  { value: "copy", label: "Copied", icon: "copy" },
  { value: "export", label: "Exported", icon: "download" },
  { value: "read", label: "Read by a token", icon: "key-round" },
  { value: "share", label: "Shared", icon: "link" },
  { value: "protect", label: "Protected", icon: "lock" },
  { value: "unprotect", label: "Unprotected", icon: "lock-open" },
  { value: "create-env", label: "Environment created", icon: "layers" },
  { value: "update-env", label: "Environment changed", icon: "layers" },
  { value: "delete-env", label: "Environment deleted", icon: "layers" },
  { value: "access", label: "Access changed", icon: "shield" },
  { value: "token", label: "Tokens", icon: "bot" },
  { value: "invite", label: "Invites", icon: "user-plus" },
  { value: "member", label: "Members", icon: "users" },
  { value: "create-project", label: "Project created", icon: "folder-git-2" },
  { value: "update-project", label: "Project changed", icon: "folder-git-2" },
  { value: "archive-project", label: "Project archived", icon: "archive" },
  { value: "delete-project", label: "Project deleted", icon: "folder-git-2" },
  { value: "workspace", label: "Workspace", icon: "building-2" },
];

const PAGE = 100;

export default function Activity() {
  const { state, select } = useStore();
  const pid = state.route.params.projectId;
  if (pid && !select.projectById(pid)) return <ProjectMissing projectId={pid} />;
  return <ActivityView key={pid || "all"} />;
}

function ActivityView() {
  const { state, actions, select } = useStore();
  const projectId = state.route.params.projectId || null;
  const project = projectId ? select.projectById(projectId) : null;
  const now = liveNow(select);
  const d = state.data;

  const [actor, setActor] = useState("all");
  const [kind, setKind] = useState("all");
  const [envId, setEnvId] = useState("all");
  const [proj, setProj] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState({ status: "loading", entries: [], next: null, envNames: {} });
  const request = useRef(0);

  const scopeProject = project ? project.id : proj !== "all" ? proj : null;
  const scopedEnvs = scopeProject ? select.envsOf(scopeProject) : [];

  const filters = useMemo(
    () => ({
      project: scopeProject || undefined,
      env: envId !== "all" ? envId : undefined,
      actor: actor !== "all" ? actor : undefined,
      action: kind !== "all" ? kind : undefined,
      limit: String(PAGE),
    }),
    [scopeProject, envId, actor, kind],
  );

  const load = useCallback(
    async (before) => {
      const id = ++request.current;
      setPage((p) => ({ ...p, status: before ? "more" : "loading", entries: before ? p.entries : [] }));
      try {
        const result = await api.activity(d.workspace.slug, { ...filters, before });
        if (id !== request.current) return;
        setPage((p) => ({
          status: "ready",
          entries: before ? [...p.entries, ...result.entries] : result.entries,
          next: result.next,
          envNames: { ...p.envNames, ...result.environments },
        }));
      } catch (error) {
        if (id !== request.current) return;
        setPage((p) => ({ ...p, status: "error", error: error instanceof Error ? error.message : String(error) }));
      }
    },
    [filters, d.workspace.slug],
  );

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return page.entries;
    return page.entries.filter((a) =>
      [...(a.keys || []), a.target || "", a.actorName || ""].join(" ").toLowerCase().includes(q),
    );
  }, [page.entries, query]);

  const withEnvName = (a) => {
    if (!a.envId || select.envById(a.envId)) return a;
    const named = page.envNames[a.envId];
    return named ? { ...a, detail: { ...a.detail, environment: named.name } } : a;
  };

  const projectName = (id) => (id ? select.projectById(id)?.name : null);
  const items = entries.map((a) => ({ ...activityItem(withEnvName(a), select), className: "act-item" }));

  const reveals = entries.filter((a) => a.action === "reveal").length;
  const reads = entries.filter((a) => a.action === "read" && a.actorKind === "token").length;
  const filtersOn = actor !== "all" || kind !== "all" || envId !== "all" || proj !== "all" || query.trim() !== "";
  const clear = () => {
    setActor("all");
    setKind("all");
    setEnvId("all");
    setProj("all");
    setQuery("");
  };

  const rowsForExport = () =>
    entries.map((a) => ({
      time: a.at,
      actor: a.actorName,
      actorKind: a.actorKind,
      action: a.action,
      project: projectName(a.projectId) || "",
      environment: a.envId ? select.envById(a.envId)?.name || page.envNames[a.envId]?.name || "" : "",
      keys: a.keys || [],
      target: a.target || "",
      detail: a.detail || {},
    }));
  const exportCsv = () => {
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const head = ["time", "actor", "actor_kind", "action", "project", "environment", "keys", "target"];
    const lines = rowsForExport().map((r) =>
      [r.time, r.actor, r.actorKind, r.action, r.project, r.environment, r.keys.join(" "), r.target].map(esc).join(","),
    );
    actions.copyString(
      [head.join(","), ...lines].join("\n"),
      `Copied ${n(entries.length, "entry", "entries")} as CSV`,
      "Paste into a spreadsheet. The current filters apply.",
    );
  };
  const exportJson = () =>
    actions.copyString(
      JSON.stringify(rowsForExport(), null, 2),
      `Copied ${n(entries.length, "entry", "entries")} as JSON`,
      "The current filters apply.",
    );

  const memberOptions = [
    { value: "all", label: "Everyone" },
    ...d.members.map((m) => ({
      value: m.id,
      label: m.name,
      prefix: <Avatar name={m.name} size={16} title={null} />,
      group: "Members",
    })),
    ...d.tokens.map((t) => ({
      value: t.id,
      label: t.name,
      prefix: <Avatar name={t.name} size={16} kind="service" title={null} />,
      group: "Tokens",
    })),
  ];
  const envOptions = [
    { value: "all", label: "All environments" },
    ...scopedEnvs.map((e) => ({ value: e.id, label: e.name, prefix: <EnvDot color={e.color} /> })),
  ];

  return (
    <div className="pg act">
      <PageHeader
        title="Activity"
        description={
          project ? (
            <>
              Every change, reveal and token read in <code className="pg-code">{project.name}</code>. Entries cannot be
              edited or deleted.
            </>
          ) : (
            <>Every change, reveal and token read in {d.workspace.name}. Entries cannot be edited or deleted.</>
          )
        }
        actions={
          <Menu
            align="end"
            trigger={
              <Button variant="secondary" icon="copy" iconRight="chevron-down" disabled={!entries.length}>
                Export
              </Button>
            }
          >
            <MenuItem
              icon="table-2"
              label="Copy as CSV"
              description={`${n(entries.length, "entry", "entries")} with the current filters`}
              onSelect={exportCsv}
            />
            <MenuItem
              icon="file-code"
              label="Copy as JSON"
              description="For scripts and audits"
              onSelect={exportJson}
            />
          </Menu>
        }
      />
      <div className="pg__body">
        <div className="act-filters" role="search" aria-label="Filter activity">
          <SearchField
            className="act-filters__search"
            size="sm"
            placeholder="Search keys and names"
            value={query}
            onValueChange={setQuery}
            count={entries.length}
            total={page.entries.length}
            noun="entry"
          />
          {!project && (
            <Select
              size="sm"
              className="act-filters__select"
              aria-label="Project"
              value={proj}
              onValueChange={(v) => {
                setProj(v);
                setEnvId("all");
              }}
              options={[
                { value: "all", label: "All projects" },
                ...d.projects.map((p) => ({ value: p.id, label: p.name, icon: "folder-git-2" })),
              ]}
            />
          )}
          <Select
            size="sm"
            className="act-filters__select"
            aria-label="Member"
            value={actor}
            onValueChange={setActor}
            options={memberOptions}
            searchable
          />
          <Select
            size="sm"
            className="act-filters__select"
            aria-label="Action"
            value={kind}
            onValueChange={setKind}
            options={[{ value: "all", label: "All actions" }, ...ACTIONS]}
            searchable
          />
          {scopeProject && (
            <Select
              size="sm"
              className="act-filters__select"
              aria-label="Environment"
              value={envId}
              onValueChange={setEnvId}
              options={envOptions}
            />
          )}
          {filtersOn && (
            <Button variant="ghost" size="sm" icon="x" onClick={clear}>
              Clear
            </Button>
          )}
        </div>

        <p className="act-summary">
          <span className="pg-tabular">
            {n(entries.length, "event")}
            {page.next ? " loaded" : ""}
          </span>
          <span className="pg-tabular">{n(reveals, "reveal")}</span>
          <span className="pg-tabular">{n(reads, "token read")}</span>
          <span className="act-summary__note">Reveals, copies, exports and token reads are always logged.</span>
        </p>

        {page.status === "error" ? (
          <EmptyState
            variant="inline"
            icon="cloud-off"
            title="Could not load activity"
            description={page.error}
            actions={
              <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => load()}>
                Try again
              </Button>
            }
          />
        ) : (
          <ActivityFeed
            className="act-feed"
            items={items}
            now={now}
            avatars
            loading={page.status === "loading"}
            empty={
              filtersOn ? (
                <EmptyState
                  variant="inline"
                  icon="list-filter"
                  title={query.trim() ? `No activity matches "${query.trim()}"` : "No activity matches these filters"}
                  description="Clear the filters to see everything again."
                  actions={
                    <Button size="sm" variant="secondary" onClick={clear}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon="history"
                  title="No activity yet"
                  description="Changes, reveals and token reads show up here the moment they happen."
                />
              )
            }
          />
        )}
        {page.next && page.status !== "error" && (
          <div className="act-more">
            <Button variant="secondary" size="sm" loading={page.status === "more"} onClick={() => load(page.next)}>
              Load older activity
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
