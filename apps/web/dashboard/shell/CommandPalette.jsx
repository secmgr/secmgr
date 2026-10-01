import { CommandMenu, EnvDot } from "@secmgr/ui";
import { useMemo } from "react";
import { useStore } from "../store";
import { contextEnvId, contextProjectId } from "./format.js";

export function CommandPalette() {
  const { state, actions, select } = useStore();
  const envId = contextEnvId(state, select);
  const env = envId ? select.envById(envId) : null;
  const projectId = contextProjectId(state, select);
  const project = select.projectById(projectId);
  const projectName = project ? project.name : "projects";
  const nameOf = (pid) => select.projectById(pid)?.name || "";
  const route = state.route;
  const mode = route.name === "secrets" && route.params.mode ? route.params.mode : "table";

  const groups = useMemo(() => {
    if (!state.ui.commandOpen) return [];
    const envs = select.envsOf(projectId);
    const goEnv = (e) => actions.navigate("secrets", { projectId: e.projectId, envId: e.id, mode });
    const envItems = envs.map((e) => ({
      id: `env:${e.id}`,
      icon: <EnvDot color={e.color} size={8} />,
      label: e.name,
      mono: true,
      hint: `${nameOf(e.projectId)}/${e.name} · ${select.rawSecretsOf(e.id).length} secrets`,
      keywords: ["environment", "switch"],
      onSelect: () => goEnv(e),
    }));
    const staged = env ? select.stagedCount(env.id) : 0;
    const cli = `secmgr run --env ${env ? env.name : "staging"} -- npm run dev`;
    const secretItems = env
      ? select
          .secretsOf(env.id)
          .filter((s) => s.status !== "deleted")
          .map((s) => ({
            id: `s:${s.id}`,
            icon: "key-round",
            label: s.key,
            mono: true,
            hint: `${nameOf(env.projectId)}/${env.name}`,
            onSelect: () => {
              if (!(route.name === "secrets" && route.params.envId === env.id))
                actions.navigate("secrets", { projectId: env.projectId, envId: env.id, mode: "table" });
              actions.openSheet("secret", { secretId: s.id });
            },
          }))
      : [];
    const jump = [
      ...state.data.projects.map((x) => ({
        id: `p:${x.id}`,
        icon: "folder-git-2",
        label: x.name,
        mono: true,
        hint: x.repo,
        keywords: ["project"],
        onSelect: () => actions.navigate("project", { projectId: x.id }),
      })),
      ...envItems,
      {
        id: "go:projects",
        icon: "folder",
        label: "Projects",
        kbd: ["g", "p"],
        onSelect: () => actions.navigate("projects"),
      },
      {
        id: "go:activity",
        icon: "activity",
        label: "Activity",
        kbd: ["g", "a"],
        onSelect: () => actions.navigate("activity"),
      },
      {
        id: "go:health",
        icon: "shield-check",
        label: "Health",
        kbd: ["g", "h"],
        onSelect: () => actions.navigate("health"),
      },
      { id: "go:tokens", icon: "bot", label: "Tokens", kbd: ["g", "t"], onSelect: () => actions.navigate("tokens") },
      {
        id: "go:members",
        icon: "users",
        label: "Members",
        kbd: ["g", "m"],
        onSelect: () => actions.navigate("members"),
      },
      {
        id: "go:settings",
        icon: "settings",
        label: "Settings",
        kbd: ["g", "s"],
        onSelect: () => actions.navigate("settings", { section: "profile" }),
      },
    ];
    const writable = env ? select.canWrite(env.id) : false;
    const act = [
      ...(writable
        ? [
            {
              id: "a:add",
              icon: "plus",
              label: "Add secret",
              hint: env ? `${nameOf(env.projectId)}/${env.name}` : undefined,
              kbd: "c",
              keywords: ["new", "create"],
              onSelect: () => actions.openDialog("add-secrets", { envId }),
            },
          ]
        : []),
      ...(writable
        ? [
            {
              id: "a:import",
              icon: "upload",
              label: "Import .env",
              hint: env ? `into ${env.name}` : undefined,
              kbd: "i",
              keywords: ["paste", "upload", "dotenv"],
              onSelect: () => actions.openSheet("import", { envId }),
            },
          ]
        : []),
      {
        id: "a:compare",
        icon: "git-compare-arrows",
        label: "Compare environments",
        hint: project ? project.name : undefined,
        keywords: ["diff", "drift"],
        onSelect: () => actions.navigate("compare", { projectId }),
      },
      ...(staged
        ? [
            {
              id: "a:review",
              icon: "list-checks",
              label: `Review ${staged} ${staged === 1 ? "change" : "changes"}`,
              hint: env ? `in ${env.name}` : undefined,
              keywords: ["save", "staged", "diff"],
              onSelect: () => actions.openDialog("review", { envId }),
            },
          ]
        : []),
      ...(env && select.canRead(env.id)
        ? [
            {
              id: "a:export",
              icon: "download",
              label: "Export",
              hint: env ? `${env.name} as .env, JSON, YAML, docker or Kubernetes` : undefined,
              keywords: ["download", "json", "yaml", "docker", "kubernetes"],
              onSelect: () => actions.openDialog("export", { envId }),
            },
          ]
        : []),
      {
        id: "a:cli",
        icon: "terminal",
        label: "Copy CLI command",
        hint: cli,
        keywords: ["run", "terminal"],
        onSelect: () => actions.copyString(cli, "Copied CLI command", cli),
      },
      {
        id: "a:switch-env",
        icon: "layers",
        label: "Switch environment",
        hint: project ? project.name : undefined,
        keywords: ["environment"],
        page: { title: "Switch environment", placeholder: `Environments in ${projectName}`, items: envItems },
      },
      {
        id: "a:switch-project",
        icon: "folder-git-2",
        label: "Switch project",
        keywords: ["project"],
        page: {
          title: "Switch project",
          placeholder: `Search ${state.data.projects.length} ${state.data.projects.length === 1 ? "project" : "projects"}`,
          items: state.data.projects.map((x) => ({
            id: `sp:${x.id}`,
            icon: "folder-git-2",
            label: x.name,
            mono: true,
            hint: x.repo,
            onSelect: () => actions.navigate("project", { projectId: x.id }),
          })),
        },
      },
      {
        id: "a:theme",
        icon: "sun-moon",
        label: "Toggle theme",
        keywords: ["dark", "light", "appearance"],
        onSelect: () => actions.toggleTheme(),
      },
      {
        id: "a:shortcuts",
        icon: "command",
        label: "Keyboard shortcuts",
        kbd: "?",
        onSelect: () => actions.openDialog("shortcuts"),
      },
    ];
    const account = [
      {
        id: "x:create-workspace",
        icon: "plus",
        label: "Create workspace",
        keywords: ["new", "organization"],
        onSelect: () => actions.navigate("onboarding"),
      },
      ...state.data.workspaces
        .filter((w) => w.slug !== state.data.workspace.slug)
        .map((w) => ({
          id: `ws:${w.id}`,
          icon: "arrow-left-right",
          label: `Switch to ${w.name}`,
          keywords: ["workspace"],
          onSelect: () => actions.switchWorkspace(w.slug),
        })),
      { id: "x:signout", icon: "log-out", label: "Sign out", onSelect: () => actions.signOut() },
    ];
    return [
      { label: "Actions", items: act },
      { label: "Jump to", items: jump },
      ...(env ? [{ label: `Secrets in ${env.name}`, items: secretItems }] : []),
      { label: "Account", items: account },
    ];
  }, [state.ui.commandOpen, state.data, state.staged, state.values, state.route, envId, projectId]);

  return (
    <CommandMenu
      open={!!state.ui.commandOpen}
      onOpenChange={(v) => actions.ui({ commandOpen: v })}
      groups={groups}
      placeholder={`Search ${projectName}, secrets and actions`}
    />
  );
}
