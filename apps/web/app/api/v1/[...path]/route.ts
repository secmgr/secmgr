import { appUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { handle } from "@/server/api/router";
import { buildRouter, type MemberApi } from "@/server/api/routes";
import { tokenActor } from "@/server/services/tokens";

export const dynamic = "force-dynamic";

const members: MemberApi = {
  async invite(req, { organizationId, email, role, resend }) {
    const invitation = await auth.api.createInvitation({
      headers: req.headers,
      body: { organizationId, email, role: role as "developer", resend },
    });
    return { id: invitation.id };
  },
  async cancelInvite(req, invitationId) {
    await auth.api.cancelInvitation({ headers: req.headers, body: { invitationId } });
  },
  async setRole(req, { organizationId, memberId, role }) {
    await auth.api.updateMemberRole({
      headers: req.headers,
      body: { organizationId, memberId, role: role as "developer" },
    });
  },
  async remove(req, { organizationId, memberId }) {
    await auth.api.removeMember({ headers: req.headers, body: { organizationId, memberIdOrEmail: memberId } });
  },
  async updateWorkspace(req, { organizationId, name, slug }) {
    await auth.api.updateOrganization({ headers: req.headers, body: { organizationId, data: { name, slug } } });
  },
  async deleteWorkspace(req, organizationId) {
    await auth.api.deleteOrganization({ headers: req.headers, body: { organizationId } });
  },
};

const router = buildRouter({ members, appUrl: appUrl() });

async function resolveActor(req: Request) {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return { actor: await tokenActor(db, header.slice(7).trim()), viaCookie: false };
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return { actor: null, viaCookie: true };
  return {
    actor: { kind: "user" as const, userId: session.user.id, name: session.user.name, email: session.user.email },
    viaCookie: true,
  };
}

const serve = (req: Request) => handle(req, { db, router, prefix: "/api/v1", appOrigin: appUrl(), resolveActor });

export { serve as DELETE, serve as GET, serve as PATCH, serve as POST, serve as PUT };
