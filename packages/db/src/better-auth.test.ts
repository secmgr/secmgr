import assert from "node:assert/strict";
import { test } from "node:test";
import { getAuthTables } from "better-auth/db";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema/index.ts";

const tables = getAuthTables({
  plugins: [organization(), magicLink({ sendMagicLink() {} }), twoFactor()],
  rateLimit: { storage: "database" },
});

const drizzleTables = new Map<string, PgTable>(
  Object.entries(schema as Record<string, unknown>).flatMap(([name, value]) =>
    is(value, PgTable) ? [[name, value]] : [],
  ),
);

test("has a table for every Better Auth model used by apps/web/lib/auth.ts", () => {
  for (const model of Object.keys(tables)) assert.ok(drizzleTables.has(`${model}s`), `schema.${model}s is missing`);
});

for (const [model, table] of Object.entries(tables)) {
  test(`${model}s has exactly the fields Better Auth reads and writes`, () => {
    const columns = getTableColumns(drizzleTables.get(`${model}s`)!);
    assert.deepEqual(Object.keys(columns).sort(), ["id", ...Object.keys(table.fields)].sort());
    for (const [name, field] of Object.entries(table.fields)) {
      const column = columns[name]!;
      if (field.required)
        assert.ok(column.notNull, `${model}s.${name} is required by Better Auth, so it must be not null`);
      else if (field.defaultValue === undefined)
        assert.ok(!column.notNull, `${model}s.${name} is optional, so it must allow null`);
      else assert.ok(!column.notNull || column.hasDefault, `${model}s.${name} is not null, so it needs a default`);
    }
  });
}
