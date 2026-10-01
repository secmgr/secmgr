import { createDb, type Db } from "@secmgr/db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local at the repo root");

const cache = globalThis as { secmgrDb?: Db };

const max = Number(process.env.DATABASE_POOL_MAX) || undefined;

export const db = cache.secmgrDb ?? createDb(url, { max });
if (process.env.NODE_ENV !== "production") cache.secmgrDb = db;
