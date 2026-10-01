import {
  type Database,
  dismissedInsights,
  environmentAccess,
  environments,
  invitations,
  members,
  organizations,
  projectStars,
  projects,
  secrets,
  secretVersions,
  serviceTokens,
  sessions,
  shareLinks,
  users,
} from "@secmgr/db";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, max, or } from "drizzle-orm";
import { type Access, accessFor, type Context, canManage, requireUser } from "../context.ts";
import { getPreferences } from "./preferences.ts";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function listWorkspaces(db: Database, userId: string) {
  const mine = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: members.role })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId))
    .orderBy(asc(organizations.name));
  if (!mine.length) return [];
  const counts = await db
    .select({ organizationId: members.organizationId, members: count() })
    .from(members)
    .where(
      inArray(
        members.organizationId,
        mine.map((w) => w.id),
      ),
    )
    .groupBy(members.organizationId);
  const byId = new Map(counts.map((c) => [c.organizationId, c.members]));
  return mine.map((w) => ({ ...w, members: byId.get(w.id) ?? 1 }));
}

export async function buildSnapshot(db: Database, ctx: Context) {
  const actor = requireUser(ctx);
  const org = ctx.workspace.id;
  const manage = canManage(ctx);

  const [me] = await db.select().from(users).where(eq(users.id, actor.userId));
  const lastActive = db
    .select({ userId: sessions.userId, at: max(sessions.updatedAt).as("at") })
    .from(sessions)
    .groupBy(sessions.userId)
    .as("last_active");
  const [
    workspaces,
    memberRows,
    inviteRows,
    projectRows,
    starRows,
    envRows,
    overrideRows,
    tokenRows,
    dismissed,
    prefs,
  ] = await Promise.all([
    listWorkspaces(db, actor.userId),
    db
      .select({ member: members, user: users, lastActiveAt: lastActive.at })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .leftJoin(lastActive, eq(lastActive.userId, members.userId))
      .where(eq(members.organizationId, org))
      .orderBy(asc(members.createdAt)),
    db
      .select({ invitation: invitations, inviterName: users.name, inviterEmail: users.email })
      .from(invitations)
      .leftJoin(users, eq(users.id, invitations.inviterId))
      .where(
        and(
          eq(invitations.organizationId, org),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, new Date()),
        ),
      ),
    db.select().from(projects).where(eq(projects.organizationId, org)).orderBy(asc(projects.name)),
    db
      .select({ projectId: projectStars.projectId })
      .from(projectStars)
      .innerJoin(projects, eq(projects.id, projectStars.projectId))
      .where(and(eq(projectStars.userId, actor.userId), eq(projects.organizationId, org))),
    db
      .select({ environment: environments })
      .from(environments)
      .innerJoin(projects, eq(projects.id, environments.projectId))
      .where(eq(projects.organizationId, org))
      .orderBy(asc(environments.position)),
    db
      .select({ access: environmentAccess })
      .from(environmentAccess)
      .innerJoin(members, eq(members.id, environmentAccess.memberId))
      .where(eq(members.organizationId, org)),
    db
      .select()
      .from(serviceTokens)
      .where(and(eq(serviceTokens.organizationId, org), isNull(serviceTokens.revokedAt))),
    db
      .select({ id: dismissedInsights.insightId })
      .from(dismissedInsights)
      .where(
        and(
          eq(dismissedInsights.organizationId, org),
          or(isNull(dismissedInsights.snoozedUntil), gt(dismissedInsights.snoozedUntil, new Date())),
        ),
      ),
    getPreferences(db, actor.userId),
  ]);

  const myOverrides = new Map(
    overrideRows
      .filter((r) => r.access.memberId === ctx.memberId)
      .map((r) => [r.access.environmentId, r.access.access]),
  );
  const access = new Map<string, Access>(
    envRows.map(({ environment: e }) => [e.id, accessFor(ctx, e, myOverrides.get(e.id))]),
  );
  const visibleEnvs = envRows.map((r) => r.environment).filter((e) => access.get(e.id) !== "none");
  const visibleIds = visibleEnvs.map((e) => e.id);

  const secretRows = visibleIds.length
    ? await db
        .select({ secret: secrets, version: secretVersions })
        .from(secrets)
        .leftJoin(
          secretVersions,
          and(eq(secretVersions.secretId, secrets.id), eq(secretVersions.version, secrets.version)),
        )
        .where(and(inArray(secrets.environmentId, visibleIds), isNull(secrets.deletedAt)))
        .orderBy(asc(secrets.key))
    : [];

  const shareRows = await db
    .select({
      id: shareLinks.id,
      secretId: shareLinks.secretId,
      createdBy: shareLinks.createdBy,
      createdAt: shareLinks.createdAt,
      expiresAt: shareLinks.expiresAt,
      views: shareLinks.views,
      maxViews: shareLinks.maxViews,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.organizationId, org),
        isNull(shareLinks.revokedAt),
        isNotNull(shareLinks.ciphertext),
        gt(shareLinks.expiresAt, new Date()),
        manage ? undefined : eq(shareLinks.createdBy, actor.userId),
      ),
    );

  const projectOf = new Map(envRows.map(({ environment: e }) => [e.id, e.projectId]));
  const visibleProjects = new Set(visibleEnvs.map((e) => e.projectId));
  const starred = new Set(starRows.map((s) => s.projectId));

  return {
    me: {
      id: actor.userId,
      name: me?.name || me?.email || actor.name || actor.email,
      email: me?.email ?? actor.email,
      image: me?.image ?? null,
      twoFactor: me?.twoFactorEnabled ?? false,
      role: ctx.role,
      memberId: ctx.memberId,
    },
    workspace: {
      id: ctx.workspace.id,
      name: ctx.workspace.name,
      slug: ctx.workspace.slug,
      createdAt: iso(ctx.workspace.createdAt),
    },
    workspaces,
    prefs,
    members: memberRows.map(({ member, user, lastActiveAt }) => ({
      id: user.id,
      memberId: member.id,
      name: user.name || user.email,
      email: user.email,
      image: user.image,
      role: member.role,
      joinedAt: iso(member.createdAt),
      lastActiveAt: lastActiveAt ? iso(new Date(lastActiveAt)) : null,
      twoFactor: user.twoFactorEnabled,
    })),
    invites: inviteRows.map(({ invitation, inviterName, inviterEmail }) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role ?? "developer",
      invitedBy: invitation.inviterId,
      invitedByName: inviterName || inviterEmail,
      sentAt: iso(invitation.createdAt),
      expiresAt: iso(invitation.expiresAt),
    })),
    projects: projectRows
      .filter((p) => manage || visibleProjects.has(p.id) || !envRows.some((r) => r.environment.projectId === p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        repo: p.repo ?? "",
        starred: starred.has(p.id),
        createdAt: iso(p.createdAt),
        archived: !!p.archivedAt,
      })),
    environments: visibleEnvs.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      name: e.name,
      color: e.color,
      protected: e.protected,
      order: e.position,
      access: access.get(e.id)!,
    })),
    secrets: secretRows.map(({ secret: s, version: v }) => ({
      id: s.id,
      projectId: projectOf.get(s.environmentId)!,
      envId: s.environmentId,
      key: s.key,
      note: s.note,
      sensitive: s.sensitive,
      version: s.version,
      fingerprint: v?.fingerprint ?? null,
      length: v?.valueLength ?? 0,
      looksLive: v?.looksLive ?? false,
      refs: v?.refs ?? [],
      createdAt: iso(s.createdAt),
      createdBy: s.createdBy,
      updatedAt: iso(s.updatedAt),
      updatedBy: s.updatedBy,
      rotateEveryDays: s.rotateEveryDays,
      lastRotatedAt: iso(s.lastRotatedAt),
    })),
    tokens: tokenRows
      .filter((t) => access.get(t.environmentId) !== undefined && access.get(t.environmentId) !== "none")
      .map((t) => ({
        id: t.id,
        name: t.name,
        projectId: projectOf.get(t.environmentId)!,
        envId: t.environmentId,
        access: t.access,
        prefix: t.prefix,
        suffix: t.suffix,
        createdBy: t.createdBy,
        createdAt: iso(t.createdAt),
        lastUsedAt: iso(t.lastUsedAt),
        expiresAt: iso(t.expiresAt),
      })),
    shares: shareRows.map((s) => ({ ...s, createdAt: iso(s.createdAt), expiresAt: iso(s.expiresAt) })),
    access: manage
      ? overrideRows.map((r) => ({
          envId: r.access.environmentId,
          memberId: r.access.memberId,
          access: r.access.access,
        }))
      : [],
    dismissedInsights: dismissed.map((d) => d.id),
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;
