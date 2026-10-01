import type { Snapshot } from "@/server/services/snapshot";

export type { Snapshot };

export class RequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new RequestError(0, "offline", "Could not reach the server. Check your connection and try again");
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const { code = "internal", message = "Something went wrong. Try again", ...details } = data.error ?? {};
    throw new RequestError(response.status, code, message, details);
  }
  return data as T;
}

const ws = (slug: string) => `/workspaces/${encodeURIComponent(slug)}`;

export type Change = {
  op: "add" | "edit" | "delete";
  key: string;
  newKey?: string;
  value?: string;
  note?: string;
  sensitive?: boolean;
  baseVersion?: number | null;
  rotated?: boolean;
  summary?: string;
};

export type Version = {
  version: number;
  summary: string;
  changeSetId: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  fingerprint: string;
  length: number;
  value?: string;
};

export type ActivityPage = {
  entries: {
    id: string;
    at: string;
    action: string;
    actor: string | null;
    actorKind: "member" | "token";
    actorName: string;
    projectId: string | null;
    envId: string | null;
    keys: string[];
    target: string | null;
    changeSetId: string | null;
    detail: Record<string, unknown>;
  }[];
  next: string | null;
  environments: Record<string, { name: string; projectName: string }>;
};

export const api = {
  snapshot: (slug: string) => request<Snapshot>("GET", `${ws(slug)}/snapshot`),
  renameWorkspace: (slug: string, input: { name?: string; slug?: string }) => request("PATCH", ws(slug), input),
  deleteWorkspace: (slug: string, confirm: string) => request("DELETE", ws(slug), { confirm }),
  activity: (slug: string, query: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1]));
    return request<ActivityPage>("GET", `${ws(slug)}/activity?${params}`);
  },
  dismissInsight: (slug: string, id: string, snoozeDays?: number) =>
    request("POST", `${ws(slug)}/insights/${encodeURIComponent(id)}/dismiss`, { snoozeDays: snoozeDays ?? null }),
  restoreInsight: (slug: string, id: string) =>
    request("DELETE", `${ws(slug)}/insights/${encodeURIComponent(id)}/dismiss`),
  createProject: (
    slug: string,
    input: {
      name: string;
      repo?: string | null;
      description?: string;
      environments?: { name: string; color?: string; protected?: boolean }[];
    },
  ) =>
    request<{ project: { id: string; name: string }; environments: { id: string; name: string }[] }>(
      "POST",
      `${ws(slug)}/projects`,
      input,
    ),
  updateProject: (
    id: string,
    input: { name?: string; description?: string; repo?: string | null; archived?: boolean },
  ) => request("PATCH", `/projects/${id}`, input),
  deleteProject: (id: string, confirm: string) => request("DELETE", `/projects/${id}`, { confirm }),
  star: (id: string, on: boolean) => request(on ? "PUT" : "DELETE", `/projects/${id}/star`),
  createEnvironment: (
    projectId: string,
    input: { name: string; color?: string; protected?: boolean; cloneFrom?: string | null },
  ) => request<{ environment: { id: string; name: string } }>("POST", `/projects/${projectId}/environments`, input),
  reorderEnvironments: (projectId: string, ids: string[]) =>
    request("PUT", `/projects/${projectId}/environment-order`, { ids }),
  updateEnvironment: (id: string, input: { name?: string; color?: string; protected?: boolean; confirm?: string }) =>
    request("PATCH", `/environments/${id}`, input),
  deleteEnvironment: (id: string, confirm: string) => request("DELETE", `/environments/${id}`, { confirm }),
  setAccess: (envId: string, memberId: string, access: "none" | "read" | "write" | null) =>
    request("PUT", `/environments/${envId}/access/${memberId}`, { access }),
  values: (envId: string) => request<{ values: Record<string, string> }>("GET", `/environments/${envId}/values`),
  saveChanges: (envId: string, input: { changes: Change[]; message?: string; confirm?: string; source?: string }) =>
    request<{ changeSetId: string; count: number }>("POST", `/environments/${envId}/changes`, input),
  revert: (envId: string, changeSetId: string, confirm?: string) =>
    request<{ changeSetId: string; count: number }>(
      "POST",
      `/environments/${envId}/change-sets/${changeSetId}/revert`,
      { confirm },
    ),
  changeSet: (envId: string, changeSetId: string) =>
    request<Record<string, unknown>>("GET", `/environments/${envId}/change-sets/${changeSetId}`),
  versions: (envId: string, secretId: string, withValues: boolean) =>
    request<{ versions: Version[] }>(
      "GET",
      `/environments/${envId}/secrets/${secretId}/versions${withValues ? "?values=1" : ""}`,
    ),
  setRotation: (envId: string, secretId: string, days: number | null) =>
    request("PUT", `/environments/${envId}/secrets/${secretId}/rotation`, { days }),
  createShare: (envId: string, secretId: string, input: { maxViews?: number; expiresInHours?: number }) =>
    request<{ id: string; url: string; expiresAt: string; maxViews: number }>(
      "POST",
      `/environments/${envId}/secrets/${secretId}/shares`,
      input,
    ),
  revokeShare: (slug: string, id: string) => request("DELETE", `${ws(slug)}/shares/${id}`),
  event: (
    envId: string,
    input: { action: "reveal" | "copy" | "export"; keys?: string[]; detail?: { format?: string; count?: number } },
  ) => request("POST", `/environments/${envId}/events`, input),
  createToken: (
    slug: string,
    input: { name: string; environmentId: string; access: "read" | "write"; expiresInDays?: number | null },
  ) =>
    request<{ token: { id: string; name: string; prefix: string; suffix: string }; secret: string }>(
      "POST",
      `${ws(slug)}/tokens`,
      input,
    ),
  rotateToken: (slug: string, id: string) =>
    request<{ token: { id: string; name: string; prefix: string; suffix: string }; secret: string }>(
      "POST",
      `${ws(slug)}/tokens/${id}/rotate`,
    ),
  revokeToken: (slug: string, id: string) => request("DELETE", `${ws(slug)}/tokens/${id}`),
  invite: (slug: string, input: { email: string; role: string; resend?: boolean }) =>
    request<{ id: string }>("POST", `${ws(slug)}/invitations`, input),
  cancelInvite: (slug: string, id: string) => request("DELETE", `${ws(slug)}/invitations/${id}`),
  setRole: (slug: string, memberId: string, role: string) =>
    request("PATCH", `${ws(slug)}/members/${memberId}`, { role }),
  removeMember: (slug: string, memberId: string) => request("DELETE", `${ws(slug)}/members/${memberId}`),
  preferences: (input: Record<string, unknown>) => request("PUT", "/me/preferences", input),
};
