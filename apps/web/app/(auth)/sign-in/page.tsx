import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { githubEnabled } from "@/lib/auth";
import { emailInTerminal } from "@/lib/email";
import { safeNext } from "@/lib/next-path";
import { getSession } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error, next } = await searchParams;
  const destination = safeNext(next);
  if (await getSession()) redirect(destination);
  return (
    <SignInForm
      github={githubEnabled}
      emailInTerminal={emailInTerminal}
      error={typeof error === "string" ? error : null}
      next={destination}
      host={appUrl()}
    />
  );
}
