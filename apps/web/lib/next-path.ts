import type { Route } from "next";

export function safeNext(value: unknown): Route {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw as Route;
}
