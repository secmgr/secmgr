import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { members, organizations, users } from "./auth.ts";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

const at = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => at("created_at").notNull().defaultNow();
const updatedAt = () =>
  at("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const userRef = (name: string) => text(name).references(() => users.id, { onDelete: "set null" });

export type ChangeOp = {
  secretId: string;
  key: string;
  op: "add" | "edit" | "delete";
  previousKey?: string;
  fromVersion: number | null;
  toVersion: number | null;
  wasDeleted?: boolean;
};

export const ENVIRONMENT_COLORS = ["gray", "blue", "green", "teal", "amber", "orange", "rose", "violet"] as const;
export type EnvironmentColor = (typeof ENVIRONMENT_COLORS)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    repo: text("repo"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: at("archived_at"),
  },
  (t) => [unique().on(t.organizationId, t.name)],
);

export const projectStars = pgTable(
  "project_stars",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.projectId] }), index("project_stars_project_id_idx").on(t.projectId)],
);

export const projectKeys = pgTable(
  "project_keys",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    wrappedKey: bytea("wrapped_key").notNull(),
    keyProvider: text("key_provider").notNull(),
    masterKeyId: text("master_key_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.version] })],
);

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").$type<EnvironmentColor>().notNull().default("gray"),
    position: integer("position").notNull().default(0),
    protected: boolean("protected").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.projectId, t.name)],
);

export const secrets = pgTable(
  "secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    note: text("note").notNull().default(""),
    sensitive: boolean("sensitive").notNull().default(true),
    version: integer("version").notNull().default(0),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedBy: userRef("updated_by"),
    updatedAt: updatedAt(),
    deletedAt: at("deleted_at"),
    rotateEveryDays: integer("rotate_every_days"),
    lastRotatedAt: at("last_rotated_at"),
  },
  (t) => [unique().on(t.environmentId, t.key)],
);

export const serviceTokens = pgTable(
  "service_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    suffix: text("suffix").notNull(),
    access: text("access").$type<"read" | "write">().notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    expiresAt: at("expires_at"),
    lastUsedAt: at("last_used_at"),
    revokedAt: at("revoked_at"),
  },
  (t) => [
    index("service_tokens_organization_id_idx").on(t.organizationId),
    index("service_tokens_environment_id_idx").on(t.environmentId),
  ],
);

export const changeSets = pgTable(
  "change_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    actorUserId: userRef("actor_user_id"),
    actorTokenId: uuid("actor_token_id").references(() => serviceTokens.id, { onDelete: "set null" }),
    message: text("message").notNull().default(""),
    ops: jsonb("ops").$type<ChangeOp[]>().notNull().default([]),
    revertsId: uuid("reverts_id").references((): AnyPgColumn => changeSets.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("change_sets_environment_id_idx").on(t.environmentId, t.createdAt.desc())],
);

export const secretVersions = pgTable(
  "secret_versions",
  {
    secretId: uuid("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    changeSetId: uuid("change_set_id").references(() => changeSets.id, { onDelete: "set null" }),
    keyVersion: integer("key_version").notNull(),
    ciphertext: bytea("ciphertext").notNull(),
    nonce: bytea("nonce").notNull(),
    fingerprint: text("fingerprint").notNull(),
    valueLength: integer("value_length").notNull(),
    looksLive: boolean("looks_live").notNull().default(false),
    refs: text("refs").array().notNull().default(sql`'{}'`),
    summary: text("summary").notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.secretId, t.version] }),
    index("secret_versions_change_set_id_idx").on(t.changeSetId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    environmentId: uuid("environment_id").references(() => environments.id, { onDelete: "set null" }),
    actorUserId: userRef("actor_user_id"),
    actorTokenId: uuid("actor_token_id").references(() => serviceTokens.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    keys: text("keys").array().notNull().default(sql`'{}'`),
    target: text("target"),
    changeSetId: uuid("change_set_id").references(() => changeSets.id, { onDelete: "set null" }),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_events_organization_id_idx").on(t.organizationId, t.createdAt.desc()),
    index("audit_events_project_id_idx").on(t.projectId, t.createdAt.desc()),
  ],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    secretId: uuid("secret_id").references(() => secrets.id, { onDelete: "set null" }),
    createdBy: userRef("created_by"),
    ciphertext: bytea("ciphertext"),
    nonce: bytea("nonce"),
    maxViews: integer("max_views").notNull().default(1),
    views: integer("views").notNull().default(0),
    expiresAt: at("expires_at").notNull(),
    createdAt: createdAt(),
    lastViewedAt: at("last_viewed_at"),
    revokedAt: at("revoked_at"),
  },
  (t) => [index("share_links_secret_id_idx").on(t.secretId)],
);

export const dismissedInsights = pgTable(
  "dismissed_insights",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    insightId: text("insight_id").notNull(),
    dismissedBy: userRef("dismissed_by"),
    dismissedAt: at("dismissed_at").notNull().defaultNow(),
    snoozedUntil: at("snoozed_until"),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.insightId] })],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").$type<"light" | "dark" | "system">().notNull().default("system"),
  density: text("density").$type<"comfortable" | "compact">().notNull().default("comfortable"),
  revealTimeoutSec: integer("reveal_timeout_sec").notNull().default(10),
  clipboardClearSec: integer("clipboard_clear_sec").notNull().default(30),
  updatedAt: updatedAt(),
});

export const environmentAccess = pgTable(
  "environment_access",
  {
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    access: text("access").$type<"none" | "read" | "write">().notNull(),
    updatedBy: userRef("updated_by"),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.environmentId, t.memberId] }),
    index("environment_access_member_id_idx").on(t.memberId),
  ],
);
