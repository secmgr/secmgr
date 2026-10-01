import type { ProjectKey } from "@secmgr/crypto";
import {
  type ChangeOp,
  changeSets,
  type Database,
  type environments,
  type projects,
  secrets,
  secretVersions,
  users,
} from "@secmgr/db";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { type AuditAction, record, recordOncePer } from "../audit.ts";
import { type Access, type Context, requireAccess } from "../context.ts";
import { confirmRequired, conflict, invalid, notFound } from "../errors.ts";
import { list, n } from "../format.ts";
import { projectKey } from "../keys.ts";
import { describeValue, keyProblem, VALUE_MAX } from "../values.ts";

type Environment = typeof environments.$inferSelect;
type Project = typeof projects.$inferSelect;
type Secret = typeof secrets.$inferSelect;
type Version = typeof secretVersions.$inferSelect;
export type Scope = { ctx: Context; project: Project; environment: Environment; access: Access };

export type ChangeInput = {
  op: "add" | "edit" | "delete";
  key: string;
  newKey?: string;
  value?: string;
  note?: string;
  sensitive?: boolean;
  baseVersion?: number | null;
  rotated?: boolean;
  summary?: string;
};

export type ApplyInput = {
  changes: ChangeInput[];
  message?: string;
  confirm?: string;
  source?: "edit" | "import" | "rotate" | "copy" | "restore";
  revertsId?: string;
};

const actorColumns = (ctx: Context) => ({
  actorUserId: ctx.actor.kind === "user" ? ctx.actor.userId : null,
  actorTokenId: ctx.actor.kind === "token" ? ctx.actor.tokenId : null,
});
const userId = (ctx: Context) => (ctx.actor.kind === "user" ? ctx.actor.userId : null);

function decryptVersion(key: ProjectKey, environmentId: string, version: Version) {
  return key.decrypt(
    { ciphertext: version.ciphertext, nonce: version.nonce },
    { environmentId, secretId: version.secretId, version: version.version },
  );
}

async function keyFor(db: Database, projectId: string, versions: Version[]) {
  const keys = new Map<number, ProjectKey>();
  for (const v of versions)
    if (!keys.has(v.keyVersion)) keys.set(v.keyVersion, await projectKey(db, projectId, v.keyVersion));
  return (v: Version) => keys.get(v.keyVersion)!;
}

async function currentVersions(db: Database, rows: Secret[]) {
  const live = rows.filter((r) => r.version > 0);
  if (!live.length) return new Map<string, Version>();
  const found = await db
    .select()
    .from(secretVersions)
    .where(
      inArray(
        secretVersions.secretId,
        live.map((r) => r.id),
      ),
    );
  const wanted = new Map(live.map((r) => [r.id, r.version]));
  return new Map(found.filter((v) => wanted.get(v.secretId) === v.version).map((v) => [v.secretId, v]));
}

export async function readValues(db: Database, { ctx, project, environment, access }: Scope) {
  requireAccess(access, "read", environment.name);
  const rows = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.environmentId, environment.id), isNull(secrets.deletedAt)))
    .orderBy(asc(secrets.key));
  const versions = await currentVersions(db, rows);
  const keyOf = await keyFor(db, project.id, [...versions.values()]);
  const values: Record<string, string> = {};
  for (const row of rows) {
    const version = versions.get(row.id);
    values[row.key] = version ? decryptVersion(keyOf(version), environment.id, version) : "";
  }
  if (rows.length) {
    await recordOncePer(db, ctx, 10, {
      action: "read",
      projectId: project.id,
      environmentId: environment.id,
      detail: { count: rows.length, project: project.name, environment: environment.name },
    });
  }
  return values;
}

function validate(changes: ChangeInput[]) {
  if (!changes.length) throw invalid("There are no changes to save");
  if (changes.length > 1000) throw invalid("Save at most 1000 changes at a time");
  const seen = new Set<string>();
  for (const c of changes) {
    for (const key of [c.key, c.newKey].filter((k): k is string => !!k)) {
      const problem = keyProblem(key);
      if (problem) throw invalid(`${key || "A key"}: ${problem}`, { key });
    }
    if (seen.has(c.key)) throw invalid(`${c.key} appears twice in one save`, { key: c.key });
    seen.add(c.key);
    if (c.value !== undefined && c.value.length > VALUE_MAX) {
      throw invalid(`${c.key} is longer than ${VALUE_MAX / 1024} KB`, { key: c.key });
    }
    if (c.note !== undefined && c.note.length > 500)
      throw invalid(`The note on ${c.key} is longer than 500 characters`);
  }
  const renamed = changes.filter((c) => c.newKey && c.newKey !== c.key).map((c) => c.newKey!);
  for (const key of renamed)
    if (seen.has(key)) throw invalid(`${key} is renamed and changed in one save. Save them separately`);
}

function auditAction(ops: ChangeOp[], source: ApplyInput["source"]): AuditAction {
  if (source === "import") return "import";
  if (source === "rotate") return "rotate";
  if (source === "restore") return "restore";
  if (ops.every((o) => o.op === "add")) return "create";
  if (ops.every((o) => o.op === "delete")) return "delete";
  return "update";
}

export async function applyChanges(db: Database, scope: Scope, input: ApplyInput) {
  const { ctx, project, environment } = scope;
  requireAccess(scope.access, "write", environment.name);
  validate(input.changes);
  if (environment.protected && input.confirm !== environment.name) {
    throw confirmRequired(`${environment.name} is protected. Type its name to save changes`);
  }
  const key = await projectKey(db, project.id);
  const now = new Date();
  const by = userId(ctx);

  return db.transaction(async (tx) => {
    const rows = await tx.select().from(secrets).where(eq(secrets.environmentId, environment.id)).for("update");
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const live = (k: string) => {
      const row = byKey.get(k);
      return row && !row.deletedAt ? row : undefined;
    };

    const stale: string[] = [];
    for (const c of input.changes) {
      const row = live(c.key);
      if (c.op === "add" && row) stale.push(c.key);
      else if (c.op !== "add" && !row) stale.push(c.key);
      else if (c.baseVersion != null && row && row.version !== c.baseVersion) stale.push(c.key);
      if (c.newKey && c.newKey !== c.key && live(c.newKey)) stale.push(c.newKey);
    }
    if (stale.length) {
      throw conflict(
        `${list(stale)} changed since you started editing. Reload to see the latest values, then save again`,
        {
          keys: stale,
        },
      );
    }

    const [changeSet] = await tx
      .insert(changeSets)
      .values({
        environmentId: environment.id,
        ...actorColumns(ctx),
        message: input.message ?? "",
        revertsId: input.revertsId ?? null,
      })
      .returning({ id: changeSets.id });
    const changeSetId = changeSet!.id;
    const versions = await currentVersions(tx, rows);

    const writeVersion = async (row: Secret, value: string, summary: string) => {
      const version = row.version + 1;
      const sealed = key.encrypt(value, { environmentId: environment.id, secretId: row.id, version });
      await tx.insert(secretVersions).values({
        secretId: row.id,
        version,
        changeSetId,
        keyVersion: key.version,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        fingerprint: key.fingerprint(value),
        ...describeValue(value),
        summary,
        createdBy: by,
      });
      return version;
    };

    const ops: ChangeOp[] = [];
    for (const c of input.changes) {
      const existing = byKey.get(c.key);
      if (c.op === "add") {
        let row = existing;
        if (!row) {
          [row] = await tx
            .insert(secrets)
            .values({ environmentId: environment.id, key: c.key, createdBy: by, updatedBy: by, version: 0 })
            .returning();
        }
        const version = await writeVersion(row!, c.value ?? "", c.summary ?? (existing ? "Restored" : "Created"));
        await tx
          .update(secrets)
          .set({
            version,
            deletedAt: null,
            note: c.note ?? (existing ? existing.note : ""),
            sensitive: c.sensitive ?? (existing ? existing.sensitive : true),
            updatedBy: by,
            updatedAt: now,
            ...(c.rotated ? { lastRotatedAt: now } : {}),
          })
          .where(eq(secrets.id, row!.id));
        ops.push({
          secretId: row!.id,
          key: c.key,
          op: "add",
          fromVersion: existing ? existing.version : null,
          toVersion: version,
          ...(existing ? { wasDeleted: true } : {}),
        });
        continue;
      }

      const row = existing!;
      if (c.op === "delete") {
        await tx.update(secrets).set({ deletedAt: now, updatedBy: by, updatedAt: now }).where(eq(secrets.id, row.id));
        ops.push({ secretId: row.id, key: row.key, op: "delete", fromVersion: row.version, toVersion: null });
        continue;
      }

      const renamed = c.newKey && c.newKey !== row.key ? c.newKey : null;
      if (renamed) {
        const buried = byKey.get(renamed);
        if (buried?.deletedAt) await tx.delete(secrets).where(eq(secrets.id, buried.id));
      }
      const current = versions.get(row.id);
      const changedValue =
        c.value !== undefined && (c.rotated || !current || current.fingerprint !== key.fingerprint(c.value));
      const summary =
        c.summary ?? (c.rotated ? "Rotated" : renamed && !changedValue ? `Renamed from ${row.key}` : "Edited value");
      const version = changedValue ? await writeVersion(row, c.value!, summary) : row.version;
      await tx
        .update(secrets)
        .set({
          key: renamed ?? row.key,
          version,
          ...(c.note !== undefined ? { note: c.note } : {}),
          ...(c.sensitive !== undefined ? { sensitive: c.sensitive } : {}),
          ...(c.rotated ? { lastRotatedAt: now } : {}),
          updatedBy: by,
          updatedAt: now,
        })
        .where(eq(secrets.id, row.id));
      ops.push({
        secretId: row.id,
        key: renamed ?? row.key,
        op: "edit",
        fromVersion: row.version,
        toVersion: version,
        ...(renamed ? { previousKey: row.key } : {}),
      });
    }

    await tx.update(changeSets).set({ ops }).where(eq(changeSets.id, changeSetId));
    const keysOf = (op: ChangeOp["op"]) => ops.filter((o) => o.op === op).map((o) => o.key);
    await record(tx, ctx, {
      action: auditAction(ops, input.source),
      projectId: project.id,
      environmentId: environment.id,
      keys: ops.map((o) => o.key),
      changeSetId,
      detail: {
        project: project.name,
        environment: environment.name,
        added: keysOf("add"),
        edited: keysOf("edit"),
        deleted: keysOf("delete"),
        renamed: ops.filter((o) => o.previousKey).map((o) => ({ from: o.previousKey, to: o.key })),
        ...(input.message ? { message: input.message } : {}),
      },
    });
    return { changeSetId, ops };
  });
}

export async function revertChangeSet(db: Database, scope: Scope, changeSetId: string, confirm?: string) {
  const { project, environment } = scope;
  const [changeSet] = await db
    .select()
    .from(changeSets)
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.environmentId, environment.id)));
  if (!changeSet) throw notFound("Change");
  const ids = changeSet.ops.map((o) => o.secretId);
  const rows = ids.length ? await db.select().from(secrets).where(inArray(secrets.id, ids)) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const wanted = changeSet.ops.filter((o) => o.fromVersion).map((o) => ({ id: o.secretId, version: o.fromVersion! }));
  const old = wanted.length
    ? await db
        .select()
        .from(secretVersions)
        .where(
          inArray(
            secretVersions.secretId,
            wanted.map((w) => w.id),
          ),
        )
    : [];
  const oldOf = new Map(
    old.filter((v) => wanted.some((w) => w.id === v.secretId && w.version === v.version)).map((v) => [v.secretId, v]),
  );
  const keyOf = await keyFor(db, project.id, [...oldOf.values()]);
  const valueAt = (secretId: string) => {
    const v = oldOf.get(secretId);
    return v ? decryptVersion(keyOf(v), environment.id, v) : "";
  };

  const changes: ChangeInput[] = [];
  for (const op of changeSet.ops) {
    const row = byId.get(op.secretId);
    if (!row) continue;
    if (op.op === "add") {
      if (!row.deletedAt) changes.push({ op: "delete", key: row.key, baseVersion: row.version });
    } else if (op.op === "delete") {
      if (row.deletedAt) changes.push({ op: "add", key: row.key, value: valueAt(row.id), summary: "Restored" });
    } else {
      const change: ChangeInput = { op: "edit", key: row.key, baseVersion: op.toVersion };
      if (op.previousKey) change.newKey = op.previousKey;
      if (op.toVersion !== op.fromVersion) {
        change.value = valueAt(row.id);
        change.summary = `Restored v${op.fromVersion}`;
      }
      if (change.newKey || change.value !== undefined) changes.push(change);
    }
  }
  if (!changes.length) throw invalid("Those changes were already undone");
  return applyChanges(db, scope, { changes, confirm, source: "restore", revertsId: changeSet.id, message: "Undo" });
}

export async function listVersions(db: Database, scope: Scope, secretId: string, withValues: boolean) {
  const [row] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.environmentId, scope.environment.id)));
  if (!row) throw notFound("Secret");
  if (withValues) requireAccess(scope.access, "read", scope.environment.name);
  const versions = await db
    .select({ version: secretVersions, byName: users.name, byEmail: users.email })
    .from(secretVersions)
    .leftJoin(users, eq(users.id, secretVersions.createdBy))
    .where(eq(secretVersions.secretId, row.id))
    .orderBy(desc(secretVersions.version));
  const keyOf = withValues
    ? await keyFor(
        db,
        scope.project.id,
        versions.map((v) => v.version),
      )
    : null;
  if (withValues) {
    await record(db, scope.ctx, {
      action: "reveal",
      projectId: scope.project.id,
      environmentId: scope.environment.id,
      keys: [row.key],
      detail: { history: true, project: scope.project.name, environment: scope.environment.name },
    });
  }
  return versions.map(({ version: v, byName, byEmail }) => ({
    version: v.version,
    summary: v.summary,
    changeSetId: v.changeSetId,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    createdByName: byName || byEmail || null,
    fingerprint: v.fingerprint,
    length: v.valueLength,
    value: keyOf ? decryptVersion(keyOf(v), scope.environment.id, v) : undefined,
  }));
}

export async function setRotation(db: Database, scope: Scope, secretId: string, days: number | null) {
  requireAccess(scope.access, "write", scope.environment.name);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    throw invalid("Rotation must be between 1 and 3650 days");
  }
  const [row] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.environmentId, scope.environment.id), isNull(secrets.deletedAt)));
  if (!row) throw notFound("Secret");
  await db
    .update(secrets)
    .set({ rotateEveryDays: days, lastRotatedAt: days ? (row.lastRotatedAt ?? row.updatedAt) : row.lastRotatedAt })
    .where(eq(secrets.id, row.id));
  await record(db, scope.ctx, {
    action: "update",
    projectId: scope.project.id,
    environmentId: scope.environment.id,
    keys: [row.key],
    detail: {
      rotation: days,
      project: scope.project.name,
      environment: scope.environment.name,
      message: days
        ? `Set ${row.key} to rotate every ${n(days, "day")}`
        : `Turned off rotation reminders for ${row.key}`,
    },
  });
}

export async function copyEnvironmentSecrets(
  db: Database,
  ctx: Context,
  project: Project,
  from: Environment,
  to: Environment,
) {
  const values = await readValues(db, { ctx, project, environment: from, access: "read" });
  const rows = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.environmentId, from.id), isNull(secrets.deletedAt)));
  if (!rows.length) return null;
  return applyChanges(
    db,
    { ctx, project, environment: to, access: "write" },
    {
      changes: rows.map((r) => ({
        op: "add",
        key: r.key,
        value: values[r.key] ?? "",
        note: r.note,
        sensitive: r.sensitive,
      })),
      confirm: to.name,
      source: "copy",
      message: `Cloned from ${from.name}`,
    },
  );
}
