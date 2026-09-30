import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Migration = {
  version: number;
  name: string;
  sql: string;
  checksum: string;
};

export type MigrationFile = { file: string; sql: string };

const FILE = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export class MigrationError extends Error {}

export const checksum = (sql: string) => createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

export function parseMigrations(files: MigrationFile[]): Migration[] {
  const migrations = files
    .map(({ file, sql }) => {
      const match = FILE.exec(file);
      if (!match) {
        throw new MigrationError(`${file} is not named like 0001_describe_the_change.sql`);
      }
      if (!sql.trim()) throw new MigrationError(`${file} is empty`);
      return { version: Number(match[1]), name: file.slice(0, -4), sql, checksum: checksum(sql) };
    })
    .sort((a, b) => a.version - b.version);
  migrations.forEach((migration, i) => {
    if (migration.version !== i + 1) {
      const expected = String(i + 1).padStart(4, "0");
      throw new MigrationError(
        `Expected migration ${expected} but found ${migration.name}. Numbers must run 0001, 0002, 0003 with no gaps or repeats`,
      );
    }
  });
  return migrations;
}

export function readMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql"));
  return parseMigrations(files.map((file) => ({ file, sql: readFileSync(path.join(dir, file), "utf8") })));
}

export function nextMigrationName(existing: Migration[], description: string) {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!slug) throw new MigrationError("Describe the change, for example: npm run db:new create_projects");
  return `${String(existing.length + 1).padStart(4, "0")}_${slug}.sql`;
}
