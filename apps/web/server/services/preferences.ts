import { type Database, dismissedInsights, userPreferences } from "@secmgr/db";
import { and, eq } from "drizzle-orm";
import { type Context, requireUser } from "../context.ts";
import { invalid } from "../errors.ts";

export type Preferences = {
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  revealTimeoutSec: number;
  clipboardClearSec: number;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  density: "comfortable",
  revealTimeoutSec: 10,
  clipboardClearSec: 30,
};

export async function getPreferences(db: Database, userId: string): Promise<Preferences> {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  if (!row) return DEFAULT_PREFERENCES;
  return {
    theme: row.theme,
    density: row.density,
    revealTimeoutSec: row.revealTimeoutSec,
    clipboardClearSec: row.clipboardClearSec,
  };
}

export async function setPreferences(db: Database, userId: string, patch: Partial<Preferences>) {
  const next = { ...(await getPreferences(db, userId)), ...patch };
  if (!["light", "dark", "system"].includes(next.theme)) throw invalid("Theme is light, dark or system");
  if (!["comfortable", "compact"].includes(next.density)) throw invalid("Density is comfortable or compact");
  for (const field of ["revealTimeoutSec", "clipboardClearSec"] as const) {
    const value = next[field];
    if (!Number.isInteger(value) || value < 0 || value > 300) throw invalid("Timeouts are between 0 and 300 seconds");
  }
  await db
    .insert(userPreferences)
    .values({ userId, ...next })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...next, updatedAt: new Date() } });
  return next;
}

export async function dismissInsight(db: Database, ctx: Context, insightId: string, snoozeDays?: number | null) {
  const actor = requireUser(ctx);
  if (!/^[\w:.-]{1,300}$/.test(insightId)) throw invalid("That insight id is not valid");
  if (snoozeDays != null && (!Number.isInteger(snoozeDays) || snoozeDays < 1 || snoozeDays > 365)) {
    throw invalid("Snooze for 1 to 365 days");
  }
  const snoozedUntil = snoozeDays ? new Date(Date.now() + snoozeDays * 86_400_000) : null;
  await db
    .insert(dismissedInsights)
    .values({ organizationId: ctx.workspace.id, insightId, dismissedBy: actor.userId, snoozedUntil })
    .onConflictDoUpdate({
      target: [dismissedInsights.organizationId, dismissedInsights.insightId],
      set: { dismissedBy: actor.userId, dismissedAt: new Date(), snoozedUntil },
    });
}

export async function restoreInsight(db: Database, ctx: Context, insightId: string) {
  requireUser(ctx);
  await db
    .delete(dismissedInsights)
    .where(and(eq(dismissedInsights.organizationId, ctx.workspace.id), eq(dismissedInsights.insightId, insightId)));
}
