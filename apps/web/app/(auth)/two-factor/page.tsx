import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/next-path";
import { getSession } from "@/lib/session";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Two factor" };

export default async function TwoFactorPage({ searchParams }: PageProps<"/two-factor">) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  const jar = await cookies();
  const pending = jar.getAll().some((c) => c.name.endsWith("secmgr.two_factor"));
  if (!pending) redirect("/sign-in?error=two_factor");
  return <TwoFactorForm next={next} />;
}
