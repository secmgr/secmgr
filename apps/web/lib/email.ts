type Email = { to: string; subject: string; text: string; html: string };

export const emailInTerminal = !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production";

export async function sendEmail(email: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!emailInTerminal) throw new Error("RESEND_API_KEY is not set, so secmgr cannot send email");
    console.info(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n\n${email.text}\n`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "secmgr <auth@mail.secmgr.xyz>",
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) throw new Error(`Resend refused the email: ${response.status} ${await response.text()}`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function signInEmail(url: string) {
  const lines = [
    "Use this link to sign in to secmgr. It works once and expires in 5 minutes.",
    "If you did not ask to sign in, you can ignore this email.",
  ];
  return {
    subject: "Sign in to secmgr",
    text: `${lines[0]}\n\n${url}\n\n${lines[1]}`,
    html: `<p>${lines[0]}</p><p><a href="${escapeHtml(url)}">Sign in to secmgr</a></p><p>${lines[1]}</p>`,
  };
}

const ROLE_NAMES: Record<string, string> = {
  owner: "an owner",
  admin: "an admin",
  developer: "a developer",
  viewer: "a viewer",
};

export function invitationEmail({
  url,
  workspace,
  inviter,
  role,
}: {
  url: string;
  workspace: string;
  inviter: string;
  role: string;
}) {
  const lead = `${inviter} invited you to join ${workspace} on secmgr as ${ROLE_NAMES[role] ?? role}.`;
  const tail = "The invitation expires in 48 hours. If you were not expecting it, you can ignore this email.";
  return {
    subject: `Join ${workspace} on secmgr`,
    text: `${lead}\n\n${url}\n\n${tail}`,
    html: `<p>${escapeHtml(lead)}</p><p><a href="${escapeHtml(url)}">Accept the invitation</a></p><p>${tail}</p>`,
  };
}
