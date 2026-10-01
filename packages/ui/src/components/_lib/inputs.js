import { useCallback, useEffect, useRef, useState } from "react";
export function mergeRefs(...refs) {
  return (el) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(el);
      else r.current = el;
    }
  };
}

export function useMergedRef(...refs) {
  return useCallback(mergeRefs(...refs), refs);
}

export function setNativeValue(el, value) {
  if (!el) return;
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc.set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function useValueState(value, defaultValue) {
  const [inner, setInner] = useState(defaultValue == null ? "" : String(defaultValue));
  const controlled = value !== undefined;
  const current = controlled ? (value == null ? "" : String(value)) : inner;
  return [current, setInner, controlled];
}

export function useDebouncedCallback(fn, ms) {
  const saved = useRef(fn);
  const timer = useRef(null);
  saved.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      if (!ms) {
        saved.current(...args);
        return;
      }
      timer.current = setTimeout(() => saved.current(...args), ms);
    },
    [ms],
  );
}

export function hashString(s) {
  let h = 2166136261;
  const str = String(s || "")
    .toLowerCase()
    .trim();
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function initialsOf(name, count = 2) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const words = base.split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return "";
  if (count === 1) return words[0][0].toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function usePresence(open, exitMs = 80) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState(open ? "open" : "closed");
  useEffect(() => {
    if (open) {
      setMounted(true);
      setState("open");
      return undefined;
    }
    setState("closed");
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: mounted || open, state: open ? "open" : state };
}

export function stepIndex(count, from, delta, isDisabled, wrap = true) {
  if (!count) return -1;
  let i = from;
  for (let k = 0; k < count; k++) {
    i += delta;
    if (i < 0 || i >= count) {
      if (!wrap) return from;
      i = (i + count) % count;
    }
    if (!isDisabled(i)) return i;
  }
  return from;
}

export function firstEnabled(count, isDisabled, fromEnd = false) {
  for (let k = 0; k < count; k++) {
    const i = fromEnd ? count - 1 - k : k;
    if (!isDisabled(i)) return i;
  }
  return -1;
}

export function useTypeahead(timeout = 500) {
  const buf = useRef("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(
    (key) => {
      clearTimeout(timer.current);
      buf.current += key.toLowerCase();
      timer.current = setTimeout(() => {
        buf.current = "";
      }, timeout);
      const b = buf.current;
      const repeated = b.length > 1 && b.split("").every((c) => c === b[0]);
      return repeated ? b[0] : b;
    },
    [timeout],
  );
}

export function isPrintableKey(e) {
  return e.key && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== " ";
}

export function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function layerAbove(el) {
  let max = null;
  let node = el ? el.parentElement : null;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    const z = parseInt(cs.zIndex, 10);
    if (!Number.isNaN(z) && cs.position !== "static") max = max == null ? z : Math.max(max, z);
    node = node.parentElement;
  }
  return max == null ? null : max + 1;
}
