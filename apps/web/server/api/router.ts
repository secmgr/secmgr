import type { Database } from "@secmgr/db";
import { ZodError, type ZodType } from "zod";
import type { Actor, RequestInfo } from "../context.ts";
import { ApiError, forbidden, invalid, unauthorized } from "../errors.ts";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Call = {
  db: Database;
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  actor: Actor | null;
  request: RequestInfo;
  body<T>(schema: ZodType<T>): Promise<T>;
};

export type Handler = (call: Call & { actor: Actor }) => Promise<unknown>;
export type PublicHandler = (call: Call) => Promise<unknown>;

type Route = { method: Method; parts: string[]; handler: PublicHandler; public: boolean };

export class Router {
  readonly #routes: Route[] = [];

  #add(method: Method, pattern: string, handler: PublicHandler, isPublic: boolean) {
    this.#routes.push({ method, parts: pattern.split("/").filter(Boolean), handler, public: isPublic });
    return this;
  }

  get = (pattern: string, handler: Handler) => this.#add("GET", pattern, handler as PublicHandler, false);
  post = (pattern: string, handler: Handler) => this.#add("POST", pattern, handler as PublicHandler, false);
  put = (pattern: string, handler: Handler) => this.#add("PUT", pattern, handler as PublicHandler, false);
  patch = (pattern: string, handler: Handler) => this.#add("PATCH", pattern, handler as PublicHandler, false);
  delete = (pattern: string, handler: Handler) => this.#add("DELETE", pattern, handler as PublicHandler, false);
  publicGet = (pattern: string, handler: PublicHandler) => this.#add("GET", pattern, handler, true);
  publicPost = (pattern: string, handler: PublicHandler) => this.#add("POST", pattern, handler, true);

  match(method: string, path: string) {
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    let allowed = false;
    for (const route of this.#routes) {
      if (route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      const hit = route.parts.every((p, i) => {
        if (p.startsWith(":")) {
          params[p.slice(1)] = parts[i]!;
          return true;
        }
        return p === parts[i];
      });
      if (!hit) continue;
      if (route.method === method) return { route, params };
      allowed = true;
    }
    return allowed ? "method" : null;
  }
}

export type HandleOptions = {
  db: Database;
  router: Router;
  prefix: string;
  appOrigin: string;
  resolveActor: (req: Request) => Promise<{ actor: Actor | null; viaCookie: boolean }>;
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, ...error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return Response.json(
      {
        error: {
          code: "invalid",
          message: issue ? `${field ? `${field}: ` : ""}${issue.message}` : "The request is not valid",
          field,
        },
      },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong on our side. Try again in a moment" } },
    { status: 500 },
  );
}

export async function handle(req: Request, options: HandleOptions) {
  try {
    const url = new URL(req.url);
    const path = url.pathname.slice(options.prefix.length);
    const found = options.router.match(req.method, path);
    if (found === "method") return errorResponse(new ApiError(405, "invalid", `${req.method} is not allowed here`));
    if (!found)
      return errorResponse(new ApiError(404, "not_found", `No API route matches ${req.method} ${url.pathname}`));
    const { actor, viaCookie } = await options.resolveActor(req);
    if (!found.route.public && !actor) throw unauthorized();
    if (viaCookie && MUTATING.has(req.method)) {
      const origin = req.headers.get("origin");
      if (origin && origin !== options.appOrigin) throw forbidden("Requests from other sites are not allowed");
    }
    let parsed: unknown;
    let read = false;
    const call: Call = {
      db: options.db,
      req,
      params: found.params,
      query: url.searchParams,
      actor,
      request: {
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
        userAgent: req.headers.get("user-agent"),
      },
      async body(schema) {
        if (!read) {
          read = true;
          const text = await req.text();
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            throw invalid("The request body is not valid JSON");
          }
        }
        return schema.parse(parsed);
      },
    };
    const result = await found.route.handler(call);
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
