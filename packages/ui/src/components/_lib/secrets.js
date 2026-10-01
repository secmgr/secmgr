export const KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
export const DOTENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const MASK_LENGTH = 12;
export const MASK = "\u2022".repeat(MASK_LENGTH);
const REF_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function normalizeKey(raw) {
  let out = "";
  for (const ch of String(raw == null ? "" : raw)) {
    if (ch >= "a" && ch <= "z") out += ch.toUpperCase();
    else if ((ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch === "_") out += ch;
    else if (ch === " " || ch === "-" || ch === ".") out += "_";
  }
  return out;
}

export function validateKey(key, { existingKeys = [], env, original } = {}) {
  const k = String(key == null ? "" : key);
  if (!k) return { code: "empty", message: "Enter a key, for example DATABASE_URL." };
  if (/^[0-9]/.test(k)) return { code: "digit", message: "Start the key with a letter or an underscore." };
  if (!KEY_PATTERN.test(k)) return { code: "invalid", message: "Use A to Z, digits and underscores only." };
  if (k !== original && existingKeys.indexOf(k) >= 0) {
    return { code: "duplicate", message: env ? `${k} already exists in ${env}.` : `${k} already exists.` };
  }
  return null;
}

export function splitReferences(value) {
  const s = String(value == null ? "" : value);
  const out = [];
  let last = 0;
  REF_RE.lastIndex = 0;
  let m;
  for (m = REF_RE.exec(s); m; m = REF_RE.exec(s)) {
    if (m.index > last) out.push({ type: "text", text: s.slice(last, m.index) });
    out.push({ type: "ref", text: m[0], key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", text: s.slice(last) });
  return out;
}

export function findReferences(value) {
  return splitReferences(value)
    .filter((t) => t.type === "ref")
    .map((t) => t.key);
}

export function generateSecretValue(bytes = 32) {
  const buf = new Uint8Array(bytes);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function groupSecrets(secrets, { by, minSize = 2, otherLabel = "Other" } = {}) {
  const prefixOf =
    by ||
    ((s) => {
      const i = String(s.key || "").indexOf("_");
      return i > 0 ? s.key.slice(0, i + 1) : null;
    });
  const buckets = new Map();
  for (const s of secrets) {
    const p = prefixOf(s);
    if (!buckets.has(p)) buckets.set(p, []);
    buckets.get(p).push(s);
  }
  const groups = [];
  const rest = [];
  for (const [p, items] of buckets) {
    if (p && items.length >= minSize) groups.push({ id: p, label: p, items });
    else rest.push(...items);
  }
  groups.sort((a, b) => a.label.localeCompare(b.label));
  if (rest.length) groups.push({ id: "__other", label: otherLabel, items: rest, other: true });
  return groups;
}

export function firstName(person) {
  if (!person) return "";
  const name = typeof person === "string" ? person : person.name || "";
  return name.split(/\s+/)[0];
}

export function formatWhen(when, now) {
  if (when == null || when === "") return "";
  if (typeof when === "string" && !/^\d{4}-\d{2}-\d{2}/.test(when)) return when;
  const t = when instanceof Date ? when.getTime() : typeof when === "number" ? when : Date.parse(when);
  if (Number.isNaN(t)) return String(when);
  const ref = now == null ? Date.now() : now instanceof Date ? now.getTime() : now;
  const s = Math.round((ref - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const d = new Date(t);
  const r = new Date(ref);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dayMs = 86400000;
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(r) - startOf(d)) / dayMs);
  if (diffDays === 0) return `today at ${hm}`;
  if (diffDays === 1) return `yesterday at ${hm}`;
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== r.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

function scanQuoted(text, from, q) {
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && q !== "'") {
      i++;
      continue;
    }
    if (ch === q) return i;
  }
  return -1;
}

function unescapeDouble(s) {
  return s.replace(/\\([nrt"\\$`])/g, (_m, c) => (c === "n" ? "\n" : c === "r" ? "\r" : c === "t" ? "\t" : c));
}

function valueTokens(s, withRefs) {
  if (!s) return [];
  if (!withRefs) return [{ t: "value", s }];
  return splitReferences(s).map((p) => ({ t: p.type === "ref" ? "ref" : "value", s: p.text, key: p.key }));
}

function trailingTokens(s) {
  if (!s) return [];
  const m = /^(\s*)(#.*)?(.*)$/.exec(s);
  const out = [];
  if (m[1]) out.push({ t: "space", s: m[1] });
  if (m[2]) out.push({ t: "comment", s: m[2] });
  if (m[3]) out.push({ t: "error", s: m[3] });
  return out;
}

export function parseDotenv(text) {
  const src = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  const raw = src.split("\n");
  const lines = raw.map((r, i) => ({
    n: i + 1,
    text: r,
    kind: "blank",
    tokens: r ? [{ t: "space", s: r }] : [],
    issue: null,
  }));
  const entries = [];
  const errors = [];
  const fail = (idx, code, message, extra) => {
    lines[idx].kind = "invalid";
    lines[idx].issue = { level: "error", code, message };
    errors.push({ line: idx + 1, code, message, raw: raw[idx], ...extra });
  };
  let i = 0;
  while (i < raw.length) {
    const L = raw[i];
    const trimmed = L.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed[0] === "#") {
      lines[i].kind = "comment";
      lines[i].tokens = [{ t: "comment", s: L }];
      i++;
      continue;
    }
    const tokens = [];
    const lead = /^\s*/.exec(L)[0];
    if (lead) tokens.push({ t: "space", s: lead });
    let pos = lead.length;
    let exported = false;
    const ex = /^export\s+/.exec(L.slice(pos));
    if (ex && L.indexOf("=", pos + ex[0].length) >= 0) {
      exported = true;
      tokens.push({ t: "keyword", s: ex[0] });
      pos += ex[0].length;
    }
    const eq = L.indexOf("=", pos);
    lines[i].kind = "entry";
    if (eq < 0) {
      tokens.push({ t: "error", s: L.slice(pos) });
      lines[i].tokens = tokens;
      const word = L.slice(pos).trim().split(/\s+/)[0];
      fail(
        i,
        "missing-equals",
        `No "=" on this line. Write it as ${DOTENV_KEY_PATTERN.test(word) ? word : "KEY"}=value.`,
      );
      i++;
      continue;
    }
    const keyRaw = L.slice(pos, eq);
    const key = keyRaw.trim();
    const keyPad = keyRaw.slice(key.length + (keyRaw.length - keyRaw.trimStart().length));
    const keyLead = keyRaw.slice(0, keyRaw.length - keyRaw.trimStart().length);
    if (keyLead) tokens.push({ t: "space", s: keyLead });
    let keyError = null;
    if (!key) keyError = { code: "empty-key", message: "This line has a value but no key." };
    else if (/^[0-9]/.test(key))
      keyError = {
        code: "invalid-key",
        message: `${key} starts with a digit. Start keys with a letter or an underscore.`,
      };
    else if (!DOTENV_KEY_PATTERN.test(key))
      keyError = { code: "invalid-key", message: `${key} is not a valid key. Use letters, digits and underscores.` };
    tokens.push({ t: keyError ? "key-error" : "key", s: key });
    if (keyPad) tokens.push({ t: "space", s: keyPad });
    tokens.push({ t: "punct", s: "=" });
    let rest = L.slice(eq + 1);
    const vlead = /^[ \t]*/.exec(rest)[0];
    if (vlead) tokens.push({ t: "space", s: vlead });
    rest = rest.slice(vlead.length);
    const q = rest[0];
    let value = "";
    let quote = null;
    let comment = null;
    let endIdx = i;
    if (q === '"' || q === "'" || q === "`") {
      quote = q;
      const close = scanQuoted(rest, 1, q);
      if (close >= 0) {
        const inner = rest.slice(1, close);
        tokens.push({ t: "quote", s: q }, ...valueTokens(inner, q !== "'"), { t: "quote", s: q });
        const tail = trailingTokens(rest.slice(close + 1));
        tokens.push(...tail);
        const c = tail.find((x) => x.t === "comment");
        if (c) comment = c.s.replace(/^#\s?/, "");
        value = q === '"' ? unescapeDouble(inner) : inner;
        lines[i].tokens = tokens;
      } else {
        let j = i + 1;
        let found = -1;
        for (; j < raw.length; j++) {
          found = scanQuoted(raw[j], 0, q);
          if (found >= 0) break;
        }
        if (found < 0) {
          tokens.push({ t: "quote", s: q }, { t: "error", s: rest.slice(1) });
          lines[i].tokens = tokens;
          fail(
            i,
            "unclosed-quote",
            `The quote after ${key || "the key"} is never closed. Add a closing ${q} to end the value.`,
            { key },
          );
          i++;
          continue;
        }
        tokens.push({ t: "quote", s: q }, ...valueTokens(rest.slice(1), q !== "'"));
        lines[i].tokens = tokens;
        const parts = [rest.slice(1)];
        for (let k = i + 1; k < j; k++) {
          lines[k].kind = "continuation";
          lines[k].tokens = valueTokens(raw[k], q !== "'");
          parts.push(raw[k]);
        }
        const lastLine = raw[j];
        parts.push(lastLine.slice(0, found));
        const tail = trailingTokens(lastLine.slice(found + 1));
        lines[j].kind = "continuation";
        lines[j].tokens = [...valueTokens(lastLine.slice(0, found), q !== "'"), { t: "quote", s: q }, ...tail];
        const c = tail.find((x) => x.t === "comment");
        if (c) comment = c.s.replace(/^#\s?/, "");
        const joined = parts.join("\n");
        value = q === '"' ? unescapeDouble(joined) : joined;
        endIdx = j;
      }
    } else {
      const m = /\s#/.exec(rest);
      const body = m ? rest.slice(0, m.index) : rest;
      const val = body.replace(/\s+$/, "");
      tokens.push(...valueTokens(val, true));
      const after = rest.slice(val.length);
      if (after) {
        const sp = /^\s*/.exec(after)[0];
        if (sp) tokens.push({ t: "space", s: sp });
        if (after.length > sp.length) {
          tokens.push({ t: "comment", s: after.slice(sp.length) });
          comment = after.slice(sp.length).replace(/^#\s?/, "");
        }
      }
      value = val;
      lines[i].tokens = tokens;
    }
    if (keyError) {
      fail(i, keyError.code, keyError.message, { key, value });
    } else {
      entries.push({ key, value, line: i + 1, endLine: endIdx + 1, quote, exported, comment, duplicate: false });
    }
    i = endIdx + 1;
  }
  const byKey = new Map();
  for (const e of entries) {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e);
  }
  const duplicates = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    duplicates.push({ key, lines: list.map((e) => e.line) });
    const winner = list[list.length - 1];
    for (const e of list) {
      e.duplicate = true;
      const others = list.filter((x) => x !== e).map((x) => x.line);
      const message =
        e === winner
          ? `${key} is also set on line ${others.join(", ")}. This line wins.`
          : `${key} is set again on line ${winner.line}, which wins.`;
      const ln = lines[e.line - 1];
      if (!ln.issue) ln.issue = { level: "warning", code: "duplicate", message };
    }
  }
  return {
    entries,
    errors,
    duplicates,
    lines,
    keys: byKey.size,
    issues: lines.filter((l) => l.issue).length,
  };
}

export function looksLikeDotenv(text) {
  const s = String(text || "");
  if (!/\n/.test(s.trim())) return null;
  const parsed = parseDotenv(s);
  return parsed.entries.length ? parsed : null;
}

export function parsePair(text) {
  const s = String(text || "").trim();
  if (!s || /\n/.test(s)) return null;
  const parsed = parseDotenv(s);
  if (parsed.entries.length === 1) return { key: parsed.entries[0].key, value: parsed.entries[0].value };
  const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.\- ]*?)\s*=(.*)$/.exec(s);
  return m ? { key: m[1], value: m[2].trim() } : null;
}

export function isTextField(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return !/^(checkbox|radio|button|submit|reset|range|color|file)$/i.test(el.type);
}
