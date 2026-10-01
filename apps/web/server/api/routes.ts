import { changeSets, members, secretVersions } from "@secmgr/db";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { record } from "../audit.ts";
import {
  type Actor,
  canRead,
  environmentAccessMap,
  isRole,
  isUuid,
  loadEnvironment,
  loadProject,
  requireManage,
  requireUser,
  workspaceContext,
} from "../context.ts";
import { forbidden, invalid, notFound } from "../errors.ts";
import { environmentNames, listActivity } from "../services/activity.ts";
import {
  createEnvironment,
  deleteEnvironment,
  reorderEnvironments,
  setEnvironmentAccess,
  updateEnvironment,
} from "../services/environments.ts";
import { dismissInsight, getPreferences, restoreInsight, setPreferences } from "../services/preferences.ts";
import { createProject, deleteProject, setStar, updateProject } from "../services/projects.ts";
import { applyChanges, listVersions, readValues, revertChangeSet, setRotation } from "../services/secrets.ts";
import { createShare, openShare, peekShare, revokeShare } from "../services/shares.ts";
import { buildSnapshot, listWorkspaces } from "../services/snapshot.ts";
import { createToken, revokeToken, rotateToken } from "../services/tokens.ts";
import { type Call, Router } from "./router.ts";

export type MemberApi = {
  invite(
    req: Request,
    input: { organizationId: string; email: string; role: string; resend?: boolean },
  ): Promise<{ id: string }>;
  cancelInvite(req: Request, invitationId: string): Promise<void>;
  setRole(req: Request, input: { organizationId: string; memberId: string; role: string }): Promise<void>;
  remove(req: Request, input: { organizationId: string; memberId: string }): Promise<void>;
  updateWorkspace(req: Request, input: { organizationId: string; name?: string; slug?: string }): Promise<void>;
  deleteWorkspace(req: Request, organizationId: string): Promise<void>;
};

const color = z.enum(["gray", "blue", "green", "teal", "amber", "orange", "rose", "violet"]);
const role = z.string().refine(isRole, "Role is owner, admin, developer or viewer");

const change = z.object({
  op: z.enum(["add", "edit", "delete"]),
  key: z.string(),
  newKey: z.string().optional(),
  value: z.string().optional(),
  note: z.string().optional(),
  sensitive: z.boolean().optional(),
  baseVersion: z.number().int().nullable().optional(),
  rotated: z.boolean().optional(),
  summary: z.string().max(120).optional(),
});

const confirmBody = z.object({ confirm: z.string().optional() });

async function workspace(call: Call & { actor: Actor }) {
  return workspaceContext(call.db, call.actor, call.params.ws!, call.request);
}

async function environment(call: Call & { actor: Actor }) {
  return loadEnvironment(call.db, call.actor, call.params.env!, call.request);
}

export function buildRouter({ members: memberApi, appUrl }: { members: MemberApi; appUrl: string }) {
  const router = new Router();

  router.get("/workspaces", async ({ db, actor }) => ({
    workspaces: await listWorkspaces(db, requireUserActor(actor)),
  }));

  router.get("/workspaces/:ws/snapshot", async (call) => buildSnapshot(call.db, await workspace(call)));

  router.patch("/workspaces/:ws", async (call) => {
    const ctx = await workspace(call);
    requireManage(ctx, "rename the workspace");
    const input = await call.body(
      z.object({ name: z.string().trim().min(1).max(60).optional(), slug: z.string().optional() }),
    );
    await memberApi.updateWorkspace(call.req, { organizationId: ctx.workspace.id, ...input });
    await record(call.db, ctx, { action: "workspace", target: input.name ?? ctx.workspace.name, detail: input });
    return { ok: true };
  });

  router.delete("/workspaces/:ws", async (call) => {
    const ctx = await workspace(call);
    if (ctx.role !== "owner") throw forbidden("Only owners can delete the workspace");
    const input = await call.body(z.object({ confirm: z.string() }));
    if (input.confirm !== ctx.workspace.slug)
      throw invalid(`Type ${ctx.workspace.slug} to delete the workspace`, { field: "confirm" });
    await memberApi.deleteWorkspace(call.req, ctx.workspace.id);
    return { ok: true };
  });

  router.get("/workspaces/:ws/activity", async (call) => {
    const ctx = await workspace(call);
    const q = call.query;
    const accessMap = await environmentAccessMap(call.db, ctx);
    const snapshotEnvs = new Set([...accessMap].filter(([, a]) => a !== "none").map(([id]) => id));
    const result = await listActivity(call.db, ctx, {
      projectId: q.get("project") ?? undefined,
      environmentId: q.get("env") ?? undefined,
      actorId: q.get("actor") ?? undefined,
      action: q.get("action") ?? undefined,
      before: q.get("before") ?? undefined,
      limit: q.has("limit") ? Number(q.get("limit")) : undefined,
      visibleEnvironments: snapshotEnvs,
    });
    const names = await environmentNames(call.db, [
      ...new Set(result.entries.map((e) => e.envId).filter((id): id is string => !!id)),
    ]);
    return { ...result, environments: Object.fromEntries(names) };
  });

  router.post("/workspaces/:ws/insights/:id/dismiss", async (call) => {
    const input = await call.body(z.object({ snoozeDays: z.number().int().min(1).max(365).nullish() }));
    await dismissInsight(call.db, await workspace(call), call.params.id!, input.snoozeDays);
  });
  router.delete("/workspaces/:ws/insights/:id/dismiss", async (call) => {
    await restoreInsight(call.db, await workspace(call), call.params.id!);
  });

  router.post("/workspaces/:ws/projects", async (call) => {
    const ctx = await workspace(call);
    const input = await call.body(
      z.object({
        name: z.string().trim(),
        description: z.string().optional(),
        repo: z.string().nullable().optional(),
        environments: z
          .array(z.object({ name: z.string().trim(), color: color.optional(), protected: z.boolean().optional() }))
          .max(12)
          .optional(),
      }),
    );
    const { project, environments: envs } = await createProject(call.db, ctx, input);
    return {
      project: { id: project.id, name: project.name },
      environments: envs.map((e) => ({ id: e.id, name: e.name })),
    };
  });

  router.post("/workspaces/:ws/tokens", async (call) => {
    const ctx = await workspace(call);
    const input = await call.body(
      z.object({
        name: z.string(),
        environmentId: z.string(),
        access: z.enum(["read", "write"]),
        expiresInDays: z.number().int().nullable().optional(),
      }),
    );
    const { token, secret } = await createToken(call.db, ctx, input);
    return { token: { id: token.id, name: token.name, prefix: token.prefix, suffix: token.suffix }, secret };
  });

  router.post("/workspaces/:ws/tokens/:id/rotate", async (call) => {
    const { token, secret } = await rotateToken(call.db, await workspace(call), call.params.id!);
    return { token: { id: token.id, name: token.name, prefix: token.prefix, suffix: token.suffix }, secret };
  });

  router.delete("/workspaces/:ws/tokens/:id", async (call) => {
    await revokeToken(call.db, await workspace(call), call.params.id!);
  });

  router.post("/workspaces/:ws/invitations", async (call) => {
    const ctx = await workspace(call);
    requireManage(ctx, "invite members");
    const input = await call.body(
      z.object({ email: z.email("Enter an email address"), role, resend: z.boolean().optional() }),
    );
    if (input.role === "owner" && ctx.role !== "owner") throw forbidden("Only owners can invite another owner");
    const email = input.email.toLowerCase();
    const { id } = await memberApi.invite(call.req, {
      organizationId: ctx.workspace.id,
      email,
      role: input.role,
      resend: input.resend,
    });
    await record(call.db, ctx, {
      action: "invite",
      target: email,
      detail: { role: input.role, resent: !!input.resend },
    });
    return { id };
  });

  router.delete("/workspaces/:ws/invitations/:id", async (call) => {
    const ctx = await workspace(call);
    requireManage(ctx, "cancel invitations");
    await memberApi.cancelInvite(call.req, call.params.id!);
  });

  router.patch("/workspaces/:ws/members/:memberId", async (call) => {
    const ctx = await workspace(call);
    requireManage(ctx, "change roles");
    const input = await call.body(z.object({ role }));
    const target = await memberOf(call, ctx.workspace.id);
    if ((input.role === "owner" || target.role === "owner") && ctx.role !== "owner")
      throw forbidden("Only owners can change an owner");
    await memberApi.setRole(call.req, { organizationId: ctx.workspace.id, memberId: target.id, role: input.role });
    await record(call.db, ctx, {
      action: "member",
      target: target.userId,
      detail: { role: input.role, from: target.role },
    });
  });

  router.delete("/workspaces/:ws/members/:memberId", async (call) => {
    const ctx = await workspace(call);
    const target = await memberOf(call, ctx.workspace.id);
    const actor = requireUser(ctx);
    if (target.userId !== actor.userId) requireManage(ctx, "remove members");
    if (target.role === "owner" && ctx.role !== "owner") throw forbidden("Only owners can remove an owner");
    await memberApi.remove(call.req, { organizationId: ctx.workspace.id, memberId: target.id });
    await record(call.db, ctx, { action: "member", target: target.userId, detail: { removed: true } });
  });

  router.patch("/projects/:project", async (call) => {
    const { ctx, project } = await loadProject(call.db, call.actor, call.params.project!, call.request);
    const input = await call.body(
      z.object({
        name: z.string().trim().optional(),
        description: z.string().optional(),
        repo: z.string().nullable().optional(),
        archived: z.boolean().optional(),
      }),
    );
    const updated = await updateProject(call.db, ctx, project, input);
    return { project: { id: updated.id, name: updated.name } };
  });

  router.delete("/projects/:project", async (call) => {
    const { ctx, project } = await loadProject(call.db, call.actor, call.params.project!, call.request);
    const { confirm } = await call.body(confirmBody);
    await deleteProject(call.db, ctx, project, confirm);
  });

  router.put("/projects/:project/star", async (call) => {
    const { ctx, project } = await loadProject(call.db, call.actor, call.params.project!, call.request);
    await setStar(call.db, ctx, project, true);
  });
  router.delete("/projects/:project/star", async (call) => {
    const { ctx, project } = await loadProject(call.db, call.actor, call.params.project!, call.request);
    await setStar(call.db, ctx, project, false);
  });

  router.post("/projects/:project/environments", async (call) => {
    const { ctx, project } = await loadProject(call.db, call.actor, call.params.project!, call.request);
    const input = await call.body(
      z.object({
        name: z.string().trim(),
        color: color.optional(),
        protected: z.boolean().optional(),
        cloneFrom: z.string().nullable().optional(),
      }),
    );
    const env = await createEnvironment(call.db, ctx, project, input);
    return { environment: { id: env.id, name: env.name } };
  });

  router.put("/projects/:project/environment-order", async (call) => {
    const { ctx, project } = await loadProject(call.db, call.actor, call.params.project!, call.request);
    const { ids } = await call.body(z.object({ ids: z.array(z.string()).max(50) }));
    await reorderEnvironments(call.db, ctx, project, ids);
  });

  router.patch("/environments/:env", async (call) => {
    const { ctx, project, environment: env } = await environment(call);
    const input = await call.body(
      z.object({
        name: z.string().trim().optional(),
        color: color.optional(),
        protected: z.boolean().optional(),
        confirm: z.string().optional(),
      }),
    );
    const updated = await updateEnvironment(call.db, ctx, project, env, input);
    return { environment: { id: updated.id, name: updated.name } };
  });

  router.delete("/environments/:env", async (call) => {
    const { ctx, project, environment: env } = await environment(call);
    const { confirm } = await call.body(confirmBody);
    await deleteEnvironment(call.db, ctx, project, env, confirm);
  });

  router.put("/environments/:env/access/:memberId", async (call) => {
    const { ctx, project, environment: env } = await environment(call);
    const { access } = await call.body(z.object({ access: z.enum(["none", "read", "write"]).nullable() }));
    await setEnvironmentAccess(call.db, ctx, project, env, call.params.memberId!, access);
  });

  router.get("/environments/:env/values", async (call) => ({
    values: await readValues(call.db, await environment(call)),
  }));

  router.post("/environments/:env/changes", async (call) => {
    const scope = await environment(call);
    const input = await call.body(
      z.object({
        changes: z.array(change).min(1).max(1000),
        message: z.string().max(500).optional(),
        confirm: z.string().optional(),
        source: z.enum(["edit", "import", "rotate", "copy"]).optional(),
      }),
    );
    const result = await applyChanges(call.db, scope, input);
    return { changeSetId: result.changeSetId, count: result.ops.length };
  });

  router.get("/environments/:env/change-sets/:id", async (call) => {
    const scope = await environment(call);
    if (!isUuid(call.params.id!)) throw notFound("Change");
    const [cs] = await call.db
      .select()
      .from(changeSets)
      .where(and(eq(changeSets.id, call.params.id!), eq(changeSets.environmentId, scope.environment.id)));
    if (!cs) throw notFound("Change");
    const ids = cs.ops.map((o) => o.secretId);
    const versions = ids.length
      ? await call.db
          .select({
            secretId: secretVersions.secretId,
            version: secretVersions.version,
            fingerprint: secretVersions.fingerprint,
            length: secretVersions.valueLength,
          })
          .from(secretVersions)
          .where(inArray(secretVersions.secretId, ids))
      : [];
    return {
      id: cs.id,
      message: cs.message,
      createdAt: cs.createdAt.toISOString(),
      revertsId: cs.revertsId,
      canRead: canRead(scope.access),
      ops: cs.ops.map((o) => ({
        ...o,
        from: versions.find((v) => v.secretId === o.secretId && v.version === o.fromVersion) ?? null,
        to: versions.find((v) => v.secretId === o.secretId && v.version === o.toVersion) ?? null,
      })),
    };
  });

  router.post("/environments/:env/change-sets/:id/revert", async (call) => {
    const scope = await environment(call);
    if (!isUuid(call.params.id!)) throw notFound("Change");
    const { confirm } = await call.body(confirmBody);
    const result = await revertChangeSet(call.db, scope, call.params.id!, confirm);
    return { changeSetId: result.changeSetId, count: result.ops.length };
  });

  router.get("/environments/:env/secrets/:secret/versions", async (call) => {
    const scope = await environment(call);
    if (!isUuid(call.params.secret!)) throw notFound("Secret");
    return { versions: await listVersions(call.db, scope, call.params.secret!, call.query.get("values") === "1") };
  });

  router.put("/environments/:env/secrets/:secret/rotation", async (call) => {
    const scope = await environment(call);
    if (!isUuid(call.params.secret!)) throw notFound("Secret");
    const { days } = await call.body(z.object({ days: z.number().int().nullable() }));
    await setRotation(call.db, scope, call.params.secret!, days);
  });

  router.post("/environments/:env/secrets/:secret/shares", async (call) => {
    const scope = await environment(call);
    const input = await call.body(
      z.object({ maxViews: z.number().int().optional(), expiresInHours: z.number().int().optional() }),
    );
    return createShare(call.db, scope, { secretId: call.params.secret!, ...input }, appUrl);
  });

  router.post("/environments/:env/events", async (call) => {
    const scope = await environment(call);
    const input = await call.body(
      z.object({
        action: z.enum(["reveal", "copy", "export"]),
        keys: z.array(z.string()).max(1000).default([]),
        detail: z.object({ format: z.string().max(20).optional(), count: z.number().int().optional() }).optional(),
      }),
    );
    if (!canRead(scope.access)) throw forbidden(`You cannot read values in ${scope.environment.name}`);
    await record(call.db, scope.ctx, {
      action: input.action,
      projectId: scope.project.id,
      environmentId: scope.environment.id,
      keys: input.keys,
      detail: { ...input.detail, project: scope.project.name, environment: scope.environment.name },
    });
  });

  router.delete("/workspaces/:ws/shares/:id", async (call) => {
    await revokeShare(call.db, await workspace(call), call.params.id!);
  });

  router.publicGet("/shares/:id", async ({ db, params }) => {
    const link = await peekShare(db, params.id!);
    if (!link) throw notFound("Link");
    return link;
  });

  router.publicPost("/shares/:id/open", async ({ db, params }) => openShare(db, params.id!));

  router.get("/me/preferences", async ({ db, actor }) => getPreferences(db, requireUserActor(actor)));

  router.put("/me/preferences", async (call) => {
    const input = await call.body(
      z.object({
        theme: z.enum(["light", "dark", "system"]).optional(),
        density: z.enum(["comfortable", "compact"]).optional(),
        revealTimeoutSec: z.number().int().optional(),
        clipboardClearSec: z.number().int().optional(),
      }),
    );
    return setPreferences(call.db, requireUserActor(call.actor), input);
  });

  router.get("/secrets", async (call) => {
    if (call.actor.kind !== "token")
      throw invalid("Use a service token for this endpoint, or /environments/:id/values from the dashboard");
    const scope = await loadEnvironment(call.db, call.actor, call.actor.environmentId, call.request);
    const values = await readValues(call.db, scope);
    const format = call.query.get("format") ?? "json";
    if (format === "dotenv") {
      const body = Object.entries(values)
        .map(([k, v]) => `${k}=${/[\s"'#$\\]/.test(v) || v === "" ? JSON.stringify(v) : v}`)
        .join("\n");
      return new Response(`${body}\n`, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return { project: scope.project.name, environment: scope.environment.name, values };
  });

  router.put("/secrets", async (call) => {
    if (call.actor.kind !== "token") throw invalid("Use a service token for this endpoint");
    const scope = await loadEnvironment(call.db, call.actor, call.actor.environmentId, call.request);
    const input = await call.body(
      z.object({ changes: z.array(change).min(1).max(1000), message: z.string().max(500).optional() }),
    );
    const result = await applyChanges(call.db, scope, { ...input, confirm: scope.environment.name });
    return { changeSetId: result.changeSetId, count: result.ops.length };
  });

  return router;

  async function memberOf(call: Call, organizationId: string) {
    const [target] = await call.db
      .select()
      .from(members)
      .where(and(eq(members.id, call.params.memberId!), eq(members.organizationId, organizationId)));
    if (!target) throw notFound("Member");
    return target;
  }
}

function requireUserActor(actor: Actor) {
  if (actor.kind !== "user") throw forbidden("Service tokens can only read and write secrets");
  return actor.userId;
}
