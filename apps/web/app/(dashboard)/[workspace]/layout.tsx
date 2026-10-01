import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardRoot } from "@/dashboard/DashboardRoot";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { workspaceContext } from "@/server/context";
import { ApiError } from "@/server/errors";
import { buildSnapshot } from "@/server/services/snapshot";

export default async function WorkspaceLayout({
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const session = await requireSession(`/${workspace}`);
  const actor = { kind: "user" as const, userId: session.user.id, name: session.user.name, email: session.user.email };
  const snapshot = await workspaceContext(db, actor, workspace)
    .then((ctx) => buildSnapshot(db, ctx))
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  return <DashboardRoot snapshot={snapshot} slug={workspace} />;
}
