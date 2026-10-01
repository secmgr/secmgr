import { sealForShare } from "@secmgr/crypto";
import { type Database, secrets, shareLinks } from "@secmgr/db";
import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { record } from "../audit.ts";
import { type Context, canManage, isUuid, requireUser } from "../context.ts";
import { forbidden, gone, invalid, notFound } from "../errors.ts";
import { readValues, type Scope } from "./secrets.ts";

export type CreateShareInput = { secretId: string; maxViews?: number; expiresInHours?: number };

export async function createShare(db: Database, scope: Scope, input: CreateShareInput, appUrl: string) {
  const actor = requireUser(scope.ctx);
  const maxViews = input.maxViews ?? 1;
  const hours = input.expiresInHours ?? 24;
  if (!Number.isInteger(maxViews) || maxViews < 1 || maxViews > 10)
    throw invalid("A link opens between 1 and 10 times");
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw invalid("A link lasts between 1 hour and 7 days");
  if (!isUuid(input.secretId)) throw notFound("Secret");
  const [secret] = await db
    .select()
    .from(secrets)
    .where(
      and(eq(secrets.id, input.secretId), eq(secrets.environmentId, scope.environment.id), isNull(secrets.deletedAt)),
    );
  if (!secret) throw notFound("Secret");
  const values = await readValues(db, scope);
  const sealed = sealForShare(values[secret.key] ?? "");
  const expiresAt = new Date(Date.now() + hours * 3_600_000);
  const [link] = await db
    .insert(shareLinks)
    .values({
      organizationId: scope.ctx.workspace.id,
      secretId: secret.id,
      createdBy: actor.userId,
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
      maxViews,
      expiresAt,
    })
    .returning({ id: shareLinks.id });
  await record(db, scope.ctx, {
    action: "share",
    projectId: scope.project.id,
    environmentId: scope.environment.id,
    keys: [secret.key],
    target: link!.id,
    detail: { maxViews, expiresInHours: hours, project: scope.project.name, environment: scope.environment.name },
  });
  return { id: link!.id, url: `${appUrl.replace(/\/$/, "")}/s/${link!.id}#${sealed.key}`, expiresAt, maxViews };
}

export async function openShare(db: Database, id: string) {
  if (!isUuid(id)) throw notFound("Link");
  return db.transaction(async (tx) => {
    const [link] = await tx
      .update(shareLinks)
      .set({ views: sql`${shareLinks.views} + 1`, lastViewedAt: new Date() })
      .where(
        and(
          eq(shareLinks.id, id),
          isNull(shareLinks.revokedAt),
          isNotNull(shareLinks.ciphertext),
          gt(shareLinks.expiresAt, new Date()),
          lt(shareLinks.views, shareLinks.maxViews),
        ),
      )
      .returning();
    if (!link) throw gone("This link has expired, was revoked or was already opened");
    if (link.views >= link.maxViews) {
      await tx.update(shareLinks).set({ ciphertext: null, nonce: null }).where(eq(shareLinks.id, id));
    }
    return {
      ciphertext: link.ciphertext!.toString("base64"),
      nonce: link.nonce!.toString("base64"),
      viewsLeft: link.maxViews - link.views,
      expiresAt: link.expiresAt,
    };
  });
}

export async function peekShare(db: Database, id: string) {
  if (!isUuid(id)) return null;
  const [link] = await db
    .select({
      views: shareLinks.views,
      maxViews: shareLinks.maxViews,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      hasValue: isNotNull(shareLinks.ciphertext),
    })
    .from(shareLinks)
    .where(eq(shareLinks.id, id));
  if (!link) return null;
  const open = !link.revokedAt && link.hasValue && link.expiresAt > new Date() && link.views < link.maxViews;
  return { open, expiresAt: link.expiresAt, viewsLeft: Math.max(0, link.maxViews - link.views) };
}

export async function revokeShare(db: Database, ctx: Context, id: string) {
  const actor = requireUser(ctx);
  if (!isUuid(id)) throw notFound("Link");
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.id, id), eq(shareLinks.organizationId, ctx.workspace.id)));
  if (!link) throw notFound("Link");
  if (link.createdBy !== actor.userId && !canManage(ctx))
    throw forbidden("Only the person who made a link, or an admin, can revoke it");
  await db
    .update(shareLinks)
    .set({ revokedAt: new Date(), ciphertext: null, nonce: null })
    .where(eq(shareLinks.id, id));
}
