import {
  type Database,
  type EnvironmentColor,
  environmentAccess,
  environments,
  members,
  type projects,
} from "@secmgr/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { record } from "../audit.ts";
import { type Access, accessFor, type Context, isUuid, overrideFor, requireManage } from "../context.ts";
import { confirmRequired, conflict, invalid, isUniqueViolation, notFound } from "../errors.ts";
import { environmentNameProblem, isColor } from "./projects.ts";
import { copyEnvironmentSecrets } from "./secrets.ts";

type Project = typeof projects.$inferSelect;
type Environment = typeof environments.$inferSelect;

export type CreateEnvironmentInput = {
  name: string;
  color?: EnvironmentColor;
  protected?: boolean;
  cloneFrom?: string | null;
};

export async function createEnvironment(db: Database, ctx: Context, project: Project, input: CreateEnvironmentInput) {
  requireManage(ctx, "create environments");
  const problem = environmentNameProblem(input.name);
  if (problem) throw invalid(problem, { field: "name" });
  if (input.color !== undefined && !isColor(input.color))
    throw invalid("Pick one of the environment colors", { field: "color" });
  let source: Environment | undefined;
  if (input.cloneFrom) {
    if (!isUuid(input.cloneFrom)) throw notFound("Environment to clone");
    [source] = await db
      .select()
      .from(environments)
      .where(and(eq(environments.id, input.cloneFrom), eq(environments.projectId, project.id)));
    if (!source) throw notFound("Environment to clone");
    const access = accessFor(ctx, source, await overrideFor(db, ctx, source.id));
    if (access !== "read" && access !== "write")
      throw invalid(`You cannot read ${source.name}, so you cannot clone it`);
  }
  const [{ next }] = (await db
    .select({ next: sql<number>`coalesce(max(${environments.position}) + 1, 0)` })
    .from(environments)
    .where(eq(environments.projectId, project.id))) as [{ next: number }];
  let environment: Environment;
  try {
    [environment] = (await db
      .insert(environments)
      .values({
        projectId: project.id,
        name: input.name,
        color: input.color ?? "gray",
        protected: input.protected ?? false,
        position: Number(next),
      })
      .returning()) as [Environment];
  } catch (error) {
    if (isUniqueViolation(error))
      throw conflict(`${project.name} already has an environment named ${input.name}`, { field: "name" });
    throw error;
  }
  await record(db, ctx, {
    action: "create-env",
    projectId: project.id,
    environmentId: environment.id,
    target: environment.name,
    detail: {
      project: project.name,
      environment: environment.name,
      message: source ? `Cloned from ${source.name}` : "Started empty",
    },
  });
  if (source) await copyEnvironmentSecrets(db, ctx, project, source, environment);
  return environment;
}

export type UpdateEnvironmentInput = { name?: string; color?: EnvironmentColor; protected?: boolean; confirm?: string };

export async function updateEnvironment(
  db: Database,
  ctx: Context,
  project: Project,
  environment: Environment,
  input: UpdateEnvironmentInput,
) {
  requireManage(ctx, "change environments");
  const patch: Partial<typeof environments.$inferInsert> = {};
  if (input.name !== undefined && input.name !== environment.name) {
    const problem = environmentNameProblem(input.name);
    if (problem) throw invalid(problem, { field: "name" });
    patch.name = input.name;
  }
  if (input.color !== undefined) {
    if (!isColor(input.color)) throw invalid("Pick one of the environment colors", { field: "color" });
    patch.color = input.color;
  }
  if (input.protected !== undefined && input.protected !== environment.protected) {
    if (input.confirm !== environment.name) {
      throw confirmRequired(`Type ${environment.name} to ${input.protected ? "protect" : "stop protecting"} it`);
    }
    patch.protected = input.protected;
  }
  if (!Object.keys(patch).length) return environment;
  let updated: Environment;
  try {
    [updated] = (await db.update(environments).set(patch).where(eq(environments.id, environment.id)).returning()) as [
      Environment,
    ];
  } catch (error) {
    if (isUniqueViolation(error))
      throw conflict(`${project.name} already has an environment named ${input.name}`, { field: "name" });
    throw error;
  }
  await record(db, ctx, {
    action: patch.protected === undefined ? "update-env" : patch.protected ? "protect" : "unprotect",
    projectId: project.id,
    environmentId: environment.id,
    target: updated.name,
    detail: {
      project: project.name,
      environment: updated.name,
      ...(patch.name ? { renamedFrom: environment.name } : {}),
      ...(patch.color ? { color: patch.color } : {}),
    },
  });
  return updated;
}

export async function deleteEnvironment(
  db: Database,
  ctx: Context,
  project: Project,
  environment: Environment,
  confirm: string | undefined,
) {
  requireManage(ctx, "delete environments");
  if (confirm !== environment.name) throw confirmRequired(`Type ${environment.name} to delete it`);
  await db.delete(environments).where(eq(environments.id, environment.id));
  await record(db, ctx, {
    action: "delete-env",
    projectId: project.id,
    target: environment.name,
    detail: { project: project.name, environment: environment.name },
  });
}

export async function reorderEnvironments(db: Database, ctx: Context, project: Project, ids: string[]) {
  requireManage(ctx, "reorder environments");
  const current = await db
    .select({ id: environments.id })
    .from(environments)
    .where(eq(environments.projectId, project.id))
    .orderBy(asc(environments.position));
  const known = new Set(current.map((e) => e.id));
  if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
    throw invalid("List every environment of the project exactly once");
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(environments).set({ position }).where(eq(environments.id, id));
    }
  });
}

export async function setEnvironmentAccess(
  db: Database,
  ctx: Context,
  project: Project,
  environment: Environment,
  memberId: string,
  access: Exclude<Access, "meta"> | null,
) {
  requireManage(ctx, "change environment access");
  const [member] = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, ctx.workspace.id)));
  if (!member) throw notFound("Member");
  if (member.role === "owner") throw invalid("Owners always have full access");
  if (access === null) {
    await db
      .delete(environmentAccess)
      .where(and(eq(environmentAccess.environmentId, environment.id), eq(environmentAccess.memberId, member.id)));
  } else {
    const updatedBy = ctx.actor.kind === "user" ? ctx.actor.userId : null;
    await db
      .insert(environmentAccess)
      .values({ environmentId: environment.id, memberId: member.id, access, updatedBy })
      .onConflictDoUpdate({
        target: [environmentAccess.environmentId, environmentAccess.memberId],
        set: { access, updatedBy, updatedAt: new Date() },
      });
  }
  await record(db, ctx, {
    action: "access",
    projectId: project.id,
    environmentId: environment.id,
    target: member.id,
    detail: { project: project.name, environment: environment.name, access: access ?? "default" },
  });
}
