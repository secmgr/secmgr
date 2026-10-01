import * as React from "react";

const own = (obj, key) => !!obj && Object.hasOwn(obj, key);

export function fingerprint(value) {
  if (value == null) return "";
  const s = String(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 4);
}

function tokenize(s) {
  return String(s == null ? "" : s).match(/[A-Za-z0-9]+|[^A-Za-z0-9]/g) || [];
}

function pushSeg(list, text, changed) {
  const last = list[list.length - 1];
  if (last && last.changed === changed) last.text += text;
  else list.push({ text, changed });
}

function affixDiff(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const mk = (x) => {
    const out = [];
    if (p) out.push({ text: x.slice(0, p), changed: false });
    if (x.length - p - s > 0) out.push({ text: x.slice(p, x.length - s), changed: true });
    if (s) out.push({ text: x.slice(x.length - s), changed: false });
    return out;
  };
  return { base: mk(a), compare: mk(b) };
}

export function diffSegments(a, b) {
  const sa = String(a == null ? "" : a);
  const sb = String(b == null ? "" : b);
  if (sa === sb)
    return { base: sa ? [{ text: sa, changed: false }] : [], compare: sb ? [{ text: sb, changed: false }] : [] };
  const A = tokenize(sa);
  const B = tokenize(sb);
  if (A.length * B.length > 90000) return affixDiff(sa, sb);
  const n = A.length;
  const m = B.length;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const base = [];
  const compare = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      pushSeg(base, A[i], false);
      pushSeg(compare, B[j], false);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSeg(base, A[i], true);
      i++;
    } else {
      pushSeg(compare, B[j], true);
      j++;
    }
  }
  while (i < n) pushSeg(base, A[i++], true);
  while (j < m) pushSeg(compare, B[j++], true);
  return { base, compare };
}

export function diffEnvs(base, compare) {
  const b = base || {};
  const c = compare || {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(c)])).sort();
  return keys.map((key) => {
    const inB = own(b, key);
    const inC = own(c, key);
    const status = !inC ? "removed" : !inB ? "added" : b[key] === c[key] ? "same" : "changed";
    return { key, status, base: inB ? b[key] : undefined, compare: inC ? c[key] : undefined };
  });
}

export function diffCounts(rows) {
  const out = { changed: 0, added: 0, removed: 0, same: 0 };
  for (const r of rows) out[r.status] = (out[r.status] || 0) + 1;
  return out;
}

export function envName(env) {
  if (!env) return "";
  return typeof env === "string" ? env : env.name;
}

export function matrixRows(envs, values, reference) {
  const names = envs.map(envName);
  const ref = reference && names.includes(reference) ? reference : names[0];
  const keys = new Set();
  for (const nme of names) for (const k of Object.keys(values?.[nme] || {})) keys.add(k);
  return Array.from(keys)
    .sort()
    .map((key) => {
      const refMap = values?.[ref] || {};
      const refHas = own(refMap, key);
      const refVal = refHas ? refMap[key] : undefined;
      const cells = {};
      const seen = new Set();
      let missing = 0;
      let differs = 0;
      for (const nme of names) {
        const map = values?.[nme] || {};
        if (!own(map, key)) {
          cells[nme] = { state: "missing" };
          missing++;
          continue;
        }
        const v = map[key];
        seen.add(v);
        const fp = fingerprint(v);
        let state;
        if (nme === ref) state = "reference";
        else if (!refHas) state = "present";
        else if (v === refVal) state = "same";
        else {
          state = "differs";
          differs++;
        }
        cells[nme] = { state, value: v, fingerprint: fp, empty: v === "" };
      }
      return { key, cells, missing, differs, hasDifference: missing > 0 || seen.size > 1 };
    });
}

export function prefixOf(key) {
  const i = key.indexOf("_");
  return i > 0 ? key.slice(0, i + 1) : "";
}

export function groupByPrefix(keys, min = 2) {
  const counts = {};
  for (const k of keys) {
    const p = prefixOf(k);
    if (p) counts[p] = (counts[p] || 0) + 1;
  }
  const out = [];
  const byPrefix = {};
  for (const k of keys) {
    const p = prefixOf(k);
    if (p && counts[p] >= min) {
      if (!byPrefix[p]) {
        byPrefix[p] = { type: "group", prefix: p, keys: [] };
        out.push(byPrefix[p]);
      }
      byPrefix[p].keys.push(k);
    } else out.push({ type: "key", key: k });
  }
  return out;
}

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

export function keyProblem(key) {
  if (!key) return "the line has no key";
  if (/^[0-9]/.test(key)) return "keys cannot start with a digit";
  if (/\s/.test(key)) return "keys cannot contain spaces";
  if (!KEY_RE.test(key)) return "keys use A to Z, digits and underscores only";
  return null;
}

export function classifyImport(entries, existing) {
  const cur = existing || {};
  const list = (entries || []).map((e, i) => ({ ...e, line: e.line != null ? e.line : i + 1 }));
  const lastLine = {};
  for (const e of list) {
    const problem = e.error || e.reason || keyProblem(e.key);
    if (!problem) lastLine[e.key] = e.line;
  }
  return list.map((e) => {
    const problem = e.error || e.reason || keyProblem(e.key);
    const base = { id: String(e.line), line: e.line, key: e.key, value: e.value };
    if (problem) return { ...base, status: "invalid", reason: problem };
    if (lastLine[e.key] !== e.line) return { ...base, status: "duplicate", otherLine: lastLine[e.key] };
    if (!own(cur, e.key)) return { ...base, status: "new" };
    if (cur[e.key] === e.value) return { ...base, status: "unchanged", current: cur[e.key] };
    return { ...base, status: "changed", current: cur[e.key] };
  });
}

export function statusCounts(rows) {
  const out = { new: 0, changed: 0, unchanged: 0, invalid: 0, duplicate: 0 };
  for (const r of rows) out[r.status] = (out[r.status] || 0) + 1;
  return out;
}

export function useRovingRows(containerRef, selector) {
  const { useCallback } = React;
  return useCallback(
    (e) => {
      const root = containerRef.current;
      if (!root) return null;
      const items = Array.from(root.querySelectorAll(selector));
      const idx = items.indexOf(document.activeElement);
      if (idx < 0) return null;
      let next = -1;
      if (e.key === "ArrowDown" || e.key === "j") next = Math.min(items.length - 1, idx + 1);
      else if (e.key === "ArrowUp" || e.key === "k") next = Math.max(0, idx - 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      if (next < 0) return null;
      e.preventDefault();
      items[next].focus();
      return items[next];
    },
    [containerRef, selector],
  );
}

export function entriesFromParsed(parsed) {
  if (!parsed) return [];
  const ok = (parsed.entries || []).map((e) => ({ line: e.line, key: e.key, value: e.value }));
  const bad = (parsed.errors || []).map((e) => {
    const own = e.key ? keyProblem(e.key) : null;
    const msg = String(e.message || "this line could not be parsed");
    return {
      line: e.line,
      key:
        e.key ||
        String(e.raw || "")
          .trim()
          .split(/[\s=]/)[0] ||
        "",
      value: e.value || "",
      error: own || msg.charAt(0).toLowerCase() + msg.slice(1),
    };
  });
  return ok.concat(bad).sort((a, b) => a.line - b.line);
}
