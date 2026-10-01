import { generateToken, hashToken, TOKEN_PREFIX } from "@secmgr/crypto";
import { type Database, environments, projects, serviceTokens } from "@secmgr/db";
import { and, eq, isNull } from "drizzle-orm";
import { record } from "../audit.ts";
import { type Context, isUuid, requireManage, requireUser, type TokenActor } from "../context.ts";
import { invalid, notFound } from "../errors.ts";

export type CreateTokenInput = {
  name: string;
  environmentId: string;
  access: "read" | "write";
  expiresInDays?: number | null;
};

export async function createToken(db: Database, ctx: Context, input: CreateTokenInput) {
  requireManage(ctx, "create tokens");
  const actor = requireUser(ctx);
  const name = input.name.trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    throw invalid("Name the token in lowercase with dashes, like ci-deploy", { field: "name" });
  }
  if (input.access !== "read" && input.access !== "write")
    throw invalid("Access is read or write", { field: "access" });
  const days = input.expiresInDays ?? null;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
    throw invalid("Expiry is between 1 and 365 days, or never", { field: "expiresInDays" });
  }
  if (!isUuid(input.environmentId)) throw notFound("Environment");
  const [row] = await db
    .select({ environment: environments, project: projects })
    .from(environments)
    .innerJoin(projects, eq(projects.id, environments.projectId))
    .where(and(eq(environments.id, input.environmentId), eq(projects.organizationId, ctx.workspace.id)));
  if (!row) throw notFound("Environment");
  const { token, hash, prefix, suffix } = generateToken();
  const [created] = await db
    .insert(serviceTokens)
    .values({
      organizationId: ctx.workspace.id,
      environmentId: row.environment.id,
      name,
      tokenHash: hash,
      prefix,
      suffix,
      access: input.access,
      createdBy: actor.userId,
      expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
    })
    .returning();
  await record(db, ctx, {
    action: "token",
    projectId: row.project.id,
    environmentId: row.environment.id,
    target: name,
    detail: { verb: "created", access: input.access, project: row.project.name, environment: row.environment.name },
  });
  return { token: created!, secret: token };
}

export async function revokeToken(db: Database, ctx: Context, tokenId: string) {
  requireManage(ctx, "revoke tokens");
  if (!isUuid(tokenId)) throw notFound("Token");
  const [row] = await db
    .select({ token: serviceTokens, environment: environments, project: projects })
    .from(serviceTokens)
    .innerJoin(environments, eq(environments.id, serviceTokens.environmentId))
    .innerJoin(projects, eq(projects.id, environments.projectId))
    .where(
      and(
        eq(serviceTokens.id, tokenId),
        eq(serviceTokens.organizationId, ctx.workspace.id),
        isNull(serviceTokens.revokedAt),
      ),
    );
  if (!row) throw notFound("Token");
  await db.update(serviceTokens).set({ revokedAt: new Date() }).where(eq(serviceTokens.id, tokenId));
  await record(db, ctx, {
    action: "token",
    projectId: row.project.id,
    environmentId: row.environment.id,
    target: row.token.name,
    detail: { verb: "revoked", project: row.project.name, environment: row.environment.name },
  });
  return row.token;
}

export async function rotateToken(db: Database, ctx: Context, tokenId: string) {
  requireManage(ctx, "rotate tokens");
  const actor = requireUser(ctx);
  if (!isUuid(tokenId)) throw notFound("Token");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ token: serviceTokens, environment: environments, project: projects })
      .from(serviceTokens)
      .innerJoin(environments, eq(environments.id, serviceTokens.environmentId))
      .innerJoin(projects, eq(projects.id, environments.projectId))
      .where(
        and(
          eq(serviceTokens.id, tokenId),
          eq(serviceTokens.organizationId, ctx.workspace.id),
          isNull(serviceTokens.revokedAt),
        ),
      )
      .for("update", { of: serviceTokens });
    if (!row) throw notFound("Token");
    const old = row.token;
    const lifetime = old.expiresAt ? old.expiresAt.getTime() - old.createdAt.getTime() : null;
    const { token, hash, prefix, suffix } = generateToken();
    const now = new Date();
    const [created] = await tx
      .insert(serviceTokens)
      .values({
        organizationId: ctx.workspace.id,
        environmentId: old.environmentId,
        name: old.name,
        tokenHash: hash,
        prefix,
        suffix,
        access: old.access,
        createdBy: actor.userId,
        createdAt: now,
        expiresAt: lifetime ? new Date(now.getTime() + Math.max(lifetime, 86_400_000)) : null,
      })
      .returning();
    await tx.update(serviceTokens).set({ revokedAt: now }).where(eq(serviceTokens.id, old.id));
    await record(tx, ctx, {
      action: "token",
      projectId: row.project.id,
      environmentId: row.environment.id,
      target: old.name,
      detail: { verb: "rotated", access: old.access, project: row.project.name, environment: row.environment.name },
    });
    return { token: created!, secret: token };
  });
}

export async function tokenActor(db: Database, raw: string): Promise<TokenActor | null> {
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const [row] = await db
    .select()
    .from(serviceTokens)
    .where(and(eq(serviceTokens.tokenHash, hashToken(raw)), isNull(serviceTokens.revokedAt)));
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt && row.expiresAt.getTime() <= now) return null;
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > 60_000) {
    await db
      .update(serviceTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(serviceTokens.id, row.id));
  }
  return {
    kind: "token",
    tokenId: row.id,
    name: row.name,
    organizationId: row.organizationId,
    environmentId: row.environmentId,
    access: row.access,
  };
}
