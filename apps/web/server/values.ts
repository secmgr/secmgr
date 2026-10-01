export const KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
export const KEY_MAX = 128;
export const VALUE_MAX = 64 * 1024;
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const LIVE_KEY = /(^|[^A-Za-z0-9])(sk|rk|pk)_live_/;
const REFERENCE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

export function keyProblem(key: string) {
  if (!key) return "Enter a key";
  if (key.length > KEY_MAX) return `Keys can be at most ${KEY_MAX} characters`;
  if (/^[0-9]/.test(key)) return "Keys cannot start with a digit";
  if (!KEY_PATTERN.test(key)) return "Use A to Z, digits and underscores";
  return null;
}

export function describeValue(value: string) {
  return {
    valueLength: value.length,
    looksLive: LIVE_KEY.test(value),
    refs: [...new Set(Array.from(value.matchAll(REFERENCE), (m) => m[1]!))].sort(),
  };
}
