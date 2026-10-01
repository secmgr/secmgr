import type { Sql, TransactionSql } from "postgres";
import { type Migration, MigrationError } from "./migrations.ts";

export type MigrationState = {
  name: string;
  status: "applied" | "pending" | "changed";
  appliedAt: Date | null;
};

type Applied = { version: number; name: string; checksum: string; applied_at: Date };

const LOCK = "secmgr.migrate:";

const missing = (name: string) =>
  new MigrationError(
    `The database has ${name} applied, but that file is missing. Pull the latest code before migrating`,
  );
const changed = (name: string) =>
  new MigrationError(`${name} changed after it was applied. Revert the edit and put the change in a new migration`);

async function locked<T>(sql: Sql, schema: string, fn: (tx: TransactionSql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx`select set_config('search_path', ${schema}, true)`;
    await tx`select pg_advisory_xact_lock(hashtext(${LOCK + schema}))`;
    return fn(tx);
  }) as Promise<T>;
}

function applied(sql: Sql, schema: string) {
  return locked(sql, schema, async (tx) => {
    await tx`
      create table if not exists schema_migrations (
        version integer primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;
    return [
      ...(await tx<Applied[]>`select version, name, checksum, applied_at from schema_migrations order by version`),
    ];
  });
}

export async function status(sql: Sql, migrations: Migration[], { schema = "public" } = {}): Promise<MigrationState[]> {
  const rows = await applied(sql, schema);
  const byVersion = new Map(rows.map((row) => [row.version, row]));
  const stray = rows.find((row) => !migrations.some((m) => m.version === row.version));
  if (stray) throw missing(stray.name);
  return migrations.map((m) => {
    const row = byVersion.get(m.version);
    if (!row) return { name: m.name, status: "pending", appliedAt: null };
    return { name: m.name, status: row.checksum === m.checksum ? "applied" : "changed", appliedAt: row.applied_at };
  });
}

export async function migrate(sql: Sql, migrations: Migration[], { schema = "public" } = {}) {
  const changedOne = (await status(sql, migrations, { schema })).find((m) => m.status === "changed");
  if (changedOne) throw changed(changedOne.name);
  const ran: string[] = [];
  for (const migration of migrations) {
    const didRun = await locked(sql, schema, async (tx) => {
      const [row] = await tx<
        Pick<Applied, "checksum">[]
      >`select checksum from schema_migrations where version = ${migration.version}`;
      if (row) {
        if (row.checksum !== migration.checksum) throw changed(migration.name);
        return false;
      }
      try {
        await tx.unsafe(migration.sql);
      } catch (error) {
        throw new MigrationError(
          `${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      await tx`insert into schema_migrations (version, name, checksum) values (${migration.version}, ${migration.name}, ${migration.checksum})`;
      return true;
    });
    if (didRun) ran.push(migration.name);
  }
  return ran;
}
