import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { migrate, status } from "./migrate.js";
import { parseMigrations, readMigrations } from "./migrations.js";
import * as schema from "./schema/index.js";

const url = process.env.TEST_DATABASE_URL;
const list = (...files: [string, string][]) => parseMigrations(files.map(([file, sql]) => ({ file, sql })));

describe("migrations against Postgres", { skip: url ? false : "TEST_DATABASE_URL is not set" }, () => {
  let sql: postgres.Sql;
  const schemas: string[] = [];
  const connect = () => postgres(url!, { max: 1, prepare: false, onnotice: () => {} });

  async function fresh() {
    const name = `secmgr_test_${randomBytes(6).toString("hex")}`;
    await sql.unsafe(`create schema ${name}`);
    schemas.push(name);
    return name;
  }

  before(() => {
    sql = connect();
  });

  after(async () => {
    for (const name of schemas) await sql.unsafe(`drop schema if exists ${name} cascade`);
    await sql.end({ timeout: 5 });
  });

  test("applies every migration once", async () => {
    const s = await fresh();
    const migrations = readMigrations();
    assert.deepEqual(
      await migrate(sql, migrations, { schema: s }),
      migrations.map((m) => m.name),
    );
    assert.deepEqual(await migrate(sql, migrations, { schema: s }), []);
    const states = await status(sql, migrations, { schema: s });
    assert.ok(states.every((m) => m.status === "applied" && m.appliedAt instanceof Date));
  });

  test("only applies what is pending", async () => {
    const s = await fresh();
    await migrate(sql, list(["0001_a.sql", "create table a (id int);"]), { schema: s });
    const both = list(["0001_a.sql", "create table a (id int);"], ["0002_b.sql", "create table b (id int);"]);
    assert.deepEqual(
      (await status(sql, both, { schema: s })).map((m) => m.status),
      ["applied", "pending"],
    );
    assert.deepEqual(await migrate(sql, both, { schema: s }), ["0002_b"]);
  });

  test("stops when an applied migration was edited", async () => {
    const s = await fresh();
    await migrate(sql, list(["0001_a.sql", "create table a (id int);"]), { schema: s });
    const edited = list(["0001_a.sql", "create table a (id bigint);"]);
    await assert.rejects(migrate(sql, edited, { schema: s }), /0001_a changed after it was applied/);
    assert.equal((await status(sql, edited, { schema: s }))[0]?.status, "changed");
  });

  test("stops when the database has a migration the code does not", async () => {
    const s = await fresh();
    const a: [string, string] = ["0001_a.sql", "create table a (id int);"];
    await migrate(sql, list(a, ["0002_b.sql", "create table b (id int);"]), { schema: s });
    await assert.rejects(migrate(sql, list(a), { schema: s }), /0002_b applied, but that file is missing/);
  });

  test("rolls back a migration that fails halfway", async () => {
    const s = await fresh();
    const migrations = list(
      ["0001_a.sql", "create table a (id int);"],
      ["0002_b.sql", "create table b (id int);\nselect no_such_function();"],
    );
    await assert.rejects(
      migrate(sql, migrations, { schema: s }),
      /0002_b failed: function no_such_function\(\) does not exist/,
    );
    assert.deepEqual(
      (await status(sql, migrations, { schema: s })).map((m) => m.status),
      ["applied", "pending"],
    );
    const [row] = await sql`select to_regclass(${`${s}.b`}) as b`;
    assert.equal(row?.b, null);
  });

  test("applies each migration once when two runs race", async () => {
    const s = await fresh();
    const migrations = readMigrations();
    const [one, two] = [connect(), connect()];
    try {
      const runs = await Promise.all([
        migrate(one, migrations, { schema: s }),
        migrate(two, migrations, { schema: s }),
      ]);
      assert.deepEqual(runs.flat().sort(), migrations.map((m) => m.name).sort());
    } finally {
      await Promise.all([one.end(), two.end()]);
    }
  });

  test("the Drizzle schema matches the migrations", async () => {
    const s = await fresh();
    await migrate(sql, readMigrations(), { schema: s });

    const tables = Object.values(schema)
      .filter((value) => is(value, PgTable))
      .map((table) => getTableConfig(table));
    const expectedColumns = tables.flatMap((t) =>
      t.columns.map((c) => `${t.name}.${c.name} ${c.getSQLType()}${c.notNull ? " not null" : ""}`),
    );
    const expectedIndexes = tables.flatMap((t) => t.indexes.map((i) => `${t.name}.${i.config.name}`));

    const columns = await sql<{ line: string }[]>`
      select c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
        || case when a.attnotnull then ' not null' else '' end as line
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = ${s} and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
        and c.relname <> 'schema_migrations'
    `;
    const indexes = await sql<{ line: string }[]>`
      select t.relname || '.' || i.relname as line
      from pg_index x
      join pg_class i on i.oid = x.indexrelid
      join pg_class t on t.oid = x.indrelid
      join pg_namespace ns on ns.oid = t.relnamespace
      where ns.nspname = ${s} and not exists (select 1 from pg_constraint k where k.conindid = x.indexrelid)
    `;

    assert.deepEqual(columns.map((r) => r.line).sort(), expectedColumns.sort());
    assert.deepEqual(indexes.map((r) => r.line).sort(), expectedIndexes.sort());
  });
});
