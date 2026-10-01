const RESERVED = new Set([
  "_next",
  "admin",
  "api",
  "app",
  "dashboard",
  "docs",
  "help",
  "invite",
  "login",
  "logout",
  "new",
  "onboarding",
  "s",
  "security",
  "settings",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signup",
  "static",
  "two-factor",
  "www",
]);

export const SLUG_MAX = 40;

export function toSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

export function slugProblem(slug: string) {
  if (slug.length < 2) return "Use at least 2 characters";
  if (slug.length > SLUG_MAX) return `Use at most ${SLUG_MAX} characters`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Use lowercase letters, digits and single dashes";
  if (RESERVED.has(slug)) return "That URL is reserved. Try another";
  return null;
}
