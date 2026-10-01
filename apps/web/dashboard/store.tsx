"use client";

import { copyText, generateSecretValue, toast as showToast } from "@secmgr/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { type ActivityPage, api, type Change, RequestError, type Snapshot } from "./api";
import { insightsFor as computeInsights, type Insight } from "./insights";
import { parseRoute, type Route, routePath } from "./routes";

export const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  viewer: "Viewer",
};
export const ROLE_VALUE: Record<string, string> = {
  Owner: "owner",
  Admin: "admin",
  Developer: "developer",
  Viewer: "viewer",
};

type Staged = Record<string, Record<string, Record<string, unknown> & { op: "add" | "edit" | "delete" }>>;
type ValuesEntry = { status: "loading" | "ready" | "error"; values: Record<string, string>; error?: string };

type Prefs = Snapshot["prefs"] & { groupByPrefix: boolean; projectsView: "grid" | "list" };

type Ui = {
  sheet: { kind: string; props: Record<string, unknown> } | null;
  dialog: { kind: string; props: Record<string, unknown> } | null;
  commandOpen: boolean;
  sidebarCollapsed: boolean;
  loading: boolean;
  offline: boolean;
  lastEnvId: string | null;
  secretsQuery: string;
  secretsFilter: string;
};

type Data = Omit<Snapshot, "members" | "prefs"> & {
  currentUserId: string;
  members: (Snapshot["members"][number] & { roleValue: string })[];
};

type ActivityCache = { status: "idle" | "loading" | "ready" | "error"; entries: ActivityPage["entries"] };

type State = {
  slug: string;
  activity: ActivityCache;
  prefs: Prefs;
  data: Data;
  values: Record<string, ValuesEntry>;
  staged: Staged;
  ui: Ui;
};

type Action =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "prefs"; prefs: Partial<Prefs> }
  | { type: "ui"; patch: Partial<Ui> }
  | { type: "values"; envId: string; entry: ValuesEntry | null }
  | { type: "activity"; activity: ActivityCache }
  | { type: "stage"; envId: string; key: string; change: Record<string, unknown> | null }
  | { type: "discard"; envId: string }
  | { type: "restoreStaged"; envId: string; changes: Staged[string] };

const LOCAL_PREFS = "secmgr.prefs";

function loadLocalPrefs(): Partial<Prefs> {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_PREFS) ?? "{}");
  } catch {
    return {};
  }
}

function toData(snapshot: Snapshot): Data {
  const { prefs: _prefs, ...rest } = snapshot;
  return {
    ...rest,
    currentUserId: snapshot.me.id,
    members: snapshot.members.map((m) => ({ ...m, roleValue: m.role, role: ROLE_LABEL[m.role] ?? m.role })),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "snapshot": {
      const data = toData(action.snapshot);
      const known = new Set(data.environments.map((e) => e.id));
      const staged = Object.fromEntries(Object.entries(state.staged).filter(([id]) => known.has(id)));
      return { ...state, data, staged };
    }
    case "prefs":
      return { ...state, prefs: { ...state.prefs, ...action.prefs } };
    case "activity":
      return { ...state, activity: action.activity };
    case "ui":
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case "values": {
      const values = { ...state.values };
      if (action.entry) values[action.envId] = action.entry;
      else delete values[action.envId];
      return { ...state, values };
    }
    case "stage": {
      const env = { ...(state.staged[action.envId] ?? {}) };
      if (action.change === null) delete env[action.key];
      else env[action.key] = { ...(env[action.key] ?? {}), ...action.change } as Staged[string][string];
      const staged = { ...state.staged, [action.envId]: env };
      if (!Object.keys(env).length) delete staged[action.envId];
      return { ...state, staged };
    }
    case "discard": {
      const staged = { ...state.staged };
      delete staged[action.envId];
      return { ...state, staged };
    }
    case "restoreStaged":
      return { ...state, staged: { ...state.staged, [action.envId]: action.changes } };
    default:
      return state;
  }
}

type Store = {
  state: State & { route: Route };
  actions: ReturnType<typeof makeActions>;
  select: ReturnType<typeof makeSelectors>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ snapshot, slug, children }: { snapshot: Snapshot; slug: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): State => ({
      slug,
      activity: { status: "idle", entries: [] },
      prefs: { groupByPrefix: true, projectsView: "grid", ...snapshot.prefs, ...loadLocalPrefs() } as Prefs,
      data: toData(snapshot),
      values: {},
      staged: {},
      ui: {
        sheet: null,
        dialog: null,
        commandOpen: false,
        sidebarCollapsed: false,
        loading: false,
        offline: false,
        lastEnvId: null,
        secretsQuery: "",
        secretsFilter: "all",
      },
    }),
  );
  const pathname = usePathname();
  const search = useSearchParams();
  const route = useMemo(
    () => parseRoute(pathname, new URLSearchParams(search.toString()), state.data),
    [pathname, search, state.data],
  );
  const full = useMemo(() => ({ ...state, route }), [state, route]);
  const ref = useRef(full);
  ref.current = full;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCAL_PREFS,
        JSON.stringify({
          groupByPrefix: state.prefs.groupByPrefix,
          projectsView: state.prefs.projectsView,
          theme: state.prefs.theme,
        }),
      );
    } catch {}
  }, [state.prefs.groupByPrefix, state.prefs.projectsView, state.prefs.theme]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = state.prefs.theme;
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    root.setAttribute("data-density", state.prefs.density);
  }, [state.prefs.theme, state.prefs.density]);

  useEffect(() => {
    const online = () => dispatch({ type: "ui", patch: { offline: false } });
    const offline = () => dispatch({ type: "ui", patch: { offline: true } });
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const getState = useCallback(() => ref.current, []);
  const actions = useMemo(() => makeActions(dispatch, getState), [getState]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") actions.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [actions]);

  const select = useMemo(() => makeSelectors(full), [full]);
  const value = useMemo(() => ({ state: full, actions, select }), [full, actions, select]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore outside StoreProvider");
  return value;
}

const n = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

type Toast = {
  tone?: "success" | "danger" | "warning" | "neutral";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

function makeActions(dispatch: (a: Action) => void, get: () => State & { route: Route }) {
  const toast = (opts: Toast) => showToast(opts);
  const fail = (error: unknown, title = "That did not work") => {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof RequestError && error.code === "offline") dispatch({ type: "ui", patch: { offline: true } });
    toast({ tone: "danger", title, description: message.endsWith(".") ? message : `${message}.` });
    return null;
  };
  const slug = () => get().slug;
  const envOf = (envId: string) => get().data.environments.find((e) => e.id === envId);
  const projectOf = (id: string) => get().data.projects.find((p) => p.id === id);

  const refresh = async () => {
    try {
      const snapshot = await api.snapshot(slug());
      dispatch({ type: "snapshot", snapshot });
      if (get().activity.status === "ready") loadActivity({ force: true });
      dispatch({ type: "ui", patch: { offline: false } });
      return snapshot;
    } catch (error) {
      if (error instanceof RequestError && error.code === "offline") dispatch({ type: "ui", patch: { offline: true } });
      return null;
    }
  };

  const loadActivity = async ({ force = false } = {}) => {
    const current = get().activity;
    if (!force && (current.status === "loading" || current.status === "ready")) return current.entries;
    dispatch({ type: "activity", activity: { status: "loading", entries: current.entries } });
    try {
      const page = await api.activity(slug(), { limit: "200" });
      dispatch({ type: "activity", activity: { status: "ready", entries: page.entries } });
      return page.entries;
    } catch {
      dispatch({ type: "activity", activity: { status: "error", entries: current.entries } });
      return current.entries;
    }
  };

  const loadValues = async (envId: string, { force = false } = {}) => {
    const current = get().values[envId];
    if (!force && current && current.status !== "error") return current.status === "ready" ? current.values : null;
    const env = envOf(envId);
    if (!env || (env.access !== "read" && env.access !== "write")) return null;
    dispatch({ type: "values", envId, entry: { status: "loading", values: current?.values ?? {} } });
    try {
      const { values } = await api.values(envId);
      dispatch({ type: "values", envId, entry: { status: "ready", values } });
      return values;
    } catch (error) {
      dispatch({
        type: "values",
        envId,
        entry: { status: "error", values: {}, error: error instanceof Error ? error.message : String(error) },
      });
      return null;
    }
  };

  const valueFor = async (secret: { envId: string; key: string; value?: string }) => {
    if (typeof secret.value === "string") return secret.value;
    const values = await loadValues(secret.envId);
    return values?.[secret.key] ?? "";
  };

  const clipboardNote = () => {
    const secs = get().prefs.clipboardClearSec;
    return secs ? `Clipboard clears in ${secs}s.` : undefined;
  };

  const clearClipboardLater = (text: string) => {
    const secs = get().prefs.clipboardClearSec;
    if (!secs) return;
    window.setTimeout(async () => {
      try {
        if ((await navigator.clipboard.readText()) === text) await navigator.clipboard.writeText("");
      } catch {}
    }, secs * 1000);
  };

  const event = (
    envId: string,
    action: "reveal" | "copy" | "export",
    keys: string[] = [],
    detail?: { format?: string; count?: number },
  ) => {
    api.event(envId, { action, keys, detail }).catch(() => {});
  };

  const changesFor = (envId: string): Change[] => {
    const st = get();
    const staged = st.staged[envId] ?? {};
    const saved = new Map(st.data.secrets.filter((s) => s.envId === envId).map((s) => [s.key, s]));
    return Object.entries(staged).map(([key, c]) => {
      const row = saved.get(key);
      const change: Change = { op: c.op, key };
      if (typeof c.newKey === "string" && c.newKey !== key) change.newKey = c.newKey;
      if (typeof c.value === "string") change.value = c.value;
      if (typeof c.note === "string") change.note = c.note;
      if (typeof c.sensitive === "boolean") change.sensitive = c.sensitive;
      if (c.rotated) change.rotated = true;
      if (typeof c.summary === "string") change.summary = c.summary;
      if (row && c.op !== "add") change.baseVersion = row.version;
      return change;
    });
  };

  const actions = {
    refresh,
    loadValues,
    loadActivity,
    navigate: (name: string, params: Record<string, unknown> = {}) => {
      if (name === "signin") return actions.signOut();
      if (name === "onboarding") {
        window.location.href = "/onboarding?new=1";
        return;
      }
      const st = get();
      const url = routePath(st.slug, name, params, st.data);
      if (url !== window.location.pathname + window.location.search) window.history.pushState(null, "", url);
      dispatch({ type: "ui", patch: { sheet: null, commandOpen: false } });
    },
    back: () => window.history.back(),
    signOut: async () => {
      await authClient.signOut();
      window.location.href = "/sign-in";
    },
    switchWorkspace: (ws: string) => {
      window.location.href = `/${encodeURIComponent(ws)}`;
    },
    setPrefs: (prefs: Partial<Prefs>) => {
      dispatch({ type: "prefs", prefs });
      const remote = Object.fromEntries(
        Object.entries(prefs).filter(([k]) =>
          ["theme", "density", "revealTimeoutSec", "clipboardClearSec"].includes(k),
        ),
      );
      if (Object.keys(remote).length)
        api.preferences(remote).catch((error) => fail(error, "Could not save your preferences"));
    },
    toggleTheme: () => {
      const current = get().prefs.theme;
      const dark =
        current === "dark" || (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      actions.setPrefs({ theme: dark ? "light" : "dark" });
    },
    ui: (patch: Partial<Ui>) => dispatch({ type: "ui", patch }),
    openSheet: (kind: string, props: Record<string, unknown> = {}) =>
      dispatch({ type: "ui", patch: { sheet: { kind, props } } }),
    closeSheet: () => dispatch({ type: "ui", patch: { sheet: null } }),
    openDialog: (kind: string, props: Record<string, unknown> = {}) =>
      dispatch({ type: "ui", patch: { dialog: { kind, props } } }),
    closeDialog: () => dispatch({ type: "ui", patch: { dialog: null } }),
    openCommand: () => dispatch({ type: "ui", patch: { commandOpen: true } }),
    closeCommand: () => dispatch({ type: "ui", patch: { commandOpen: false } }),
    toast,
    fail,
    setOffline: (offline: boolean) => {
      dispatch({ type: "ui", patch: { offline } });
      if (!offline) refresh();
    },

    stage: (envId: string, key: string, change: Record<string, unknown>) =>
      dispatch({ type: "stage", envId, key, change }),
    unstage: (envId: string, key: string) => dispatch({ type: "stage", envId, key, change: null }),
    discard: (envId: string) => dispatch({ type: "discard", envId }),
    restoreStaged: (envId: string, changes: Staged[string]) => dispatch({ type: "restoreStaged", envId, changes }),

    commit: async (envId: string, { message, confirm }: { message?: string; confirm?: string } = {}) => {
      const st = get();
      const env = envOf(envId);
      const staged = st.staged[envId];
      if (!env || !staged || !Object.keys(staged).length) return 0;
      const changes = changesFor(envId);
      const imported = Object.values(staged).every((c) => c.source === "import");
      try {
        const result = await api.saveChanges(envId, {
          changes,
          message,
          confirm: env.protected ? (confirm ?? env.name) : undefined,
          source: imported ? "import" : undefined,
        });
        dispatch({ type: "discard", envId });
        await Promise.all([refresh(), loadValues(envId, { force: true })]);
        toast({
          tone: "success",
          title: `Saved ${n(changes.length, "change")} to ${env.name}`,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api.revert(envId, result.changeSetId, env.name);
                await Promise.all([refresh(), loadValues(envId, { force: true })]);
                toast({ title: `Restored ${env.name}` });
              } catch (error) {
                fail(error, "Could not undo");
              }
            },
          },
        });
        return result.count;
      } catch (error) {
        if (error instanceof RequestError && error.code === "conflict") {
          await Promise.all([refresh(), loadValues(envId, { force: true })]);
        }
        fail(error, `Could not save ${env.name}`);
        throw error;
      }
    },

    importEntries: (
      envId: string,
      entries: { key: string; value: string; exists?: boolean; sensitive?: boolean }[],
    ) => {
      for (const e of entries) {
        dispatch({
          type: "stage",
          envId,
          key: e.key,
          change: { op: e.exists ? "edit" : "add", value: e.value, sensitive: e.sensitive ?? true, source: "import" },
        });
      }
    },

    copyValue: async (secret: { envId: string; key: string; value?: string }) => {
      const value = await valueFor(secret);
      const ok = await copyText(value);
      if (!ok) {
        toast({
          tone: "danger",
          title: "Could not copy",
          description: "Your browser blocked clipboard access. Select the value and copy it by hand.",
        });
        return false;
      }
      clearClipboardLater(value);
      event(secret.envId, "copy", [secret.key]);
      toast({ title: `Copied ${secret.key}.`, description: clipboardNote() });
      return true;
    },
    copied: (secret: { envId: string; key: string; value?: string }) => {
      if (typeof secret.value === "string") clearClipboardLater(secret.value);
      event(secret.envId, "copy", [secret.key]);
      toast({ title: `Copied ${secret.key}.`, description: clipboardNote() });
    },
    copyString: async (text: string, title: string, description?: string) => {
      const ok = await copyText(text);
      toast(
        ok
          ? { title, description }
          : {
              tone: "danger",
              title: "Could not copy",
              description: "Your browser blocked clipboard access. Select the text and copy it by hand.",
            },
      );
      return ok;
    },
    logReveal: (secret: { envId: string; key: string }) => event(secret.envId, "reveal", [secret.key]),
    log: (entry: { action: string; envId?: string; keys?: string[]; count?: number; message?: string }) => {
      if (!entry.envId) return;
      const action = entry.action === "read" ? "export" : entry.action;
      if (action !== "reveal" && action !== "copy" && action !== "export") return;
      const format = entry.message?.replace(/^Exported as /, "");
      event(entry.envId, action, entry.keys ?? [], { count: entry.count, format });
    },

    stageDelete: (envId: string, keys: string[]) => {
      const saved = new Set(
        get()
          .data.secrets.filter((s) => s.envId === envId)
          .map((s) => s.key),
      );
      for (const key of keys) {
        if (saved.has(key)) dispatch({ type: "stage", envId, key, change: { op: "delete" } });
        else dispatch({ type: "stage", envId, key, change: null });
      }
    },
    copyToEnv: async (
      rows: { key: string; value?: string; envId: string; sensitive?: boolean; note?: string }[],
      targetEnvId: string,
      { silent = false } = {},
    ) => {
      const st = get();
      const target = envOf(targetEnvId);
      if (!target) return 0;
      if (target.access !== "write") {
        toast({
          tone: "danger",
          title: `You cannot change ${target.name}`,
          description: "Ask an owner or admin for write access.",
        });
        return 0;
      }
      const unreadable = rows.map((r) => envOf(r.envId)).find((e) => e && e.access !== "read" && e.access !== "write");
      if (unreadable && rows.some((r) => typeof r.value !== "string")) {
        toast({
          tone: "danger",
          title: `You cannot read ${unreadable.name}`,
          description: "Copying needs read access to the values.",
        });
        return 0;
      }
      const withValues = await Promise.all(rows.map(async (r) => ({ ...r, value: await valueFor(r) })));
      const targetValues = (await loadValues(targetEnvId)) ?? {};
      const savedKeys = new Set(st.data.secrets.filter((s) => s.envId === targetEnvId).map((s) => s.key));
      const staged = st.staged[targetEnvId] ?? {};
      const todo = withValues.filter(
        (r) => !savedKeys.has(r.key) || targetValues[r.key] !== r.value || !!staged[r.key],
      );
      if (!todo.length) {
        if (!silent) {
          toast({
            title:
              rows.length === 1
                ? `${rows[0]!.key} already matches in ${target.name}`
                : `All ${rows.length} secrets already match in ${target.name}`,
            description: "Nothing to copy.",
          });
        }
        return 0;
      }
      for (const r of todo) {
        const exists = savedKeys.has(r.key);
        dispatch({
          type: "stage",
          envId: targetEnvId,
          key: r.key,
          change: {
            op: exists ? "edit" : "add",
            value: r.value,
            sensitive: r.sensitive ?? true,
            ...(exists ? {} : { note: r.note ?? "" }),
          },
        });
      }
      if (!silent) {
        toast({
          title:
            todo.length === 1
              ? `Staged ${todo[0]!.key} in ${target.name}`
              : `Staged ${todo.length} secrets in ${target.name}`,
          description: target.protected
            ? `Saving asks you to type ${target.name}.`
            : "Review and save them from the changes bar.",
          action: {
            label: `Open ${target.name}`,
            onClick: () =>
              actions.navigate("secrets", { projectId: target.projectId, envId: target.id, mode: "table" }),
          },
        });
      }
      return todo.length;
    },
    rotateNow: (secret: { envId: string; key: string }) => {
      dispatch({
        type: "stage",
        envId: secret.envId,
        key: secret.key,
        change: { op: "edit", value: generateSecretValue(48), rotated: true, summary: "Rotated" },
      });
      const env = envOf(secret.envId);
      toast({
        title: `Staged a new ${secret.key}`,
        description: `Save ${env ? env.name : "the environment"} to finish the rotation. Services pick it up on their next deploy.`,
      });
    },
    setRotation: async (secretId: string, days: number | null) => {
      const secret = get().data.secrets.find((s) => s.id === secretId);
      if (!secret) return;
      try {
        await api.setRotation(secret.envId, secretId, days || null);
        await refresh();
        toast({
          title: days ? `${secret.key} rotates every ${days} days` : `Rotation reminders off for ${secret.key}`,
        });
      } catch (error) {
        fail(error, "Could not change rotation");
      }
    },

    toggleStar: async (projectId: string) => {
      const project = projectOf(projectId);
      if (!project) return;
      try {
        await api.star(projectId, !project.starred);
        await refresh();
      } catch (error) {
        fail(error, "Could not update the star");
      }
    },
    createProject: async (input: { name: string; repo?: string; envNames?: string[] }) => {
      const colors: Record<string, string> = {
        development: "blue",
        staging: "amber",
        production: "rose",
        preview: "violet",
      };
      try {
        const { project, environments } = await api.createProject(slug(), {
          name: input.name,
          repo: input.repo || null,
          environments: (input.envNames ?? ["development", "staging", "production"]).map((name) => ({
            name,
            color: colors[name] ?? "gray",
            protected: name === "production",
          })),
        });
        await refresh();
        return { id: project.id, environments };
      } catch (error) {
        return fail(error, "Could not create the project");
      }
    },
    updateProject: async (
      projectId: string,
      input: { name?: string; description?: string; repo?: string | null; archived?: boolean },
    ) => {
      try {
        await api.updateProject(projectId, input);
        await refresh();
        return true;
      } catch (error) {
        fail(error, "Could not save the project");
        return false;
      }
    },
    deleteProject: async (projectId: string, confirm: string) => {
      try {
        await api.deleteProject(projectId, confirm);
        await refresh();
        return true;
      } catch (error) {
        fail(error, "Could not delete the project");
        return false;
      }
    },
    createEnvironment: async (input: {
      projectId: string;
      name: string;
      color?: string;
      cloneFrom?: string | null;
      protected?: boolean;
    }) => {
      try {
        const { environment } = await api.createEnvironment(input.projectId, {
          name: input.name,
          color: input.color,
          cloneFrom: input.cloneFrom,
          protected: input.protected,
        });
        await refresh();
        return environment.id;
      } catch (error) {
        return fail(error, "Could not create the environment");
      }
    },
    updateEnvironment: async (
      envId: string,
      patch: { name?: string; color?: string; protected?: boolean; confirm?: string },
    ) => {
      const env = envOf(envId);
      try {
        await api.updateEnvironment(envId, {
          ...patch,
          confirm: patch.confirm ?? (patch.protected !== undefined ? env?.name : undefined),
        });
        await refresh();
        return true;
      } catch (error) {
        fail(error, `Could not update ${env?.name ?? "the environment"}`);
        return false;
      }
    },
    deleteEnvironment: async (envId: string, confirm?: string) => {
      const env = envOf(envId);
      try {
        await api.deleteEnvironment(envId, confirm ?? env?.name ?? "");
        dispatch({ type: "discard", envId });
        await refresh();
        return true;
      } catch (error) {
        fail(error, `Could not delete ${env?.name ?? "the environment"}`);
        return false;
      }
    },
    reorderEnvironments: async (projectId: string, ids: string[]) => {
      try {
        await api.reorderEnvironments(projectId, ids);
        await refresh();
      } catch (error) {
        fail(error, "Could not reorder environments");
      }
    },
    setAccess: async (envId: string, memberId: string, access: "none" | "read" | "write" | null) => {
      try {
        await api.setAccess(envId, memberId, access);
        await refresh();
        return true;
      } catch (error) {
        fail(error, "Could not change access");
        return false;
      }
    },

    createToken: async (input: {
      name: string;
      envId: string;
      access: "read" | "write";
      expiresInDays?: number | null;
    }) => {
      try {
        const result = await api.createToken(slug(), {
          name: input.name,
          environmentId: input.envId,
          access: input.access,
          expiresInDays: input.expiresInDays ?? null,
        });
        await refresh();
        return result;
      } catch (error) {
        return fail(error, "Could not create the token");
      }
    },
    rotateToken: async (id: string) => {
      try {
        const result = await api.rotateToken(slug(), id);
        await refresh();
        return result;
      } catch (error) {
        return fail(error, "Could not rotate the token");
      }
    },
    revokeToken: async (id: string) => {
      const token = get().data.tokens.find((t) => t.id === id);
      try {
        await api.revokeToken(slug(), id);
        await refresh();
        if (token)
          toast({ title: `Revoked ${token.name}`, description: "Requests with this token now fail with 401." });
        return true;
      } catch (error) {
        fail(error, "Could not revoke the token");
        return false;
      }
    },

    invite: async ({ email, role, resend }: { email: string; role: string; resend?: boolean }) => {
      try {
        await api.invite(slug(), { email, role: ROLE_VALUE[role] ?? role.toLowerCase(), resend });
        if (resend) await refresh();
        return true;
      } catch (error) {
        fail(error, `Could not invite ${email}`);
        return false;
      }
    },
    cancelInvite: async (id: string) => {
      try {
        await api.cancelInvite(slug(), id);
        await refresh();
        return true;
      } catch (error) {
        fail(error, "Could not revoke the invite");
        return false;
      }
    },
    setRole: async (userId: string, role: string) => {
      const member = get().data.members.find((m) => m.id === userId);
      if (!member) return false;
      try {
        await api.setRole(slug(), member.memberId, ROLE_VALUE[role] ?? role.toLowerCase());
        await refresh();
        return true;
      } catch (error) {
        fail(error, `Could not change ${member.name}'s role`);
        return false;
      }
    },
    removeMember: async (userId: string) => {
      const member = get().data.members.find((m) => m.id === userId);
      if (!member) return false;
      try {
        await api.removeMember(slug(), member.memberId);
        if (userId === get().data.currentUserId) {
          window.location.href = "/onboarding";
          return true;
        }
        await refresh();
        return true;
      } catch (error) {
        fail(error, `Could not remove ${member.name}`);
        return false;
      }
    },

    dismissInsight: async (id: string, snoozeDays?: number) => {
      try {
        await api.dismissInsight(slug(), id, snoozeDays);
        await refresh();
        return true;
      } catch (error) {
        fail(error, "Could not dismiss that insight");
        return false;
      }
    },
    restoreInsight: async (id: string) => {
      try {
        await api.restoreInsight(slug(), id);
        await refresh();
      } catch (error) {
        fail(error, "Could not restore that insight");
      }
    },
    restoreAllInsights: async () => {
      const ids = get().data.dismissedInsights;
      try {
        await Promise.all(ids.map((id) => api.restoreInsight(slug(), id)));
        await refresh();
      } catch (error) {
        fail(error, "Could not restore insights");
      }
    },
    createShare: async (secretId: string, { maxViews = 1, expiresInHours = 24 } = {}) => {
      const secret = get().data.secrets.find((s) => s.id === secretId);
      if (!secret) return null;
      try {
        const link = await api.createShare(secret.envId, secretId, { maxViews, expiresInHours });
        await refresh();
        return link;
      } catch (error) {
        return fail(error, "Could not create the link");
      }
    },
    revokeShare: async (id: string) => {
      try {
        await api.revokeShare(slug(), id);
        await refresh();
      } catch (error) {
        fail(error, "Could not revoke the link");
      }
    },
    renameWorkspace: async (input: { name?: string; slug?: string }) => {
      try {
        await api.renameWorkspace(slug(), input);
        if (input.slug && input.slug !== slug()) {
          window.location.href = `/${input.slug}/settings/workspace`;
          return true;
        }
        await refresh();
        return true;
      } catch (error) {
        fail(error, "Could not save the workspace");
        return false;
      }
    },
  };
  return actions;
}

export type Actions = ReturnType<typeof makeActions>;

export function makeSelectors(state: State & { route: Route }) {
  const d = state.data;
  const now = Date.now();
  const memberById = (id: string | null | undefined) => {
    if (!id) return { id: "", name: "Someone who left" };
    const member = d.members.find((m) => m.id === id);
    if (member) return member;
    const token = d.tokens.find((t) => t.id === id);
    if (token) return { id, name: token.name, kind: "token" };
    return { id, name: "Someone who left" };
  };
  const memberByMemberId = (memberId: string | null | undefined) =>
    d.members.find((m) => m.memberId === memberId) ?? null;
  const projectById = (id: unknown) => d.projects.find((p) => p.id === id) ?? null;
  const envById = (id: unknown) => d.environments.find((e) => e.id === id) ?? null;
  const envsOf = (projectId: unknown) =>
    d.environments.filter((e) => e.projectId === projectId).sort((a, b) => a.order - b.order);
  const valuesOf = (envId: string) => state.values[envId];
  const rawSecretsOf = (envId: unknown) => {
    const values = valuesOf(envId as string)?.values;
    return d.secrets
      .filter((s) => s.envId === envId)
      .map((s) => ({ ...s, value: values ? (values[s.key] ?? "") : undefined }))
      .sort((a, b) => a.key.localeCompare(b.key));
  };
  const stagedOf = (envId: string) => state.staged[envId] ?? {};
  const secretsOf = (envId: string) => {
    const staged = stagedOf(envId);
    const env = envById(envId);
    const rows: Record<string, unknown>[] = rawSecretsOf(envId).map((s) => {
      const c = staged[s.key];
      if (!c) return { ...s, status: "unchanged" };
      if (c.op === "delete") return { ...s, status: "deleted" };
      return {
        ...s,
        previousValue: s.value,
        value: c.value !== undefined ? c.value : s.value,
        note: c.note !== undefined ? c.note : s.note,
        sensitive: c.sensitive !== undefined ? c.sensitive : s.sensitive,
        status: "modified",
      };
    });
    for (const [key, c] of Object.entries(staged)) {
      if (c.op === "add" && !rows.some((r) => r.key === key)) {
        rows.push({
          id: `new:${envId}:${key}`,
          projectId: env?.projectId,
          envId,
          key,
          value: (c.value as string) ?? "",
          note: (c.note as string) ?? "",
          sensitive: c.sensitive !== undefined ? c.sensitive : true,
          status: "added",
          updatedAt: null,
          updatedBy: d.currentUserId,
        });
      }
    }
    return rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  };
  const keysOf = (projectId: string) =>
    [...new Set(d.secrets.filter((s) => s.projectId === projectId).map((s) => s.key))].sort();
  const missingIn = (secret: { projectId: string; envId: string; key: string }) =>
    envsOf(secret.projectId)
      .filter((e) => e.id !== secret.envId && !d.secrets.some((s) => s.envId === e.id && s.key === secret.key))
      .map((e) => e.name);
  const valueIn = (projectId: string, key: string) =>
    Object.fromEntries(
      envsOf(projectId).map((e) => {
        const s = rawSecretsOf(e.id).find((x) => x.key === key);
        return [e.id, s ?? null];
      }),
    );
  const dismissed = new Set(d.dismissedInsights);
  const insightsFor = (projectId: string): Insight[] =>
    computeInsights(projectId, d.environments, d.secrets, now).filter((i) => !dismissed.has(i.id));
  const allInsights = () => d.projects.flatMap((p) => insightsFor(p.id).map((i) => ({ ...i, projectId: p.id })));
  const activityFor = ({
    projectId,
    envId,
    actor,
    action,
  }: {
    projectId?: string;
    envId?: string;
    actor?: string;
    action?: string;
  } = {}) =>
    state.activity.entries.filter(
      (a) =>
        (!projectId || a.projectId === projectId) &&
        (!envId || a.envId === envId) &&
        (!actor || a.actor === actor) &&
        (!action || a.action === action),
    );
  const stagedCount = (envId: string) => Object.keys(stagedOf(envId)).length;
  const totalStaged = () => Object.values(state.staged).reduce((sum, m) => sum + Object.keys(m).length, 0);
  const tokensFor = (projectId?: string) => d.tokens.filter((t) => !projectId || t.projectId === projectId);
  const me = d.members.find((m) => m.id === d.currentUserId) ?? {
    id: d.me.id,
    name: d.me.name,
    email: d.me.email,
    role: ROLE_LABEL[d.me.role ?? "viewer"],
    roleValue: d.me.role ?? "viewer",
  };
  const canManage = d.me.role === "owner" || d.me.role === "admin";
  const canWrite = (envId: string) => envById(envId)?.access === "write";
  const canRead = (envId: string) => {
    const access = envById(envId)?.access;
    return access === "read" || access === "write";
  };
  const valuesStatus = (envId: string) => valuesOf(envId)?.status ?? "idle";
  return {
    memberById,
    memberByMemberId,
    projectById,
    envById,
    envsOf,
    rawSecretsOf,
    secretsOf,
    stagedOf,
    keysOf,
    missingIn,
    valueIn,
    insightsFor,
    allInsights,
    activityFor,
    activityStatus: state.activity.status,
    stagedCount,
    totalStaged,
    tokensFor,
    me,
    now,
    canManage,
    canWrite,
    canRead,
    valuesStatus,
  };
}

export function useRecentActivity() {
  const { actions } = useStore();
  useEffect(() => {
    actions.loadActivity();
  }, [actions]);
}

export function useEnvValues(envIds: (string | null | undefined)[]) {
  const { actions, select } = useStore();
  const key = envIds.filter(Boolean).join(",");
  useEffect(() => {
    for (const id of key.split(",").filter(Boolean)) if (select.canRead(id)) actions.loadValues(id);
  }, [key, actions]);
}
