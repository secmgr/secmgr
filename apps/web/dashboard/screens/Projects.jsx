import {
  Badge,
  Button,
  CodeBlock,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  n,
  PageHeader,
  ProjectCard,
  relativeTime,
  SearchField,
  SegmentedControl,
} from "@secmgr/ui";
import { useMemo, useState } from "react";
import { activitySentence } from "../shell/format.js";
import { useRecentActivity, useStore } from "../store";

function healthBadge(insights, short, select) {
  const live = insights.find((i) => i.kind === "live-key");
  if (live)
    return (
      <Badge tone="danger" icon="circle-alert">
        {short ? "Live key" : `Live key in ${select.envById(live.envs[0])?.name || "an environment"}`}
      </Badge>
    );
  const shared = insights.find((i) => i.kind === "shared");
  if (shared)
    return (
      <Badge tone="danger" icon="circle-alert">
        {short ? "Shared key" : "Shared with production"}
      </Badge>
    );
  return undefined;
}

export default function Projects() {
  const { state, actions, select } = useStore();
  useRecentActivity();
  const [query, setQuery] = useState("");
  const view = state.prefs.projectsView === "list" ? "list" : "grid";
  const loading = !!state.ui.loading;
  const now = select.now;

  const all = useMemo(() => {
    const latest = (p) => {
      const a = select.activityFor({ projectId: p.id })[0];
      return a ? a.at : "";
    };
    return state.data.projects
      .filter((p) => !p.archived)
      .sort((a, b) => (a.starred !== b.starred ? (a.starred ? -1 : 1) : latest(a) < latest(b) ? 1 : -1));
  }, [state.data, state.activity]);
  const archived = state.data.projects.filter((p) => p.archived);

  const q = query.trim().toLowerCase();
  const shown = all.filter(
    (p) => !q || [p.name, p.repo, p.description, p.language].some((x) => (x || "").toLowerCase().includes(q)),
  );
  const starred = shown.filter((p) => p.starred);
  const rest = shown.filter((p) => !p.starred);
  const issuesTotal = all.reduce((sum, p) => sum + select.insightsFor(p.id).length, 0);

  const card = (p) => {
    const envs = select
      .envsOf(p.id)
      .map((e) => ({ name: e.name, color: e.color, protected: e.protected, count: select.rawSecretsOf(e.id).length }));
    const insights = select.insightsFor(p.id);
    const last = select.activityFor({ projectId: p.id })[0];
    const firstEnv = select.envsOf(p.id)[0];
    return (
      <ProjectCard
        key={p.id}
        variant={view === "grid" ? "grid" : "row"}
        name={p.name}
        repo={p.repo}
        envs={envs}
        issues={insights.length}
        health={healthBadge(insights, view !== "grid", select)}
        activity={last ? activitySentence(last, select) : "No changes yet"}
        time={last ? relativeTime(last.at, Math.max(now, new Date(last.at).getTime())) : undefined}
        starred={!!p.starred}
        onStarredChange={() => actions.toggleStar(p.id)}
        onOpen={() => actions.navigate("project", { projectId: p.id })}
        menu={
          <Menu
            align="end"
            trigger={<IconButton icon="more-horizontal" size="xs" label={`More actions for ${p.name}`} />}
          >
            <MenuItem
              icon="folder-git-2"
              label="Open overview"
              onSelect={() => actions.navigate("project", { projectId: p.id })}
            />
            <MenuItem
              icon="key-round"
              label="Open secrets"
              disabled={!firstEnv}
              onSelect={() => actions.navigate("secrets", { projectId: p.id, envId: firstEnv.id, mode: "table" })}
            />
            <MenuItem
              icon="git-compare-arrows"
              label="Compare environments"
              onSelect={() => actions.navigate("compare", { projectId: p.id })}
            />
            <MenuItem
              icon="terminal"
              label="Copy link command"
              description={`secmgr link ${p.name}`}
              onSelect={() =>
                actions.copyString(`secmgr link ${p.name}`, "Copied CLI command", `secmgr link ${p.name}`)
              }
            />
            <MenuSeparator />
            <MenuItem
              icon="star"
              label={p.starred ? "Remove star" : "Star project"}
              onSelect={() => actions.toggleStar(p.id)}
            />
            <MenuItem
              icon="settings"
              label="Project settings"
              onSelect={() => actions.navigate("project", { projectId: p.id, tab: "settings" })}
            />
          </Menu>
        }
      />
    );
  };

  const group = (label, list) =>
    list.length ? (
      <section className="app-section" aria-label={label}>
        {!q ? (
          <h2 className="app-projects__label">
            {label}
            <span className="app-tertiary">{list.length}</span>
          </h2>
        ) : null}
        <div className={view === "grid" ? "app-projects__grid" : "app-projects__list"}>{list.map(card)}</div>
      </section>
    ) : null;

  return (
    <div className="app-page app-projects">
      <PageHeader
        title="Projects"
        description={`${n(all.length, "project")} in ${state.data.workspace.name}${issuesTotal ? ` · ${n(issuesTotal, "issue")} to look at in Health` : ""}`}
        actions={
          select.canManage ? (
            <Button variant="primary" icon="plus" onClick={() => actions.openDialog("create-project")}>
              New project
            </Button>
          ) : undefined
        }
      />
      <div className="app-page__body">
        <div className="app-projects__toolbar">
          <SearchField
            size="sm"
            className="app-projects__search"
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${n(all.length, "project")}`}
            count={shown.length}
            total={all.length}
            noun="project"
          />
          <SegmentedControl
            size="sm"
            aria-label="Layout"
            value={view}
            onValueChange={(v) => actions.setPrefs({ projectsView: v })}
            options={[
              { value: "grid", icon: "layout-grid", "aria-label": "Grid view" },
              { value: "list", icon: "list", "aria-label": "List view" },
            ]}
          />
        </div>
        {loading ? (
          <div className={view === "grid" ? "app-projects__grid" : "app-projects__list"}>
            {all.map((p) => (
              <ProjectCard key={p.id} name={p.name} variant={view === "grid" ? "grid" : "row"} loading />
            ))}
          </div>
        ) : !all.length && !archived.length ? (
          <EmptyState
            variant="page"
            icon="folder-git-2"
            title="Start with one project"
            description={
              select.canManage
                ? "A project is one repository. It holds an environment for each place your code runs, and the secrets inside them."
                : "Nobody has created a project here yet. Ask an owner or admin of this workspace to create one."
            }
            actions={
              select.canManage ? (
                <Button variant="primary" icon="plus" onClick={() => actions.openDialog("create-project")}>
                  Create project
                </Button>
              ) : undefined
            }
            hint={<CodeBlock language="shell" prompt copy code="npm i -g secmgr" />}
          />
        ) : !shown.length ? (
          <EmptyState
            variant="inline"
            icon="search-x"
            title={`No projects match "${query.trim()}"`}
            description="Search looks at project names, repositories, languages and descriptions."
            actions={
              <Button size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : q ? (
          group("Results", shown)
        ) : (
          <>
            {group("Starred", starred)}
            {group(starred.length ? "Other projects" : "All projects", rest)}
            {group("Archived", archived)}
          </>
        )}
      </div>
    </div>
  );
}
