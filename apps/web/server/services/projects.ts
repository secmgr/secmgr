import {
  type Database,
  ENVIRONMENT_COLORS,
  type EnvironmentColor,
  environments,
  projectStars,
  projects,
} from "@secmgr/db";
import { and, eq } from "drizzle-orm";
import { record } from "../audit.ts";
import { type Context, requireManage, requireUser } from "../context.ts";
import { confirmRequired, conflict, invalid, isUniqueViolation } from "../errors.ts";
import { createProjectKey } from "../keys.ts";
import { NAME_PATTERN } from "../values.ts";

type Project = typeof projects.$inferSelect;

export const PROJECT_RESERVED = new Set([
  "activity",
  "health",
  "tokens",
  "members",
  "settings",
  "new",
  "projects",
  "api",
]);
export const ENVIRONMENT_RESERVED = new Set(["compare", "environments", "settings", "overview", "activity", "new"]);

export const DEFAULT_ENVIRONMENTS: { name: string; color: EnvironmentColor; protected: boolean }[] = [
  { name: "development", color: "blue", protected: false },
  { name: "staging", color: "amber", protected: false },
  { name: "production", color: "rose", protected: true },
];

export function projectNameProblem(name: string) {
  if (!name) return "Enter a name";
  if (name.length > 40) return "Use at most 40 characters";
  if (!NAME_PATTERN.test(name)) return "Use lowercase letters, digits and single dashes, like lumen-api";
  if (PROJECT_RESERVED.has(name)) return `${name} is reserved. Pick another name`;
  return null;
}

export function environmentNameProblem(name: string) {
  if (!name) return "Enter a name";
  if (name.length > 32) return "Use at most 32 characters";
  if (!NAME_PATTERN.test(name)) return "Use lowercase letters, digits and single dashes, like staging";
  if (ENVIRONMENT_RESERVED.has(name)) return `${name} is reserved. Pick another name`;
  return null;
}

export const isColor = (value: unknown): value is EnvironmentColor =>
  ENVIRONMENT_COLORS.includes(value as EnvironmentColor);

function checkRepo(repo: string | null | undefined) {
  if (!repo) return null;
  const trimmed = repo
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed))
    throw invalid("Link a repository as owner/name, like acme/web");
  return trimmed;
}

export type CreateProjectInput = {
  name: string;
  description?: string;
  repo?: string | null;
  environments?: { name: string; color?: EnvironmentColor; protected?: boolean }[];
};

export async function createProject(db: Database, ctx: Context, input: CreateProjectInput) {
  requireManage(ctx, "create projects");
  const actor = requireUser(ctx);
  const problem = projectNameProblem(input.name);
  if (problem) throw invalid(problem, { field: "name" });
  const envs = input.environments?.length ? input.environments : DEFAULT_ENVIRONMENTS;
  const names = new Set<string>();
  for (const env of envs) {
    const envProblem = environmentNameProblem(env.name);
    if (envProblem) throw invalid(`${env.name || "An environment"}: ${envProblem}`, { field: "environments" });
    if (names.has(env.name)) throw invalid(`${env.name} is listed twice`, { field: "environments" });
    names.add(env.name);
  }
  const repo = checkRepo(input.repo);
  try {
    return await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          organizationId: ctx.workspace.id,
          name: input.name,
          description: (input.description ?? "").trim().slice(0, 200),
          repo,
          createdBy: actor.userId,
        })
        .returning();
      await createProjectKey(tx, project!.id);
      const created = await tx
        .insert(environments)
        .values(
          envs.map((env, position) => ({
            projectId: project!.id,
            name: env.name,
            color: env.color ?? DEFAULT_ENVIRONMENTS.find((d) => d.name === env.name)?.color ?? "gray",
            protected: env.protected ?? env.name === "production",
            position,
          })),
        )
        .returning();
      await record(tx, ctx, {
        action: "create-project",
        projectId: project!.id,
        target: project!.name,
        detail: { project: project!.name, environments: created.map((e) => e.name) },
      });
      return { project: project!, environments: created };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(`A project named ${input.name} already exists`, { field: "name" });
    throw error;
  }
}

export type UpdateProjectInput = { name?: string; description?: string; repo?: string | null; archived?: boolean };

export async function updateProject(db: Database, ctx: Context, project: Project, input: UpdateProjectInput) {
  requireManage(ctx, "change projects");
  const patch: Partial<typeof projects.$inferInsert> = {};
  if (input.name !== undefined && input.name !== project.name) {
    const problem = projectNameProblem(input.name);
    if (problem) throw invalid(problem, { field: "name" });
    patch.name = input.name;
  }
  if (input.description !== undefined) patch.description = input.description.trim().slice(0, 200);
  if (input.repo !== undefined) patch.repo = checkRepo(input.repo);
  if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null;
  if (!Object.keys(patch).length) return project;
  try {
    const [updated] = await db.update(projects).set(patch).where(eq(projects.id, project.id)).returning();
    await record(db, ctx, {
      action: input.archived !== undefined ? "archive-project" : "update-project",
      projectId: project.id,
      target: updated!.name,
      detail: {
        project: updated!.name,
        ...(patch.name ? { renamedFrom: project.name } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      },
    });
    return updated!;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(`A project named ${input.name} already exists`, { field: "name" });
    throw error;
  }
}

export async function deleteProject(db: Database, ctx: Context, project: Project, confirm: string | undefined) {
  requireManage(ctx, "delete projects");
  if (confirm !== project.name) throw confirmRequired(`Type ${project.name} to delete it`);
  await db.delete(projects).where(eq(projects.id, project.id));
  await record(db, ctx, { action: "delete-project", target: project.name, detail: { project: project.name } });
}

export async function setStar(db: Database, ctx: Context, project: Project, starred: boolean) {
  const actor = requireUser(ctx);
  if (starred) {
    await db.insert(projectStars).values({ userId: actor.userId, projectId: project.id }).onConflictDoNothing();
  } else {
    await db
      .delete(projectStars)
      .where(and(eq(projectStars.userId, actor.userId), eq(projectStars.projectId, project.id)));
  }
}
