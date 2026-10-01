import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { InviteCard } from "./invite-card";

export const metadata: Metadata = { title: "Join a workspace" };

const ROLE_NAMES: Record<string, string> = {
  owner: "an owner",
  admin: "an admin",
  developer: "a developer",
  viewer: "a viewer",
};

export default async function InvitePage({ params }: PageProps<"/invite/[id]">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/invite/${id}`)}`);
  try {
    const invitation = await auth.api.getInvitation({ headers: await headers(), query: { id } });
    return (
      <InviteCard
        state="open"
        id={id}
        email={session.user.email}
        workspace={invitation.organizationName}
        slug={invitation.organizationSlug}
        inviter={invitation.inviterEmail}
        role={ROLE_NAMES[invitation.role ?? ""] ?? "a member"}
      />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return (
      <InviteCard state={/recipient/i.test(message) ? "wrong-email" : "gone"} id={id} email={session.user.email} />
    );
  }
}
