import { randomBytes, randomUUID } from "node:crypto";
import { createDb, type Database, members, organizations, users } from "@secmgr/db";
import { migrate, readMigrations } from "@secmgr/db/migrator";
import { type Role, type UserActor, workspaceContext } from "./context.ts";

export async function testDatabase(): Promise<Database | null> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;
  process.env.SECMGR_MASTER_KEY ??= randomBytes(32).toString("base64");
  const db = createDb(url, { max: 1 });
  await migrate(db.$client, readMigrations());
  return db;
}

export async function closeDatabase(db: Database | null) {
  const client = (db as { $client?: { end?: (o?: { timeout: number }) => Promise<void> } } | null)?.$client;
  await client?.end?.({ timeout: 5 });
}

const suffix = () => randomUUID().slice(0, 8);

export async function createUser(db: Database, name: string): Promise<UserActor> {
  const id = randomUUID();
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${suffix()}@test.secmgr.xyz`;
  await db.insert(users).values({ id, name, email, emailVerified: true });
  return { kind: "user", userId: id, name, email };
}

export async function createWorkspace(db: Database, owner: UserActor) {
  const id = randomUUID();
  const slug = `test-${suffix()}`;
  await db.insert(organizations).values({ id, name: "Lumen Labs", slug, createdAt: new Date() });
  await db
    .insert(members)
    .values({ id: randomUUID(), organizationId: id, userId: owner.userId, role: "owner", createdAt: new Date() });
  return { id, slug };
}

export async function addMember(db: Database, organizationId: string, user: UserActor, role: Role) {
  const id = randomUUID();
  await db.insert(members).values({ id, organizationId, userId: user.userId, role, createdAt: new Date() });
  return id;
}

export async function contextFor(db: Database, actor: UserActor, slug: string) {
  return workspaceContext(db, actor, slug, { ip: "127.0.0.1", userAgent: "node:test" });
}
