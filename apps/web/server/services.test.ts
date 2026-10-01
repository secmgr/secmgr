import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { openShare as openSealedShare } from "@secmgr/crypto";
import { auditEvents, type Database, secretVersions } from "@secmgr/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { type Context, loadEnvironment, type UserActor } from "./context.ts";
import { ApiError } from "./errors.ts";
import { listActivity } from "./services/activity.ts";
import { createEnvironment, setEnvironmentAccess, updateEnvironment } from "./services/environments.ts";
import { dismissInsight, restoreInsight } from "./services/preferences.ts";
import { createProject } from "./services/projects.ts";
import { applyChanges, listVersions, readValues, revertChangeSet } from "./services/secrets.ts";
import { createShare, openShare } from "./services/shares.ts";
import { buildSnapshot } from "./services/snapshot.ts";
import { createToken, revokeToken, rotateToken, tokenActor } from "./services/tokens.ts";
import { addMember, closeDatabase, contextFor, createUser, createWorkspace, testDatabase } from "./testing.ts";

const rejectsWith = (promise: Promise<unknown>, code: string, message?: RegExp) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    assert.equal(error.code, code);
    if (message) assert.match(error.message, message);
    return true;
  });

describe("services against Postgres", {
  skip: process.env.TEST_DATABASE_URL ? false : "TEST_DATABASE_URL is not set",
}, () => {
  let db: Database;
  let owner: UserActor;
  let ws: { id: string; slug: string };
  let ctx: Context;
  let envs: Record<string, string>;
  let projectId: string;

  const scope = async (name: string, actor: UserActor = owner) => loadEnvironment(db, actor, envs[name]!, {});

  before(async () => {
    db = (await testDatabase())!;
    owner = await createUser(db, "Maya Chen");
    ws = await createWorkspace(db, owner);
    ctx = await contextFor(db, owner, ws.slug);
    const created = await createProject(db, ctx, {
      name: "lumen-api",
      repo: "https://github.com/lumen-labs/lumen-api.git",
    });
    projectId = created.project.id;
    envs = Object.fromEntries(created.environments.map((e) => [e.name, e.id]));
  });

  after(() => closeDatabase(db));

  test("a new project gets development, staging and a protected production", async () => {
    assert.deepEqual(Object.keys(envs), ["development", "staging", "production"]);
    const production = await scope("production");
    assert.equal(production.environment.protected, true);
    assert.equal(production.project.repo, "lumen-labs/lumen-api");
    await rejectsWith(createProject(db, ctx, { name: "lumen-api" }), "conflict", /already exists/);
    await rejectsWith(createProject(db, ctx, { name: "Lumen API" }), "invalid", /lowercase/);
    await rejectsWith(createProject(db, ctx, { name: "settings" }), "invalid", /reserved/);
  });

  test("saves values encrypted and reads them back", async () => {
    const staging = await scope("staging");
    const { ops } = await applyChanges(db, staging, {
      changes: [
        { op: "add", key: "DATABASE_URL", value: "postgres://lumen:pw@db.internal:5432/lumen" },
        { op: "add", key: "STRIPE_SECRET_KEY", value: "sk_live_51NxYz" },
        { op: "add", key: "STRIPE_WEBHOOK_URL", value: `\${API_BASE_URL}/webhooks/stripe`, sensitive: false },
      ],
    });
    assert.equal(ops.length, 3);
    const stored = await db.select().from(secretVersions);
    assert.ok(stored.every((v) => !v.ciphertext.toString("utf8").includes("postgres://")));
    assert.deepEqual(await readValues(db, staging), {
      DATABASE_URL: "postgres://lumen:pw@db.internal:5432/lumen",
      STRIPE_SECRET_KEY: "sk_live_51NxYz",
      STRIPE_WEBHOOK_URL: `\${API_BASE_URL}/webhooks/stripe`,
    });
    const snapshot = await buildSnapshot(db, ctx);
    const stripe = snapshot.secrets.find((s) => s.key === "STRIPE_SECRET_KEY")!;
    assert.equal(stripe.looksLive, true);
    assert.equal(stripe.length, "sk_live_51NxYz".length);
    assert.ok(!JSON.stringify(snapshot).includes("sk_live_51NxYz"));
    const webhook = snapshot.secrets.find((s) => s.key === "STRIPE_WEBHOOK_URL")!;
    assert.deepEqual(webhook.refs, ["API_BASE_URL"]);
    assert.equal(webhook.sensitive, false);
  });

  test("only saves a new version when the value changes", async () => {
    const staging = await scope("staging");
    const before = (await buildSnapshot(db, ctx)).secrets.find((s) => s.key === "DATABASE_URL")!;
    await applyChanges(db, staging, {
      changes: [
        { op: "edit", key: "DATABASE_URL", value: "postgres://lumen:pw@db.internal:5432/lumen", note: "Primary" },
      ],
    });
    const after = (await buildSnapshot(db, ctx)).secrets.find((s) => s.key === "DATABASE_URL")!;
    assert.equal(after.version, before.version);
    assert.equal(after.note, "Primary");
  });

  test("refuses to overwrite a value someone else changed", async () => {
    const staging = await scope("staging");
    const current = (await buildSnapshot(db, ctx)).secrets.find((s) => s.key === "DATABASE_URL")!;
    await applyChanges(db, staging, {
      changes: [{ op: "edit", key: "DATABASE_URL", value: "v2", baseVersion: current.version }],
    });
    await rejectsWith(
      applyChanges(db, staging, {
        changes: [{ op: "edit", key: "DATABASE_URL", value: "v3", baseVersion: current.version }],
      }),
      "conflict",
      /DATABASE_URL changed since you started editing/,
    );
    await rejectsWith(
      applyChanges(db, staging, { changes: [{ op: "add", key: "DATABASE_URL", value: "x" }] }),
      "conflict",
    );
    await rejectsWith(applyChanges(db, staging, { changes: [{ op: "edit", key: "NOPE", value: "x" }] }), "conflict");
    await rejectsWith(
      applyChanges(db, staging, { changes: [{ op: "add", key: "1BAD", value: "x" }] }),
      "invalid",
      /cannot start with a digit/,
    );
  });

  test("asks for the environment name before saving to production", async () => {
    const production = await scope("production");
    await rejectsWith(
      applyChanges(db, production, { changes: [{ op: "add", key: "LOG_LEVEL", value: "warn" }] }),
      "confirm_required",
    );
    await applyChanges(db, production, {
      changes: [{ op: "add", key: "LOG_LEVEL", value: "warn" }],
      confirm: "production",
    });
    assert.deepEqual(await readValues(db, production), { LOG_LEVEL: "warn" });
  });

  test("keeps history readable after a rename and undoes the rename", async () => {
    const staging = await scope("staging");
    const { changeSetId } = await applyChanges(db, staging, {
      changes: [{ op: "edit", key: "DATABASE_URL", newKey: "PRIMARY_DATABASE_URL", value: "v4" }],
    });
    const snapshot = await buildSnapshot(db, ctx);
    const renamed = snapshot.secrets.find((s) => s.key === "PRIMARY_DATABASE_URL")!;
    assert.ok(!snapshot.secrets.some((s) => s.key === "DATABASE_URL" && s.envId === envs.staging));
    const history = await listVersions(db, staging, renamed.id, true);
    assert.deepEqual(
      history.map((v) => v.value),
      ["v4", "v2", "postgres://lumen:pw@db.internal:5432/lumen"],
    );
    await revertChangeSet(db, staging, changeSetId);
    assert.equal((await readValues(db, staging)).DATABASE_URL, "v2");
  });

  test("undoes a delete and brings the value back", async () => {
    const staging = await scope("staging");
    const { changeSetId } = await applyChanges(db, staging, { changes: [{ op: "delete", key: "STRIPE_SECRET_KEY" }] });
    assert.equal((await readValues(db, staging)).STRIPE_SECRET_KEY, undefined);
    await revertChangeSet(db, staging, changeSetId);
    assert.equal((await readValues(db, staging)).STRIPE_SECRET_KEY, "sk_live_51NxYz");
    await rejectsWith(revertChangeSet(db, staging, changeSetId), "invalid", /already undone/);
  });

  test("clones an environment with every value", async () => {
    const env = await createEnvironment(db, ctx, (await scope("staging")).project, {
      name: "preview",
      color: "violet",
      cloneFrom: envs.staging,
    });
    const preview = await loadEnvironment(db, owner, env.id, {});
    assert.deepEqual(await readValues(db, preview), await readValues(db, await scope("staging")));
    await rejectsWith(createEnvironment(db, ctx, preview.project, { name: "preview" }), "conflict");
  });

  test("viewers read values outside production and only key names inside", async () => {
    const viewer = await createUser(db, "Aiko Tanaka");
    await addMember(db, ws.id, viewer, "viewer");
    const staging = await scope("staging", viewer);
    assert.equal(staging.access, "read");
    assert.equal((await readValues(db, staging)).STRIPE_SECRET_KEY, "sk_live_51NxYz");
    await rejectsWith(
      applyChanges(db, staging, { changes: [{ op: "add", key: "X", value: "1" }] }),
      "forbidden",
      /not change it/,
    );
    const production = await scope("production", viewer);
    assert.equal(production.access, "meta");
    await rejectsWith(readValues(db, production), "forbidden", /keys in production but not their values/);
    const viewerCtx = await contextFor(db, viewer, ws.slug);
    const snapshot = await buildSnapshot(db, viewerCtx);
    assert.equal(snapshot.environments.find((e) => e.id === envs.production)!.access, "meta");
    await rejectsWith(createProject(db, viewerCtx, { name: "docs-site" }), "forbidden", /owners and admins/);
  });

  test("an access override can hide production from a developer", async () => {
    const dev = await createUser(db, "Leo Martins");
    const memberId = await addMember(db, ws.id, dev, "developer");
    const production = await scope("production");
    await setEnvironmentAccess(db, ctx, production.project, production.environment, memberId, "none");
    await rejectsWith(scope("production", dev), "not_found");
    const snapshot = await buildSnapshot(db, await contextFor(db, dev, ws.slug));
    assert.ok(!snapshot.environments.some((e) => e.id === envs.production));
    assert.ok(!snapshot.secrets.some((s) => s.envId === envs.production));
    await setEnvironmentAccess(db, ctx, production.project, production.environment, memberId, null);
    assert.equal((await scope("production", dev)).access, "write");
  });

  test("service tokens reach only their environment and stop working when revoked", async () => {
    const { secret, token } = await createToken(db, ctx, {
      name: "ci-deploy",
      environmentId: envs.production!,
      access: "read",
    });
    assert.match(secret, /^smg_live_/);
    const actor = (await tokenActor(db, secret))!;
    assert.equal(actor.name, "ci-deploy");
    const production = await loadEnvironment(db, actor, envs.production!, {});
    assert.deepEqual(await readValues(db, production), { LOG_LEVEL: "warn" });
    await rejectsWith(
      applyChanges(db, production, { changes: [{ op: "add", key: "X", value: "1" }], confirm: "production" }),
      "forbidden",
    );
    await rejectsWith(loadEnvironment(db, actor, envs.staging!, {}), "not_found");
    assert.equal(await tokenActor(db, `${secret}x`), null);
    await revokeToken(db, ctx, token.id);
    assert.equal(await tokenActor(db, secret), null);
  });

  test("rotating a token keeps its scope and stops the old value", async () => {
    const { secret: first, token } = await createToken(db, ctx, {
      name: "github-actions",
      environmentId: envs.staging!,
      access: "read",
      expiresInDays: 30,
    });
    const { secret: second, token: rotated } = await rotateToken(db, ctx, token.id);
    assert.notEqual(second, first);
    assert.equal(rotated.name, "github-actions");
    assert.equal(rotated.environmentId, envs.staging);
    assert.equal(rotated.access, "read");
    const lifetime = rotated.expiresAt!.getTime() - rotated.createdAt.getTime();
    assert.ok(Math.abs(lifetime - 30 * 86_400_000) < 5_000);
    assert.equal(await tokenActor(db, first), null);
    assert.equal((await tokenActor(db, second))!.tokenId, rotated.id);
    await rejectsWith(rotateToken(db, ctx, token.id), "not_found");
    const tokens = (await buildSnapshot(db, ctx)).tokens.filter((t) => t.name === "github-actions");
    assert.deepEqual(
      tokens.map((t) => t.id),
      [rotated.id],
    );
  });

  test("a snoozed insight comes back, a dismissed one stays hidden", async () => {
    await dismissInsight(db, ctx, "missing:demo:KEY_A");
    await dismissInsight(db, ctx, "missing:demo:KEY_B", 7);
    let dismissed = (await buildSnapshot(db, ctx)).dismissedInsights;
    assert.ok(dismissed.includes("missing:demo:KEY_A"));
    assert.ok(dismissed.includes("missing:demo:KEY_B"));
    await db.execute(
      sql`update dismissed_insights set snoozed_until = now() - interval '1 minute' where insight_id = 'missing:demo:KEY_B'`,
    );
    dismissed = (await buildSnapshot(db, ctx)).dismissedInsights;
    assert.ok(dismissed.includes("missing:demo:KEY_A"));
    assert.ok(!dismissed.includes("missing:demo:KEY_B"));
    await rejectsWith(dismissInsight(db, ctx, "missing:demo:KEY_C", 0), "invalid", /365 days/);
    await restoreInsight(db, ctx, "missing:demo:KEY_A");
    assert.ok(!(await buildSnapshot(db, ctx)).dismissedInsights.includes("missing:demo:KEY_A"));
  });

  test("a share link opens once, then is gone", async () => {
    const staging = await scope("staging");
    const secretId = (await buildSnapshot(db, ctx)).secrets.find(
      (s) => s.key === "STRIPE_SECRET_KEY" && s.envId === envs.staging,
    )!.id;
    const link = await createShare(db, staging, { secretId }, "https://app.secmgr.xyz");
    const key = link.url.split("#")[1]!;
    assert.match(link.url, /^https:\/\/app\.secmgr\.xyz\/s\/[0-9a-f-]{36}#/);
    const opened = await openShare(db, link.id);
    assert.equal(
      openSealedShare(key, {
        ciphertext: Buffer.from(opened.ciphertext, "base64"),
        nonce: Buffer.from(opened.nonce, "base64"),
      }),
      "sk_live_51NxYz",
    );
    await rejectsWith(openShare(db, link.id), "gone");
  });

  test("protecting an environment needs its name typed", async () => {
    const preview = (await buildSnapshot(db, ctx)).environments.find((e) => e.name === "preview")!;
    const scoped = await loadEnvironment(db, owner, preview.id, {});
    await rejectsWith(
      updateEnvironment(db, ctx, scoped.project, scoped.environment, { protected: true }),
      "confirm_required",
    );
    const updated = await updateEnvironment(db, ctx, scoped.project, scoped.environment, {
      protected: true,
      confirm: "preview",
    });
    assert.equal(updated.protected, true);
  });

  test("the activity log names who did what, newest first", async () => {
    const { entries } = await listActivity(db, ctx, { projectId });
    assert.ok(entries.length > 5);
    assert.equal(entries[0]!.action, "protect");
    assert.equal(entries.at(-1)!.action, "create-project");
    assert.ok(entries.every((e) => e.actorName));
    const token = entries.find((e) => e.actorKind === "token");
    assert.equal(token?.actorName, "ci-deploy");
    const [read] = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.organizationId, ws.id), eq(auditEvents.action, "read")))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1);
    assert.equal(read?.ipAddress ?? "127.0.0.1", "127.0.0.1");
  });
});
