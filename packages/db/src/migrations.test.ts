import assert from "node:assert/strict";
import { test } from "node:test";
import { checksum, MigrationError, nextMigrationName, parseMigrations, readMigrations } from "./migrations.js";

const file = (name: string, sql = "select 1;") => ({ file: name, sql });

test("reads the migrations in the repo in order", () => {
  const migrations = readMigrations();
  assert.equal(migrations[0]?.name, "0001_create_auth_tables");
  assert.deepEqual(
    migrations.map((m) => m.version),
    migrations.map((_, i) => i + 1),
  );
});

test("sorts by number, not by file order", () => {
  const names = parseMigrations([file("0002_b.sql"), file("0001_a.sql")]).map((m) => m.name);
  assert.deepEqual(names, ["0001_a", "0002_b"]);
});

test("rejects a badly named file", () => {
  for (const name of ["1_a.sql", "0001-a.sql", "0001_A.sql", "0001_.sql", "0001_a__b.sql"]) {
    assert.throws(() => parseMigrations([file(name)]), MigrationError, name);
  }
});

test("rejects gaps and repeated numbers", () => {
  assert.throws(
    () => parseMigrations([file("0001_a.sql"), file("0003_c.sql")]),
    /Expected migration 0002 but found 0003_c/,
  );
  assert.throws(
    () => parseMigrations([file("0001_a.sql"), file("0001_b.sql")]),
    /Expected migration 0002 but found 0001_/,
  );
});

test("rejects an empty file", () => {
  assert.throws(() => parseMigrations([file("0001_a.sql", " \n")]), /0001_a.sql is empty/);
});

test("checksums ignore Windows line endings", () => {
  assert.equal(checksum("select 1;\r\nselect 2;\r\n"), checksum("select 1;\nselect 2;\n"));
  assert.notEqual(checksum("select 1;"), checksum("select 2;"));
});

test("names the next migration", () => {
  const existing = parseMigrations([file("0001_a.sql"), file("0002_b.sql")]);
  assert.equal(nextMigrationName(existing, "create_projects"), "0003_create_projects.sql");
  assert.equal(nextMigrationName(existing, "Add secret versions"), "0003_add_secret_versions.sql");
  assert.equal(nextMigrationName([], "-index on-email-"), "0001_index_on_email.sql");
  assert.throws(() => nextMigrationName(existing, " "), /Describe the change/);
});
