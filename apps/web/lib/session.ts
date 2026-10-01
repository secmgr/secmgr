import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireSession(next?: string) {
  const session = await getSession();
  if (!session) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return session;
}
