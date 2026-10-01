export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "conflict"
  | "confirm_required"
  | "gone"
  | "rate_limited";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = (message = "Sign in to continue") => new ApiError(401, "unauthorized", message);
export const forbidden = (message: string) => new ApiError(403, "forbidden", message);
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} was not found`);
export const invalid = (message: string, details?: Record<string, unknown>) =>
  new ApiError(400, "invalid", message, details);
export const conflict = (message: string, details?: Record<string, unknown>) =>
  new ApiError(409, "conflict", message, details);
export const confirmRequired = (message: string) => new ApiError(428, "confirm_required", message);
export const gone = (message: string) => new ApiError(410, "gone", message);

export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    if (typeof e === "object" && (e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
