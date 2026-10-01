import type { Metadata } from "next";
import { db } from "@/lib/db";
import { peekShare } from "@/server/services/shares";
import { ShareReveal } from "./share-reveal";

export const metadata: Metadata = { title: "A secret was shared with you", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SharePage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;
  const link = await peekShare(db, id);
  return (
    <ShareReveal
      id={id}
      open={!!link?.open}
      viewsLeft={link?.viewsLeft ?? 0}
      expiresAt={link?.expiresAt ? link.expiresAt.toISOString() : null}
    />
  );
}
