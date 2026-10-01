import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Set up secmgr" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/onboarding");
  const workspaces = await auth.api.listOrganizations({ headers: await headers() });
  const adding = (await searchParams).new !== undefined;
  if (workspaces.length && !adding) redirect(`/${workspaces[0]!.slug}` as Route);
  return (
    <Onboarding
      email={session.user.email}
      host={new URL(appUrl()).host}
      back={workspaces[0] ? `/${workspaces[0].slug}` : null}
    />
  );
}
