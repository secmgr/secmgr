import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Home } from "@/home/Home.jsx";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "secmgr: the open source secret manager for teams" },
  description: "Projects, environments and every value in them. Encrypted, compared, and one command away.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    const workspaces = await auth.api.listOrganizations({ headers: await headers() });
    const active = workspaces.find((w) => w.id === session.session.activeOrganizationId) ?? workspaces[0];
    redirect(active ? (`/${active.slug}` as Route) : "/onboarding");
  }
  return <Home />;
}
