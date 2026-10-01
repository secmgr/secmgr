import {
  ActivityItem,
  Badge,
  Button,
  Card,
  CodeBlock,
  ConfirmDialog,
  EmptyState,
  EnvBadge,
  Icon,
  IconButton,
  Input,
  InsightRow,
  n,
  PageHeader,
  relativeTime,
  SettingRow,
  SettingsGroup,
  StatTile,
  Tabs,
} from "@secmgr/ui";
import { useMemo, useState } from "react";
import { activityItem, DAY, firstNameOf } from "../shell/format.js";
import { HeaderActions } from "../shell/Header.jsx";
import { useRecentActivity, useStore } from "../store";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "secrets", label: "Secrets" },
  { value: "compare", label: "Compare" },
  { value: "environments", label: "Environments" },
  { value: "activity", label: "Activity" },
  { value: "settings", label: "Settings" },
];

const CHANGE = ["update", "create", "delete", "import", "rotate"];

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function useProjectStats(project) {
  const { state, select } = useStore();
  return useMemo(() => {
    const envs = select.envsOf(project.id);
    const now = select.now;
    const secrets = envs.reduce((sum, e) => sum + select.rawSecretsOf(e.id).length, 0);
    const keys = select.keysOf(project.id).length;
    const changes = select.activityFor({ projectId: project.id }).filter((a) => CHANGE.includes(a.action));
    const weight = (a) => (a.keys ? a.keys.length : a.count || 1);
    const at = (a) => new Date(a.at).getTime();
    const thisWeek = changes.filter((a) => at(a) > now - 7 * DAY).reduce((s, a) => s + weight(a), 0);
    const lastWeek = changes
      .filter((a) => at(a) <= now - 7 * DAY && at(a) > now - 14 * DAY)
      .reduce((s, a) => s + weight(a), 0);
    const series = [];
    const labels = [];
    for (let i = 11; i >= 0; i--) {
      const day = now - i * DAY;
      const k = dayKey(day);
      series.push(changes.filter((a) => dayKey(at(a)) === k).reduce((s, a) => s + weight(a), 0));
      labels.push(new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
    const insights = select.insightsFor(project.id);
    return { envs, secrets, keys, thisWeek, lastWeek, series, labels, insights };
  }, [state.data, state.activity, project.id]);
}

function fixFor(insight, project, actions, select) {
  const env = select.envById(insight.envs[0]);
  const key = insight.keys[0];
  const open = (envId) => {
    const e = select.envById(envId);
    if (!e) return;
    actions.navigate("secrets", { projectId: project.id, envId: e.id, mode: "table" });
    const secret = select.rawSecretsOf(e.id).find((s) => s.key === key);
    if (secret)
      actions.openSheet("secret", {
        secretId: secret.id,
        section: insight.kind === "live-key" ? "rotation" : undefined,
      });
  };
  if (insight.kind === "missing") {
    const from = select
      .envsOf(project.id)
      .find((e) => e.name !== "production" && select.rawSecretsOf(e.id).some((s) => s.key === key));
    return () => open(from ? from.id : insight.envs[0]);
  }
  if (insight.kind === "rotation")
    return () => {
      const s = select.rawSecretsOf(env.id).find((x) => x.key === key);
      if (s) actions.rotateNow(s);
      actions.navigate("secrets", { projectId: project.id, envId: env.id, mode: "table" });
    };
  if (insight.kind === "shared")
    return () =>
      actions.navigate("compare", {
        projectId: project.id,
        envs: insight.envs.map((id) => select.envById(id)?.name).filter(Boolean),
        mode: "diff",
      });
  return () => open(insight.envs[0]);
}

function Overview({ project }) {
  const { actions, select } = useStore();
  useRecentActivity();
  const stats = useProjectStats(project);
  const now = select.now;
  const goEnv = (e) => actions.navigate("secrets", { projectId: project.id, envId: e.id, mode: "table" });
  const recent = select.activityFor({ projectId: project.id }).slice(0, 5);
  const danger = stats.insights.filter((i) => i.severity === "danger").length;
  const delta = stats.thisWeek - stats.lastWeek;
  const staging = stats.envs.find((e) => e.name === "staging") || stats.envs[0];
  const count = staging ? select.rawSecretsOf(staging.id).length : 0;

  return (
    <div className="app-page__body app-overview">
      <div className="app-overview__stats">
        <StatTile
          label="Secrets"
          icon="key-round"
          value={stats.secrets}
          delta={`${n(stats.keys, "key")} across ${n(stats.envs.length, "environment")}`}
        />
        <StatTile
          label="Environments"
          icon="layers"
          value={stats.envs.length}
          delta={`${stats.envs.filter((e) => e.protected).length} protected`}
          onClick={() => actions.navigate("environments", { projectId: project.id })}
        />
        <StatTile
          label="Changes this week"
          icon="pencil"
          value={stats.thisWeek}
          delta={delta === 0 ? "Same as last week" : `${delta > 0 ? "+" : ""}${delta} on last week`}
          series={stats.series}
          seriesLabels={stats.labels}
          unit="changes"
          onClick={() => actions.navigate("activity", { projectId: project.id })}
        />
        <StatTile
          label="Issues"
          icon="shield-check"
          value={stats.insights.length}
          delta={stats.insights.length ? (danger ? `${danger} critical` : "Needs a look") : "Healthy"}
          deltaTone={danger ? "danger" : stats.insights.length ? "warning" : "success"}
          onClick={() => actions.navigate("health", { projectId: project.id })}
        />
      </div>

      <section className="app-section">
        <div className="app-section__head">
          <h2 className="app-section__title">Environments</h2>
          {select.canManage ? (
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              onClick={() => actions.openDialog("create-environment", { projectId: project.id })}
            >
              New environment
            </Button>
          ) : null}
        </div>
        <div className="app-overview__envs">
          {stats.envs.map((e) => {
            const rows = select.rawSecretsOf(e.id);
            const latest = rows.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
            const issues = stats.insights.filter((i) => i.envs.includes(e.id));
            const staged = select.stagedCount(e.id);
            return (
              <Card
                key={e.id}
                className="app-env-card"
                data-color={e.color}
                padding="md"
                footer={
                  <div className="app-env-card__foot">
                    {issues.length ? (
                      <span
                        className="app-env-card__health"
                        data-tone={issues.some((i) => i.severity === "danger") ? "danger" : "warning"}
                      >
                        <Icon
                          name={issues.some((i) => i.severity === "danger") ? "circle-alert" : "triangle-alert"}
                          size={14}
                        />
                        {n(issues.length, "issue")}
                      </span>
                    ) : (
                      <span className="app-env-card__health" data-tone="success">
                        <Icon name="circle-check" size={14} />
                        Healthy
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      iconRight="arrow-right"
                      onClick={() => goEnv(e)}
                      aria-label={`Open ${e.name}`}
                    >
                      Open
                    </Button>
                  </div>
                }
              >
                <div className="app-env-card__body">
                  <div className="app-env-card__top">
                    <EnvBadge env={{ name: e.name, color: e.color, protected: e.protected }} />
                    {staged ? (
                      <Badge tone="warning" variant="outline">
                        {n(staged, "unsaved change")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="app-env-card__count">
                    <span className="app-tabular">{rows.length}</span>{" "}
                    <span className="app-env-card__unit">{rows.length === 1 ? "secret" : "secrets"}</span>
                  </div>
                  <div className="app-env-card__meta">
                    {latest ? (
                      <>
                        Updated {relativeTime(latest.updatedAt, now)} by {firstNameOf(select, latest.updatedBy)}
                      </>
                    ) : (
                      "No secrets yet"
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="app-overview__split">
        <section className="app-section">
          <div className="app-section__head">
            <h2 className="app-section__title">Recent activity</h2>
            <Button
              size="sm"
              variant="ghost"
              iconRight="arrow-right"
              onClick={() => actions.navigate("activity", { projectId: project.id })}
            >
              View all
            </Button>
          </div>
          <Card padding="md" className="app-overview__activity">
            {recent.length ? (
              recent.map((a, i) => {
                const { id, ...props } = activityItem(a, select);
                return <ActivityItem key={id} {...props} now={now} avatar connector={i < recent.length - 1} />;
              })
            ) : (
              <EmptyState
                variant="inline"
                icon="activity"
                title="No activity yet"
                description="Changes, reveals and reads show up here."
              />
            )}
          </Card>
        </section>

        <div className="app-overview__side">
          <section className="app-section">
            <div className="app-section__head">
              <h2 className="app-section__title">Health</h2>
              <Button
                size="sm"
                variant="ghost"
                iconRight="arrow-right"
                onClick={() => actions.navigate("health", { projectId: project.id })}
              >
                View all
              </Button>
            </div>
            {stats.insights.length ? (
              <div className="app-overview__insights">
                {stats.insights.slice(0, 4).map((i) => (
                  <InsightRow
                    key={i.id}
                    variant="compact"
                    severity={i.severity}
                    title={i.title}
                    envs={i.envs
                      .map((id) => select.envById(id))
                      .filter(Boolean)
                      .map((e) => ({ name: e.name, color: e.color, protected: e.protected }))}
                    action={{ label: i.fix, onClick: fixFor(i, project, actions, select) }}
                  />
                ))}
                {stats.insights.length > 4 ? (
                  <p className="app-overview__more">{n(stats.insights.length - 4, "more issue")} in Health</p>
                ) : null}
              </div>
            ) : (
              <Card padding="md">
                <EmptyState
                  variant="inline"
                  icon="circle-check"
                  title="Nothing needs attention"
                  description={`Every environment in ${project.name} passes the health checks.`}
                />
              </Card>
            )}
          </section>

          <section className="app-section">
            <div className="app-section__head">
              <h2 className="app-section__title">From your terminal</h2>
            </div>
            <Card padding="md" className="app-overview__cli">
              <p className="app-overview__cli-lead">
                Install the CLI, link this repository, then run with secrets injected. Nothing touches disk.
              </p>
              <CodeBlock
                language="shell"
                prompt
                copy
                code="npm i -g secmgr"
                onCopy={() => actions.toast({ title: "Copied install command" })}
              />
              <CodeBlock
                language="shell"
                copy
                code={`$ secmgr link ${project.name}\n$ secmgr run --env ${staging ? staging.name : "development"} -- npm run dev\nInjected ${count} secrets from ${project.name}/${staging ? staging.name : "development"}`}
                onCopy={() => actions.toast({ title: "Copied CLI commands" })}
              />
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProjectSettings({ project }) {
  const { actions, select } = useStore();
  const manage = select.canManage;
  const [name, setName] = useState(project.name);
  const [repo, setRepo] = useState(project.repo || "");
  const [description, setDescription] = useState(project.description || "");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const envs = select.envsOf(project.id);
  const total = envs.reduce((s, e) => s + select.rawSecretsOf(e.id).length, 0);
  const dirty =
    name.trim() !== project.name ||
    repo.trim() !== (project.repo || "") ||
    description.trim() !== (project.description || "");

  const save = async () => {
    setSaving(true);
    const ok = await actions.updateProject(project.id, {
      ...(name.trim() !== project.name ? { name: name.trim() } : {}),
      repo: repo.trim() || null,
      description: description.trim(),
    });
    setSaving(false);
    if (ok) actions.toast({ tone: "success", title: `Saved ${name.trim()}` });
  };
  const archive = async () => {
    const ok = await actions.updateProject(project.id, { archived: !project.archived });
    if (ok)
      actions.toast({
        title: project.archived ? `Restored ${project.name}` : `Archived ${project.name}`,
        description: project.archived ? undefined : "It is hidden from the sidebar. Its secrets still work.",
      });
  };
  const remove = async () => {
    const ok = await actions.deleteProject(project.id, project.name);
    if (!ok) return;
    actions.navigate("projects");
    actions.toast({
      title: `Deleted ${project.name}`,
      description: `${n(envs.length, "environment")} and ${n(total, "secret")} are gone.`,
    });
  };

  return (
    <div className="app-page__body app-project-settings">
      <SettingsGroup title="General" description="How this project shows up in secmgr and the CLI.">
        <SettingRow
          label="Name"
          description={
            <>
              Used by the CLI: <code>secmgr link {project.name}</code>. Renaming breaks linked checkouts.
            </>
          }
          htmlFor="app-project-name"
        >
          <Input
            id="app-project-name"
            mono
            value={name}
            onValueChange={(v) => setName(v.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
            readOnly={!manage}
            aria-label="Name"
          />
        </SettingRow>
        <SettingRow
          label="Repository"
          description="The git repository this project belongs to, as owner/name."
          htmlFor="app-project-repo"
        >
          <Input
            id="app-project-repo"
            mono
            value={repo}
            onValueChange={setRepo}
            placeholder="acme/web"
            icon="folder-git-2"
            readOnly={!manage}
          />
        </SettingRow>
        <SettingRow label="Description" description="One line for the projects list." htmlFor="app-project-desc">
          <Input
            id="app-project-desc"
            value={description}
            onValueChange={setDescription}
            placeholder="Public REST API and webhooks."
            readOnly={!manage}
          />
        </SettingRow>
      </SettingsGroup>
      {manage ? (
        <>
          <div className="app-project-settings__actions">
            <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>
              Save changes
            </Button>
          </div>
          <SettingsGroup title="Danger zone" danger>
            <SettingRow
              label={project.archived ? "Restore project" : "Archive project"}
              description={
                project.archived
                  ? "Shows the project in the sidebar and the projects list again."
                  : "Hides the project from the sidebar. Secrets, tokens and the CLI keep working."
              }
            >
              <Button icon="archive" onClick={archive}>
                {project.archived ? "Restore project" : "Archive project"}
              </Button>
            </SettingRow>
            <SettingRow
              label="Delete project"
              danger
              description={`Deletes ${n(envs.length, "environment")} and ${n(total, "secret")}. Services reading them fail on their next deploy.`}
            >
              <Button variant="danger" icon="trash-2" onClick={() => setConfirm(true)}>
                Delete project
              </Button>
            </SettingRow>
          </SettingsGroup>
        </>
      ) : (
        <p className="app-tertiary">Only owners and admins can change project settings.</p>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title={`Delete ${project.name}?`}
        description={`This deletes ${n(envs.length, "environment")} and ${n(total, "secret")}. Services reading them fail on their next deploy.`}
        requireText={project.name}
        confirmLabel={`Delete ${project.name}`}
        onConfirm={remove}
      />
    </div>
  );
}

export default function ProjectOverview() {
  const { state, actions, select } = useStore();
  const p = state.route.params || {};
  const project = select.projectById(p.projectId);
  if (!project) {
    return (
      <div className="app-page">
        <div className="app-page__body">
          <EmptyState
            variant="page"
            icon="folder-git-2"
            title="This project does not exist"
            description={
              p.projectName
                ? `There is no project called ${p.projectName} in ${state.data.workspace.name}. It may have been deleted.`
                : "Pick a project from the list."
            }
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
  const tab = p.tab === "settings" ? "settings" : "overview";
  const envs = select.envsOf(project.id);
  const lastEnv = state.ui.lastEnvId && select.envById(state.ui.lastEnvId);
  const target =
    lastEnv && lastEnv.projectId === project.id ? lastEnv : envs.find((e) => e.name === "development") || envs[0];

  const go = (v) => {
    if (v === "overview") actions.navigate("project", { projectId: project.id });
    else if (v === "settings") actions.navigate("project", { projectId: project.id, tab: "settings" });
    else if (v === "secrets") {
      if (target) actions.navigate("secrets", { projectId: project.id, envId: target.id, mode: "table" });
    } else actions.navigate(v, { projectId: project.id });
  };

  return (
    <div className="app-page">
      <HeaderActions>
        <IconButton
          size="sm"
          icon="star"
          pressed={!!project.starred}
          label={project.starred ? `Unstar ${project.name}` : `Star ${project.name}`}
          onClick={() => actions.toggleStar(project.id)}
        />
        <IconButton
          size="sm"
          icon="terminal"
          label="Copy link command"
          onClick={() =>
            actions.copyString(`secmgr link ${project.name}`, "Copied CLI command", `secmgr link ${project.name}`)
          }
        />
      </HeaderActions>
      <PageHeader
        title={project.name}
        icon="folder-git-2"
        description={
          <>
            {project.repo ? <span className="app-mono">{project.repo}</span> : null}
            {project.repo && project.description ? " · " : ""}
            {project.description}
            {project.archived ? `${project.repo || project.description ? " · " : ""}Archived` : ""}
          </>
        }
        actions={
          <>
            <Button icon="git-compare-arrows" onClick={() => actions.navigate("compare", { projectId: project.id })}>
              Compare
            </Button>
            <Button variant="primary" icon="key-round" disabled={!target} onClick={() => go("secrets")}>
              Open secrets
            </Button>
          </>
        }
        tabs={
          <Tabs variant="underline" label={`${project.name} sections`} value={tab} onValueChange={go} items={TABS} />
        }
      />
      {tab === "settings" ? <ProjectSettings project={project} /> : <Overview project={project} />}
    </div>
  );
}
