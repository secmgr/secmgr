import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
export function cx(...parts) {
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === "string") out.push(p);
    else if (typeof p === "object") for (const k in p) if (p[k]) out.push(k);
  }
  return out.join(" ");
}

export function n(count, word, plural) {
  const w = count === 1 ? word : plural || `${word}s`;
  return `${count.toLocaleString("en-US")} ${w}`;
}

export function useControllable(value, defaultValue, onChange) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback(
    (next) => {
      const v = typeof next === "function" ? next(current) : next;
      if (!controlled) setInner(v);
      if (onChange) onChange(v);
    },
    [controlled, current, onChange],
  );
  return [current, set];
}

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Portal({ children, container }) {
  const [el, setEl] = useState(null);
  useIsoLayoutEffect(() => {
    setEl(container || document.body);
  }, [container]);
  return el ? ReactDOM.createPortal(children, el) : null;
}

export function useEscape(active, handler) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handler(e);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, handler]);
}

export function useOutsideClick(active, refs, handler) {
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => {
      const list = Array.isArray(refs) ? refs : [refs];
      if (list.some((r) => r.current?.contains(e.target))) return;
      handler(e);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active, refs, handler]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function focusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function useFocusTrap(active, ref, { initial, restore = true } = {}) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const root = ref.current;
    const previous = document.activeElement;
    const first = initial?.current || focusables(root)[0] || root;
    requestAnimationFrame(() => first?.focus?.({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const list = focusables(root);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const a = list[0];
      const b = list[list.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (restore && previous?.focus) previous.focus({ preventScroll: true });
    };
  }, [active]);
}

export function usePrefersReducedMotion() {
  const q =
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [v, setV] = useState(q ? q.matches : false);
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setV(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return v;
}

export function useTimeout(fn, ms, deps) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms == null) return undefined;
    const t = setTimeout(() => saved.current(), ms);
    return () => clearTimeout(t);
  }, deps || [ms]);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_err) {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function formatShortcut(keys) {
  const map = {
    mod: isMac ? "⌘" : "Ctrl",
    cmd: "⌘",
    shift: "⇧",
    alt: isMac ? "⌥" : "Alt",
    ctrl: isMac ? "⌃" : "Ctrl",
    enter: "↵",
    esc: "Esc",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    backspace: "⌫",
    tab: "Tab",
  };
  return keys.map((k) => map[String(k).toLowerCase()] || (String(k).length === 1 ? String(k).toUpperCase() : k));
}

export function relativeTime(date, now = Date.now()) {
  const d = typeof date === "number" ? date : new Date(date).getTime();
  const s = Math.round((now - d) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
