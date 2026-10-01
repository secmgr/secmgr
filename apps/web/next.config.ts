import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import type { NextConfig } from "next";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, "utf8")))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  transpilePackages: ["@secmgr/crypto", "@secmgr/db", "@secmgr/ui"],
  poweredByHeader: false,
  typedRoutes: true,
  agentRules: false,
};

export default config;
