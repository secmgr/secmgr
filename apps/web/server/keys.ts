import { dataKeyContext, generateDataKey, type MasterKey, masterKeyFromEnv, ProjectKey } from "@secmgr/crypto";
import { type Database, projectKeys } from "@secmgr/db";
import { and, desc, eq } from "drizzle-orm";

let master: MasterKey | null = null;
const cache = new Map<string, ProjectKey>();

export function masterKey() {
  master ??= masterKeyFromEnv();
  return master;
}

export async function createProjectKey(db: Database, projectId: string) {
  const dataKey = generateDataKey();
  const wrapped = await masterKey().wrap(dataKey, dataKeyContext(projectId, 1));
  await db.insert(projectKeys).values({
    projectId,
    version: 1,
    wrappedKey: wrapped.wrapped,
    keyProvider: wrapped.provider,
    masterKeyId: wrapped.keyId,
  });
  const key = new ProjectKey(projectId, 1, dataKey);
  cache.set(`${projectId}:1`, key);
  return key;
}

export async function projectKey(db: Database, projectId: string, version?: number) {
  const cached = version ? cache.get(`${projectId}:${version}`) : undefined;
  if (cached) return cached;
  const [row] = await db
    .select()
    .from(projectKeys)
    .where(
      version
        ? and(eq(projectKeys.projectId, projectId), eq(projectKeys.version, version))
        : eq(projectKeys.projectId, projectId),
    )
    .orderBy(desc(projectKeys.version))
    .limit(1);
  if (!row) throw new Error(`Project ${projectId} has no data key`);
  const dataKey = await masterKey().unwrap(
    { wrapped: row.wrappedKey, provider: row.keyProvider, keyId: row.masterKeyId },
    dataKeyContext(projectId, row.version),
  );
  const key = new ProjectKey(projectId, row.version, dataKey);
  cache.set(`${projectId}:${row.version}`, key);
  return key;
}
