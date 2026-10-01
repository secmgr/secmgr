import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { migrate, status } from "./migrate.ts";
import { MIGRATIONS_DIR, MigrationError, nextMigrationName, readMigrations } from "./migrations.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function loadEnv() {
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function connect() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new MigrationError("DATABASE_URL is not set. Add it to .env.local at the repo root");
  return postgres(url, { max: 1, prepare: false, onnotice: () => {} });
}

async function withDb(fn: (sql: postgres.Sql) => Promise<void>) {
  const sql = connect();
  try {
    await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const COMMANDS: Record<string, (args: string[]) => Promise<void> | void> = {
  async migrate() {
    const migrations = readMigrations();
    await withDb(async (sql) => {
      const ran = await migrate(sql, migrations);
      for (const name of ran) console.info(`Applied ${name}`);
      console.info(
        ran.length
          ? `Done. ${n(ran.length, "migration")} applied.`
          : `Up to date. ${n(migrations.length, "migration")} applied.`,
      );
    });
  },
  async status() {
    const migrations = readMigrations();
    await withDb(async (sql) => {
      const states = await status(sql, migrations);
      const width = Math.max(...states.map((s) => s.name.length));
      for (const s of states) {
        const when = s.appliedAt ? `  ${s.appliedAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : "";
        console.info(`${s.name.padEnd(width)}  ${s.status}${when}`);
      }
      const pending = states.filter((s) => s.status === "pending").length;
      console.info(pending ? `${n(pending, "migration")} pending. Run npm run db:migrate` : "Up to date.");
      if (states.some((s) => s.status === "changed")) process.exitCode = 1;
    });
  },
  new(args) {
    const file = nextMigrationName(readMigrations(), args.join(" "));
    writeFileSync(path.join(MIGRATIONS_DIR, file), "", { flag: "wx" });
    console.info(`Created packages/db/migrations/${file}`);
  },
};

const [name = "", ...args] = process.argv.slice(2);
const command = COMMANDS[name];
if (!command) {
  console.error(`Usage: node dist/cli.js <${Object.keys(COMMANDS).join(" | ")}>`);
  process.exit(2);
}
try {
  await command(args);
} catch (error) {
  console.error(error instanceof MigrationError ? `Error: ${error.message}` : error);
  process.exit(1);
}
