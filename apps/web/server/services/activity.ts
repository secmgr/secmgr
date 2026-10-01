import { auditEvents, type Database, environments, projects, serviceTokens, users } from "@secmgr/db";
import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import type { Context } from "../context.ts";

export type ActivityQuery = {
  projectId?: string;
  environmentId?: string;
  actorId?: string;
  action?: string;
  before?: string;
  limit?: number;
  visibleEnvironments?: Set<string>;
};

export type ActivityEntry = {
  id: string;
  at: string;
  action: string;
  actor: string | null;
  actorKind: "member" | "token";
  actorName: string;
  projectId: string | null;
  envId: string | null;
  keys: string[];
  target: string | null;
  changeSetId: string | null;
  detail: Record<string, unknown>;
};

export async function listActivity(db: Database, ctx: Context, query: ActivityQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const where: (SQL | undefined)[] = [eq(auditEvents.organizationId, ctx.workspace.id)];
  if (query.projectId) where.push(eq(auditEvents.projectId, query.projectId));
  if (query.environmentId) where.push(eq(auditEvents.environmentId, query.environmentId));
  if (query.action) where.push(eq(auditEvents.action, query.action));
  if (query.actorId)
    where.push(or(eq(auditEvents.actorUserId, query.actorId), eq(auditEvents.actorTokenId, query.actorId)));
  if (query.before) {
    const date = new Date(query.before);
    if (!Number.isNaN(date.getTime())) where.push(lt(auditEvents.createdAt, date));
  }
  const rows = await db
    .select({
      event: auditEvents,
      userName: users.name,
      userEmail: users.email,
      tokenName: serviceTokens.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .leftJoin(serviceTokens, eq(serviceTokens.id, auditEvents.actorTokenId))
    .where(and(...where))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit + 1);
  const visible = query.visibleEnvironments;
  const entries: ActivityEntry[] = rows
    .filter(({ event }) => !visible || !event.environmentId || visible.has(event.environmentId))
    .slice(0, limit)
    .map(({ event, userName, userEmail, tokenName }) => ({
      id: event.id,
      at: event.createdAt.toISOString(),
      action: event.action,
      actor: event.actorUserId ?? event.actorTokenId,
      actorKind: event.actorTokenId ? "token" : "member",
      actorName: tokenName || userName || userEmail || "Someone who left",
      projectId: event.projectId,
      envId: event.environmentId,
      keys: event.keys,
      target: event.target,
      changeSetId: event.changeSetId,
      detail: event.detail,
    }));
  const last = rows.length > limit ? entries.at(-1) : undefined;
  return { entries, next: last ? last.at : null };
}

export async function environmentNames(db: Database, ids: string[]) {
  if (!ids.length) return new Map<string, { name: string; projectName: string }>();
  const rows = await db
    .select({ id: environments.id, name: environments.name, projectName: projects.name })
    .from(environments)
    .innerJoin(projects, eq(projects.id, environments.projectId))
    .where(inArray(environments.id, ids));
  return new Map(rows.map((r) => [r.id, { name: r.name, projectName: r.projectName }]));
}
