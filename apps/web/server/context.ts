import { type Database, environmentAccess, environments, members, organizations, projects } from "@secmgr/db";
import { and, eq } from "drizzle-orm";
import { forbidden, notFound } from "./errors.ts";

export const ROLES = ["owner", "admin", "developer", "viewer"] as const;
export type Role = (typeof ROLES)[number];
export type Access = "none" | "meta" | "read" | "write";

export type UserActor = { kind: "user"; userId: string; name: string; email: string };
export type TokenActor = {
  kind: "token";
  tokenId: string;
  name: string;
  organizationId: string;
  environmentId: string;
  access: "read" | "write";
};
export type Actor = UserActor | TokenActor;

export type RequestInfo = { ip?: string | null; userAgent?: string | null };
export type Workspace = { id: string; name: string; slug: string; createdAt: Date };

export type Context = {
  db: Database;
  actor: Actor;
  workspace: Workspace;
  role: Role | null;
  memberId: string | null;
  request: RequestInfo;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);
export const canManage = (ctx: Pick<Context, "role">) => ctx.role === "owner" || ctx.role === "admin";

export function requireUser(ctx: Context): UserActor {
  if (ctx.actor.kind !== "user") throw forbidden("Service tokens can only read and write secrets");
  return ctx.actor;
}

export function requireManage(ctx: Context, what: string) {
  requireUser(ctx);
  if (!canManage(ctx)) throw forbidden(`Only owners and admins can ${what}`);
}

export function accessFor(
  ctx: Pick<Context, "actor" | "role">,
  environment: { id: string; protected: boolean },
  override?: Access | null,
): Access {
  if (ctx.actor.kind === "token") return ctx.actor.environmentId === environment.id ? ctx.actor.access : "none";
  if (ctx.role === "owner") return "write";
  if (override) return override;
  if (ctx.role === "admin" || ctx.role === "developer") return "write";
  if (ctx.role === "viewer") return environment.protected ? "meta" : "read";
  return "none";
}

export const canRead = (access: Access) => access === "read" || access === "write";

async function contextFor(
  db: Database,
  actor: Actor,
  organization: typeof organizations.$inferSelect | undefined,
  request: RequestInfo,
): Promise<Context> {
  if (!organization) throw notFound("Workspace");
  const workspace = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt,
  };
  if (actor.kind === "token") {
    if (actor.organizationId !== organization.id) throw notFound("Workspace");
    return { db, actor, workspace, role: null, memberId: null, request };
  }
  const [member] = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(and(eq(members.organizationId, organization.id), eq(members.userId, actor.userId)));
  if (!member) throw notFound("Workspace");
  return { db, actor, workspace, role: isRole(member.role) ? member.role : "viewer", memberId: member.id, request };
}

export async function workspaceContext(db: Database, actor: Actor, slug: string, request: RequestInfo = {}) {
  const [organization] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  return contextFor(db, actor, organization, request);
}

export async function organizationContext(
  db: Database,
  actor: Actor,
  organizationId: string,
  request: RequestInfo = {},
) {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  return contextFor(db, actor, organization, request);
}

export async function loadProject(db: Database, actor: Actor, projectId: string, request: RequestInfo = {}) {
  if (!isUuid(projectId)) throw notFound("Project");
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw notFound("Project");
  const ctx = await organizationContext(db, actor, project.organizationId, request).catch(() => {
    throw notFound("Project");
  });
  if (actor.kind === "token") {
    const [env] = await db
      .select({ projectId: environments.projectId })
      .from(environments)
      .where(eq(environments.id, actor.environmentId));
    if (env?.projectId !== project.id) throw notFound("Project");
  }
  return { ctx, project };
}

export async function overrideFor(db: Database, ctx: Context, environmentId: string): Promise<Access | null> {
  if (!ctx.memberId || ctx.role === "owner") return null;
  const [row] = await db
    .select({ access: environmentAccess.access })
    .from(environmentAccess)
    .where(and(eq(environmentAccess.environmentId, environmentId), eq(environmentAccess.memberId, ctx.memberId)));
  return row?.access ?? null;
}

export async function loadEnvironment(db: Database, actor: Actor, environmentId: string, request: RequestInfo = {}) {
  if (!isUuid(environmentId)) throw notFound("Environment");
  const [row] = await db
    .select({ environment: environments, project: projects })
    .from(environments)
    .innerJoin(projects, eq(projects.id, environments.projectId))
    .where(eq(environments.id, environmentId));
  if (!row) throw notFound("Environment");
  const ctx = await organizationContext(db, actor, row.project.organizationId, request).catch(() => {
    throw notFound("Environment");
  });
  const access = accessFor(ctx, row.environment, await overrideFor(db, ctx, row.environment.id));
  if (access === "none") throw notFound("Environment");
  return { ctx, project: row.project, environment: row.environment, access };
}

export async function environmentAccessMap(db: Database, ctx: Context) {
  const rows = await db
    .select({ id: environments.id, protected: environments.protected })
    .from(environments)
    .innerJoin(projects, eq(projects.id, environments.projectId))
    .where(eq(projects.organizationId, ctx.workspace.id));
  const overrides = ctx.memberId
    ? await db.select().from(environmentAccess).where(eq(environmentAccess.memberId, ctx.memberId))
    : [];
  const byEnv = new Map(overrides.map((o) => [o.environmentId, o.access]));
  return new Map(rows.map((e) => [e.id, accessFor(ctx, e, ctx.role === "owner" ? null : byEnv.get(e.id))]));
}

export function requireAccess(access: Access, needed: "read" | "write", environmentName: string) {
  if (needed === "write" && access !== "write") throw forbidden(`You can read ${environmentName} but not change it`);
  if (needed === "read" && !canRead(access))
    throw forbidden(`You can see the keys in ${environmentName} but not their values`);
}
