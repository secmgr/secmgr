import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvConfig(root);

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  transpilePackages: ["@secmgr/ui"],
  poweredByHeader: false,
  typedRoutes: true,
};

export default config;
