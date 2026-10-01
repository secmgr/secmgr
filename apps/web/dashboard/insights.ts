const DAY = 86_400_000;

type Env = { id: string; projectId: string; name: string; order: number };
type Secret = {
  id: string;
  projectId: string;
  envId: string;
  key: string;
  sensitive: boolean;
  fingerprint: string | null;
  length: number;
  looksLive: boolean;
  refs: string[];
  rotateEveryDays: number | null;
  lastRotatedAt: string | null;
};

export type Insight = {
  id: string;
  severity: "danger" | "warning" | "info";
  kind: "missing" | "live-key" | "rotation" | "empty" | "shared" | "reference";
  title: string;
  description: string;
  keys: string[];
  envs: string[];
  fix: string;
};

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ORDER = { danger: 0, warning: 1, info: 2 };

export function insightsFor(projectId: string, environments: Env[], secrets: Secret[], now = Date.now()): Insight[] {
  const envs = environments.filter((e) => e.projectId === projectId).sort((a, b) => a.order - b.order);
  const out: Insight[] = [];
  const byKey = new Map<string, Map<string, Secret>>();
  const keysIn = new Map<string, Set<string>>();
  for (const s of secrets) {
    if (s.projectId !== projectId) continue;
    if (!byKey.has(s.key)) byKey.set(s.key, new Map());
    byKey.get(s.key)!.set(s.envId, s);
    if (!keysIn.has(s.envId)) keysIn.set(s.envId, new Set());
    keysIn.get(s.envId)!.add(s.key);
  }
  const prod = envs.find((e) => e.name === "production");
  for (const [key, map] of byKey) {
    const present = envs.filter((e) => map.has(e.id));
    if (prod && !map.has(prod.id) && present.length >= 2) {
      out.push({
        id: `missing:${projectId}:${key}`,
        severity: "warning",
        kind: "missing",
        title: `${key} is missing in production`,
        description: `It exists in ${present.map((e) => e.name).join(", ")}. Deploys that read it will fall back to their default.`,
        keys: [key],
        envs: [prod.id],
        fix: "Add to production",
      });
    }
    for (const e of envs) {
      const s = map.get(e.id);
      if (!s) continue;
      if (e.name !== "production" && s.looksLive) {
        out.push({
          id: `live:${e.id}:${key}`,
          severity: "danger",
          kind: "live-key",
          title: `${title(e.name)} uses a live key`,
          description: `${key} in ${e.name} is a live key. Anything run against ${e.name} can reach real customers or move real money.`,
          keys: [key],
          envs: [e.id],
          fix: "Rotate key",
        });
      }
      if (s.rotateEveryDays && s.lastRotatedAt) {
        const days = Math.floor((now - new Date(s.lastRotatedAt).getTime()) / DAY);
        if (days > s.rotateEveryDays) {
          out.push({
            id: `rotate:${e.id}:${key}`,
            severity: "warning",
            kind: "rotation",
            title: `${key} has not been rotated in ${days} days`,
            description: `The policy for this key is every ${s.rotateEveryDays} days, in ${e.name}.`,
            keys: [key],
            envs: [e.id],
            fix: "Rotate now",
          });
        }
      }
      if (s.length === 0 && s.fingerprint) {
        out.push({
          id: `empty:${e.id}:${key}`,
          severity: "info",
          kind: "empty",
          title: `${key} is empty in ${e.name}`,
          description: "An empty value usually means a step was skipped during setup.",
          keys: [key],
          envs: [e.id],
          fix: "Set value",
        });
      }
      const missingRefs = s.refs.filter((r) => !keysIn.get(e.id)?.has(r));
      if (missingRefs.length) {
        out.push({
          id: `ref:${e.id}:${key}`,
          severity: "warning",
          kind: "reference",
          title: `${key} refers to ${missingRefs.map((r) => `\${${r}}`).join(", ")}, which is not in ${e.name}`,
          description: `The reference resolves to an empty string when ${e.name} is loaded.`,
          keys: [key, ...missingRefs],
          envs: [e.id],
          fix: "Add the missing key",
        });
      }
    }
    const prodSecret = prod ? map.get(prod.id) : undefined;
    if (prod && prodSecret?.sensitive && prodSecret.fingerprint && prodSecret.length > 0) {
      const same = envs.filter((e) => e.id !== prod.id && map.get(e.id)?.fingerprint === prodSecret.fingerprint);
      if (same.length) {
        out.push({
          id: `same:${projectId}:${key}`,
          severity: "danger",
          kind: "shared",
          title: `${key} is identical in ${same.map((e) => e.name).join(" and ")} and production`,
          description:
            "A secret shared with production leaks production access to everyone who can read the other environment.",
          keys: [key],
          envs: [...same.map((e) => e.id), prod.id],
          fix: "Review",
        });
      }
    }
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
