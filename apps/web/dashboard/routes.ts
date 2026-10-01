export type RouteName =
  | "projects"
  | "project"
  | "secrets"
  | "compare"
  | "environments"
  | "activity"
  | "health"
  | "tokens"
  | "members"
  | "settings"
  | "notfound";

export type Route = { name: RouteName; params: Record<string, string | string[] | undefined> };

type Named = { id: string; name: string };
type Env = Named & { projectId: string };
export type RouteData = { projects: Named[]; environments: Env[] };

const WORKSPACE_PAGES = new Set(["activity", "health", "tokens", "members"]);

export function parseRoute(pathname: string, search: URLSearchParams, data: RouteData): Route {
  const [, ...rest] = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!rest.length) return { name: "projects", params: {} };
  const [first, second, ...extra] = rest as [string, ...string[]];
  if (WORKSPACE_PAGES.has(first) && !second) {
    const project = data.projects.find((p) => p.name === search.get("project"));
    return { name: first as RouteName, params: project ? { projectId: project.id } : {} };
  }
  if (first === "settings") return { name: "settings", params: { section: second ?? "profile" } };
  const project = data.projects.find((p) => p.name === first);
  if (!project) return { name: "notfound", params: { missing: "project", projectName: first } };
  if (!second) return { name: "project", params: { projectId: project.id, tab: search.get("tab") ?? undefined } };
  if (extra.length) return { name: "notfound", params: {} };
  if (second === "settings") return { name: "project", params: { projectId: project.id, tab: "settings" } };
  if (second === "compare") {
    return {
      name: "compare",
      params: {
        projectId: project.id,
        envs: search.get("envs")?.split(",").filter(Boolean),
        mode: search.get("mode") ?? undefined,
      },
    };
  }
  if (second === "environments") {
    const env = data.environments.find((e) => e.projectId === project.id && e.name === search.get("env"));
    return { name: "environments", params: { projectId: project.id, envId: env?.id } };
  }
  const env = data.environments.find((e) => e.projectId === project.id && e.name === second);
  if (!env) return { name: "notfound", params: { missing: "environment", projectId: project.id, envName: second } };
  return {
    name: "secrets",
    params: { projectId: project.id, envId: env.id, mode: search.get("mode") === "raw" ? "raw" : "table" },
  };
}

export function routePath(slug: string, name: string, params: Record<string, unknown>, data: RouteData) {
  const base = `/${encodeURIComponent(slug)}`;
  const project = data.projects.find((p) => p.id === params.projectId);
  const env = data.environments.find((e) => e.id === params.envId);
  const q = new URLSearchParams();
  const at = (path: string) => {
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const projectBase = project ? `${base}/${encodeURIComponent(project.name)}` : base;
  switch (name) {
    case "projects":
      return base;
    case "activity":
    case "health":
    case "tokens":
    case "members":
      if (project && name !== "members") q.set("project", project.name);
      return at(`${base}/${name}`);
    case "settings":
      return `${base}/settings/${params.section ?? "profile"}`;
    case "project":
      if (params.tab === "settings") return `${projectBase}/settings`;
      return projectBase;
    case "secrets":
      if (!env) return projectBase;
      if (params.mode === "raw") q.set("mode", "raw");
      return at(`${projectBase}/${encodeURIComponent(env.name)}`);
    case "compare":
      if (Array.isArray(params.envs) && params.envs.length) q.set("envs", params.envs.join(","));
      if (typeof params.mode === "string") q.set("mode", params.mode);
      return at(`${projectBase}/compare`);
    case "environments":
      if (env) q.set("env", env.name);
      return at(`${projectBase}/environments`);
    default:
      return base;
  }
}
