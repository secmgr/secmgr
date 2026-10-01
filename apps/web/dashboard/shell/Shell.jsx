import {
  AppIcon,
  AppShell,
  Breadcrumbs,
  Button,
  Callout,
  DropZone,
  EnvDot,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  NavItem,
  Sidebar,
  SidebarHeader,
  SidebarSection,
  SidebarUser,
  WorkspaceButton,
} from "@secmgr/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_LABEL, useStore } from "../store";
import { CommandPalette } from "./CommandPalette.jsx";
import { contextEnvId, contextProjectId } from "./format.js";
import { HeaderSlotContext } from "./Header.jsx";

const PAGE_LABEL = {
  secrets: "Secrets",
  projects: "Projects",
  project: "Overview",
  compare: "Compare",
  environments: "Environments",
  activity: "Activity",
  health: "Health",
  tokens: "Tokens",
  members: "Members",
  settings: "Settings",
  notfound: "Not found",
};
const PROJECT_ROUTES = ["project", "secrets", "compare", "environments"];

export function isTyping(el) {
  if (!el?.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(el.type);
}

function overlayOpen() {
  return !!document.querySelector(
    '[aria-modal="true"], [role="alertdialog"], .sg-menu[data-state="open"], .sg-select__menu, .sg-drop-zone--overlay',
  );
}

function useGlobalKeys() {
  const { state, actions, select } = useStore();
  const ref = useRef({ state, select });
  ref.current = { state, select };
  useEffect(() => {
    let gAt = 0;
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (isTyping(t)) return;
      if (t?.closest?.('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      if (overlayOpen()) return;
      const { state: st, select: sel } = ref.current;
      const k = e.key;
      if (gAt && Date.now() - gAt < 1500) {
        gAt = 0;
        const map = { p: "projects", a: "activity", h: "health", s: "settings", t: "tokens", m: "members" };
        if (map[k]) {
          e.preventDefault();
          actions.navigate(map[k], k === "s" ? { section: "profile" } : {});
        }
        return;
      }
      if (k === "g") {
        gAt = Date.now();
        return;
      }
      if (k === "?") {
        e.preventDefault();
        actions.openDialog("shortcuts");
        return;
      }
      const ctx = contextEnvId(st, sel);
      if (k === "c" && ctx && sel.canWrite(ctx)) {
        e.preventDefault();
        actions.openDialog("add-secrets", { envId: ctx });
        return;
      }
      if (k === "i" && ctx && sel.canWrite(ctx)) {
        e.preventDefault();
        actions.openSheet("import", { envId: ctx });
        return;
      }
      if (k === "/") {
        if (
          document.querySelector(
            ".sg-app-shell__content .sg-search-field input, .sg-app-shell__content input[type='search']",
          )
        )
          return;
        e.preventDefault();
        actions.openCommand();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [actions]);
}

function SidebarNav() {
  const { state, actions, select } = useStore();
  const route = state.route;
  const p = route.params || {};
  const currentProject = PROJECT_ROUTES.includes(route.name) ? p.projectId : null;
  const [openMap, setOpenMap] = useState(() => {
    const first = currentProject || (state.data.projects.find((x) => x.starred) || state.data.projects[0])?.id;
    return first ? { [first]: true } : {};
  });
  useEffect(() => {
    if (currentProject) setOpenMap((m) => (m[currentProject] ? m : { ...m, [currentProject]: true }));
  }, [currentProject]);

  const projects = state.data.projects
    .filter((x) => !x.archived)
    .sort((a, b) => (a.starred === b.starred ? 0 : a.starred ? -1 : 1));
  const manage = select.canManage;
  const insights = select.allInsights().length;
  const ctxEnv = contextEnvId(state, select);
  const writable = ctxEnv ? select.canWrite(ctxEnv) : false;
  const mode = route.name === "secrets" && p.mode ? p.mode : "table";

  const lock = <Icon name="lock" size={12} label="Protected" />;
  const nav = (name, params) => () => actions.navigate(name, params || {});

  const header = (
    <SidebarHeader
      actions={[
        <IconButton
          key="search"
          icon="search"
          label="Search"
          kbd={["mod", "k"]}
          size="sm"
          onClick={() => actions.openCommand()}
        />,
        manage || writable ? (
          <Menu key="new" align="end" trigger={<IconButton icon="square-pen" label="Create" size="sm" />}>
            {manage && (
              <MenuItem icon="folder-git-2" label="New project" onSelect={() => actions.openDialog("create-project")} />
            )}
            {manage && contextProjectId(state, select) && (
              <MenuItem
                icon="layers"
                label="New environment"
                onSelect={() =>
                  actions.openDialog("create-environment", { projectId: contextProjectId(state, select) })
                }
              />
            )}
            {manage && writable && <MenuSeparator />}
            {writable && (
              <MenuItem
                icon="plus"
                label="Add secret"
                kbd="c"
                onSelect={() => actions.openDialog("add-secrets", { envId: ctxEnv })}
              />
            )}
            {writable && (
              <MenuItem
                icon="upload"
                label="Import .env"
                kbd="i"
                onSelect={() => actions.openSheet("import", { envId: ctxEnv })}
              />
            )}
          </Menu>
        ) : null,
      ].filter(Boolean)}
    >
      <Menu trigger={<WorkspaceButton name={state.data.workspace.name} />}>
        <MenuLabel>{state.data.workspace.name}</MenuLabel>
        <MenuItem
          icon="settings"
          label="Settings"
          kbd={["g", "s"]}
          onSelect={() => actions.navigate("settings", { section: "workspace" })}
        />
        {manage && <MenuItem icon="user-plus" label="Invite members" onSelect={() => actions.openDialog("invite")} />}
        <MenuSub icon="arrow-left-right" label="Switch workspace">
          <MenuRadioGroup
            label="Workspaces"
            value={state.data.workspace.slug}
            onValueChange={(v) => v !== state.data.workspace.slug && actions.switchWorkspace(v)}
          >
            {state.data.workspaces.map((w) => (
              <MenuRadioItem
                key={w.id}
                value={w.slug}
                icon={<AppIcon size={16} />}
                label={w.name}
                description={`${w.members} ${w.members === 1 ? "member" : "members"}, you are ${ROLE_LABEL[w.role] || w.role}`}
              />
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem icon="plus" label="Create workspace" onSelect={() => actions.navigate("onboarding")} />
        </MenuSub>
        <MenuSeparator />
        <MenuItem icon="log-out" label="Sign out" onSelect={() => actions.signOut()} />
      </Menu>
    </SidebarHeader>
  );

  const theme = state.prefs.theme;
  const footer = (
    <>
      <Menu side="top" align="start" trigger={<SidebarUser name={select.me.name} detail={select.me.email} />}>
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup label="Theme" value={theme} onValueChange={(v) => actions.setPrefs({ theme: v })}>
          <MenuRadioItem value="light" icon="sun" label="Light" />
          <MenuRadioItem value="dark" icon="moon" label="Dark" />
          <MenuRadioItem value="system" icon="monitor" label="System" />
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem icon="user" label="Profile" onSelect={() => actions.navigate("settings", { section: "profile" })} />
        <MenuItem icon="command" label="Keyboard shortcuts" kbd="?" onSelect={() => actions.openDialog("shortcuts")} />
        <MenuSeparator />
        <MenuItem icon="log-out" label="Sign out" onSelect={() => actions.signOut()} />
      </Menu>
      <IconButton
        icon="circle-help"
        label="Help and shortcuts"
        kbd="?"
        size="sm"
        onClick={() => actions.openDialog("shortcuts")}
      />
    </>
  );

  return (
    <Sidebar header={header} footer={footer}>
      <NavItem
        icon="folder"
        label="Projects"
        kbd={["g", "p"]}
        active={route.name === "projects"}
        onClick={nav("projects")}
      />
      <NavItem
        icon="activity"
        label="Activity"
        kbd={["g", "a"]}
        active={route.name === "activity"}
        onClick={nav("activity")}
      />
      <NavItem
        icon="shield-check"
        label="Health"
        kbd={["g", "h"]}
        count={insights || undefined}
        countTone="warning"
        active={route.name === "health"}
        onClick={nav("health")}
      />
      <NavItem icon="bot" label="Tokens" kbd={["g", "t"]} active={route.name === "tokens"} onClick={nav("tokens")} />
      <NavItem
        icon="users"
        label="Members"
        kbd={["g", "m"]}
        active={route.name === "members"}
        onClick={nav("members")}
      />
      <NavItem
        icon="settings"
        label="Settings"
        kbd={["g", "s"]}
        active={route.name === "settings"}
        onClick={nav("settings", { section: "profile" })}
      />
      <SidebarSection
        label="Projects"
        action={
          manage ? (
            <IconButton
              icon="plus"
              label="Create project"
              size="xs"
              onClick={() => actions.openDialog("create-project")}
            />
          ) : undefined
        }
      >
        {projects.map((proj) => {
          const envs = select.envsOf(proj.id);
          const here = currentProject === proj.id;
          return (
            <NavItem
              key={proj.id}
              icon="folder-git-2"
              label={proj.name}
              open={!!openMap[proj.id]}
              onOpenChange={(v) => setOpenMap((m) => ({ ...m, [proj.id]: v }))}
              active={here && route.name !== "secrets"}
              onClick={() => {
                if (!(here && route.name === "project")) {
                  actions.navigate("project", { projectId: proj.id });
                  setOpenMap((m) => ({ ...m, [proj.id]: true }));
                }
              }}
            >
              {envs.map((env) => (
                <NavItem
                  key={env.id}
                  dot={env.color}
                  label={env.name}
                  count={select.rawSecretsOf(env.id).length}
                  trailing={env.protected ? lock : undefined}
                  active={route.name === "secrets" && p.envId === env.id}
                  onClick={() => actions.navigate("secrets", { projectId: proj.id, envId: env.id, mode })}
                />
              ))}
            </NavItem>
          );
        })}
      </SidebarSection>
    </Sidebar>
  );
}

function HeaderBar({ slotRef }) {
  const { state, actions, select } = useStore();
  const route = state.route;
  const p = route.params || {};
  const project = p.projectId ? select.projectById(p.projectId) : null;
  const env = p.envId ? select.envById(p.envId) : null;

  const switchProject = (id) => {
    if (route.name === "secrets") {
      const cur = env ? env.name : "staging";
      const envs = select.envsOf(id);
      const next = envs.find((e) => e.name === cur) || envs[0];
      actions.navigate("secrets", { projectId: id, envId: next ? next.id : null, mode: p.mode || "table" });
    } else if (PROJECT_ROUTES.includes(route.name) || p.projectId) {
      actions.navigate(route.name, { ...p, projectId: id });
    } else actions.navigate("project", { projectId: id });
  };

  const projectMenu = project ? (
    <Menu align="start" trigger={<IconButton icon="chevrons-up-down" size="xs" label="Switch project" />}>
      <MenuLabel>Projects</MenuLabel>
      <MenuRadioGroup label="Projects" value={project.id} onValueChange={switchProject}>
        {state.data.projects
          .filter((x) => !x.archived || x.id === project.id)
          .map((x) => (
            <MenuRadioItem key={x.id} value={x.id} icon="folder-git-2" label={x.name} description={x.repo} />
          ))}
      </MenuRadioGroup>
      {select.canManage && <MenuSeparator />}
      {select.canManage && (
        <MenuItem icon="plus" label="Create project" onSelect={() => actions.openDialog("create-project")} />
      )}
    </Menu>
  ) : null;

  const envMenu = env ? (
    <Menu align="start" trigger={<IconButton icon="chevrons-up-down" size="xs" label="Switch environment" />}>
      <MenuLabel>{project ? project.name : "Environments"}</MenuLabel>
      <MenuRadioGroup
        label="Environments"
        value={env.id}
        onValueChange={(id) => {
          const e = select.envById(id);
          if (e) actions.navigate("secrets", { projectId: e.projectId, envId: e.id, mode: p.mode || "table" });
        }}
      >
        {select.envsOf(env.projectId).map((e) => (
          <MenuRadioItem
            key={e.id}
            value={e.id}
            icon={<EnvDot color={e.color} size={8} />}
            label={e.name}
            description={`${select.rawSecretsOf(e.id).length} secrets${e.protected ? ", protected" : ""}`}
          />
        ))}
      </MenuRadioGroup>
      {select.canManage && <MenuSeparator />}
      {select.canManage && (
        <MenuItem
          icon="plus"
          label="Create environment"
          onSelect={() => actions.openDialog("create-environment", { projectId: env.projectId })}
        />
      )}
    </Menu>
  ) : null;

  const items = [
    {
      key: "ws",
      label: state.data.workspace.name,
      icon: <AppIcon size={16} />,
      onClick: () => actions.navigate("projects"),
    },
  ];
  if (project)
    items.push({
      key: "project",
      label: project.name,
      mono: true,
      onClick: () => actions.navigate("project", { projectId: project.id }),
      switcher: projectMenu,
    });
  if (route.name === "secrets" && env)
    items.push({ key: "env", label: env.name, mono: true, dot: env.color, switcher: envMenu });
  else if (route.name !== "project" || !project) items.push({ key: "page", label: PAGE_LABEL[route.name] || "Page" });
  else items.push({ key: "page", label: p.tab === "settings" ? "Settings" : "Overview" });

  return (
    <div className="app-header">
      <Breadcrumbs items={items} className="app-header__crumbs" />
      <div className="app-header__actions" ref={slotRef} />
    </div>
  );
}

function OfflineBanner() {
  const { state, actions } = useStore();
  const offline = state.ui.offline;
  useEffect(() => {
    if (!offline) return;
    const timer = setInterval(() => actions.refresh(), 5000);
    return () => clearInterval(timer);
  }, [offline, actions]);
  if (!offline) return null;
  const retry = async () => {
    if (await actions.refresh())
      actions.toast({ tone: "success", title: "Back online", description: "Your staged changes are still here." });
  };
  return (
    <div className="app-offline">
      <Callout
        tone="warning"
        icon="wifi-off"
        title="You are offline"
        action={
          <Button size="sm" icon="refresh-cw" onClick={retry}>
            Retry now
          </Button>
        }
      >
        Could not reach the server. Your changes are kept; retrying in 5s.
      </Callout>
    </div>
  );
}

function GlobalDrop() {
  const { state, actions, select } = useStore();
  const envId = contextEnvId(state, select);
  const env = envId ? select.envById(envId) : null;
  const busy =
    !env ||
    !select.canWrite(env.id) ||
    !!state.ui.dialog ||
    (state.ui.sheet && state.ui.sheet.kind === "import") ||
    state.ui.commandOpen;
  const onText = useCallback((text) => actions.openSheet("import", { envId, text, source: "paste" }), [envId]);
  const onFile = useCallback(
    (file, text) => actions.openSheet("import", { envId, text, fileName: file.name, source: "file" }),
    [envId],
  );
  const onReject = useCallback((file, reason) => {
    actions.toast({
      tone: "danger",
      title: "Could not import that file",
      description:
        reason === "multiple"
          ? "Drop one file at a time."
          : reason === "size"
            ? `${file ? file.name : "The file"} is larger than 1 MB.`
            : `${file ? file.name : "That file"} is not a text file. Drop a .env, .txt or .json file.`,
    });
  }, []);
  return (
    <DropZone
      variant="overlay"
      env={env ? { name: env.name, color: env.color, protected: env.protected } : undefined}
      pasteAnywhere
      disabled={!!busy}
      onText={onText}
      onFile={onFile}
      onReject={onReject}
    />
  );
}

export function Shell({ children }) {
  const { state, actions } = useStore();
  const [slot, setSlot] = useState(null);
  const [drawer, setDrawer] = useState(false);
  useGlobalKeys();

  const envId = state.route.params?.envId;
  useEffect(() => {
    if (envId && envId !== state.ui.lastEnvId) actions.ui({ lastEnvId: envId });
  }, [envId]);
  useEffect(() => {
    setDrawer(false);
  }, [state.route]);
  const rp = state.route.params || {};
  const place = `${state.route.name}|${rp.projectId || ""}|${rp.envId || ""}|${rp.tab || ""}|${rp.section || ""}`;
  useEffect(() => {
    const el = document.querySelector(".sg-app-shell__content");
    if (el) el.scrollTop = 0;
  }, [place]);

  return (
    <HeaderSlotContext.Provider value={slot}>
      <AppShell
        className="app-shell"
        sidebar={<SidebarNav />}
        header={<HeaderBar slotRef={setSlot} />}
        sidebarCollapsed={!!state.ui.sidebarCollapsed}
        onSidebarCollapsedChange={(v) => actions.ui({ sidebarCollapsed: v })}
        drawerOpen={drawer}
        onDrawerOpenChange={setDrawer}
        sidebarLabel="Workspace navigation"
      >
        <OfflineBanner />
        {children}
      </AppShell>
      <CommandPalette />
      <GlobalDrop />
    </HeaderSlotContext.Provider>
  );
}
