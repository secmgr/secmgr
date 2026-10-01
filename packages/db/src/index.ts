import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export * from "./schema/index.ts";
export { schema };

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

export function createDb(url: string, { max = 5 }: { max?: number } = {}) {
  const client = postgres(url, { max, prepare: false, onnotice: () => {} });
  return drizzle({ client, schema });
}

export type Db = ReturnType<typeof createDb>;
