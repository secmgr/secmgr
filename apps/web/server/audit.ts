import { auditEvents, type Database } from "@secmgr/db";
import { and, eq, gt } from "drizzle-orm";
import type { Context } from "./context.ts";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "rotate"
  | "import"
  | "read"
  | "reveal"
  | "copy"
  | "export"
  | "share"
  | "protect"
  | "unprotect"
  | "create-project"
  | "update-project"
  | "archive-project"
  | "delete-project"
  | "create-env"
  | "update-env"
  | "delete-env"
  | "token"
  | "invite"
  | "member"
  | "access"
  | "workspace";

export type AuditEntry = {
  action: AuditAction;
  projectId?: string | null;
  environmentId?: string | null;
  keys?: string[];
  target?: string | null;
  changeSetId?: string | null;
  detail?: Record<string, unknown>;
};

export async function record(db: Database, ctx: Context, entry: AuditEntry) {
  await db.insert(auditEvents).values({
    organizationId: ctx.workspace.id,
    projectId: entry.projectId ?? null,
    environmentId: entry.environmentId ?? null,
    actorUserId: ctx.actor.kind === "user" ? ctx.actor.userId : null,
    actorTokenId: ctx.actor.kind === "token" ? ctx.actor.tokenId : null,
    action: entry.action,
    keys: entry.keys ?? [],
    target: entry.target ?? null,
    changeSetId: entry.changeSetId ?? null,
    detail: entry.detail ?? {},
    ipAddress: ctx.request.ip ?? null,
    userAgent: ctx.request.userAgent ?? null,
  });
}

export async function recordOncePer(db: Database, ctx: Context, minutes: number, entry: AuditEntry) {
  const since = new Date(Date.now() - minutes * 60_000);
  const actor =
    ctx.actor.kind === "user"
      ? eq(auditEvents.actorUserId, ctx.actor.userId)
      : eq(auditEvents.actorTokenId, ctx.actor.tokenId);
  const [recent] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, ctx.workspace.id),
        eq(auditEvents.action, entry.action),
        entry.environmentId ? eq(auditEvents.environmentId, entry.environmentId) : undefined,
        actor,
        gt(auditEvents.createdAt, since),
      ),
    )
    .limit(1);
  if (!recent) await record(db, ctx, entry);
}
