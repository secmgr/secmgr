import { schema } from "@secmgr/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { appUrl } from "./app-url";
import { db } from "./db";
import { invitationEmail, sendEmail, signInEmail } from "./email";
import { ac, roles } from "./permissions";
import { slugProblem } from "./slug";

const githubId = process.env.GITHUB_CLIENT_ID;
const githubSecret = process.env.GITHUB_CLIENT_SECRET;

export const githubEnabled = Boolean(githubId && githubSecret);

const SECOND_STEP_PATHS = new Set(["/magic-link/verify", "/callback/:id"]);
const SECOND_STEP_MAX_AGE = 600;

function localPath(value: unknown) {
  if (typeof value !== "string") return "/";
  let path = value;
  try {
    const url = new URL(decodeURIComponent(value), appUrl());
    if (url.origin !== new URL(appUrl()).origin) return "/";
    path = `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

const requireSecondStep = createAuthMiddleware(async (ctx) => {
  if (!SECOND_STEP_PATHS.has(ctx.path)) return;
  const created = ctx.context.newSession;
  if (!created || !(created.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) return;
  deleteSessionCookie(ctx, true);
  await ctx.context.internalAdapter.deleteSession(created.session.token);
  ctx.context.setNewSession(null);
  const cookie = ctx.context.createAuthCookie("two_factor", { maxAge: SECOND_STEP_MAX_AGE });
  const identifier = `2fa-${generateRandomString(20)}`;
  const expiresAt = new Date(Date.now() + SECOND_STEP_MAX_AGE * 1000);
  await ctx.context.internalAdapter.createVerificationValue({ value: created.user.id, identifier, expiresAt });
  await ctx.context.internalAdapter.createVerificationValue({
    value: "0",
    identifier: `2fa-attempts-${identifier}`,
    expiresAt,
  });
  await ctx.setSignedCookie(cookie.name, identifier, ctx.context.secret, cookie.attributes);
  const next = ctx.path === "/magic-link/verify" ? localPath(ctx.query?.callbackURL) : "/";
  throw ctx.redirect(`${appUrl()}/two-factor?next=${encodeURIComponent(next)}`);
});

function checkSlug(slug: unknown) {
  if (typeof slug !== "string") return;
  const problem = slugProblem(slug);
  if (problem) throw new APIError("BAD_REQUEST", { message: problem });
}

export const auth = betterAuth({
  appName: "secmgr",
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: githubEnabled ? { github: { clientId: githubId!, clientSecret: githubSecret! } } : {},
  rateLimit: { storage: "database" },
  advanced: { cookiePrefix: "secmgr" },
  telemetry: { enabled: false },
  hooks: { after: requireSecondStep },
  plugins: [
    magicLink({
      sendMagicLink: ({ email, url }) => sendEmail({ to: email, ...signInEmail(url) }),
    }),
    organization({
      ac,
      roles,
      creatorRole: "owner",
      invitationExpiresIn: 48 * 3600,
      sendInvitationEmail: async ({ id, email, role, organization: workspace, inviter }) =>
        sendEmail({
          to: email,
          ...invitationEmail({
            url: `${appUrl()}/invite/${id}`,
            workspace: workspace.name,
            inviter: inviter.user.name || inviter.user.email,
            role,
          }),
        }),
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => checkSlug(organization.slug),
        beforeUpdateOrganization: async ({ organization }) => checkSlug(organization.slug),
      },
    }),
    twoFactor({ issuer: "secmgr", allowPasswordless: true }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
