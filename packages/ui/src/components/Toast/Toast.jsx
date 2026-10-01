import * as React from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { OverlayPortal } from "../_lib/overlay.js";
import { cx, useIsoLayoutEffect } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

const MAX_KEPT = 20;
const EXIT_MS = 200;
const GAP = 8;
const LIFT = 14;
const TONE_ICON = { success: "circle-check", warning: "triangle-alert", danger: "circle-alert" };

let store = [];
let counter = 0;
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function snapshot() {
  return store;
}
function asOptions(input, value) {
  const v = typeof input === "function" ? input(value) : input;
  if (v == null) return {};
  return typeof v === "object" && !React.isValidElement(v) ? v : { title: v };
}

export function toast(input) {
  const opts = asOptions(input);
  const id = opts.id != null ? String(opts.id) : `toast-${++counter}`;
  const existing = store.find((t) => t.id === id);
  const next = {
    tone: "neutral",
    ...(existing || {}),
    ...opts,
    id,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
    removing: false,
  };
  store = existing ? store.map((t) => (t.id === id ? next : t)) : [next, ...store].slice(0, MAX_KEPT);
  emit();
  return id;
}

toast.success = (title, opts) => toast({ ...asOptions(opts), title, tone: "success" });
toast.warning = (title, opts) => toast({ ...asOptions(opts), title, tone: "warning" });
toast.danger = (title, opts) => toast({ ...asOptions(opts), title, tone: "danger" });

toast.dismiss = (id) => {
  const ids = id == null ? store.map((t) => t.id) : [String(id)];
  let changed = false;
  store = store.map((t) => {
    if (!ids.includes(t.id) || t.removing) return t;
    changed = true;
    return { ...t, removing: true };
  });
  if (!changed) return;
  emit();
  setTimeout(() => {
    store = store.filter((t) => !(ids.includes(t.id) && t.removing));
    emit();
  }, EXIT_MS);
};

toast.promise = (promise, { loading, success, error } = {}) => {
  const id = toast({ ...asOptions(loading), loading: true, tone: "neutral", duration: Infinity });
  Promise.resolve(promise).then(
    (value) =>
      toast({
        duration: undefined,
        icon: undefined,
        ...asOptions(success, value),
        id,
        loading: false,
        tone: asOptions(success, value).tone || "success",
      }),
    (err) =>
      toast({
        duration: undefined,
        icon: undefined,
        ...asOptions(error, err),
        id,
        loading: false,
        tone: asOptions(error, err).tone || "danger",
      }),
  );
  return id;
};

function durationOf(t) {
  if (t.loading) return Infinity;
  if (t.duration != null) return t.duration;
  return t.action ? 10000 : 5000;
}

function ToastItem({ t, index, visible, expanded, frontHeight, height, offset, paused, onHeight }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);
  const remaining = useRef({ at: 0, left: 0 });
  const hidden = index >= visible;
  const front = index === 0;

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    onHeight(t.id, el.offsetHeight);
  });
  useIsoLayoutEffect(() => {
    if (ref.current) ref.current.getBoundingClientRect();
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      if (ref.current) onHeight(t.id, ref.current.offsetHeight);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [t.id, onHeight]);

  useEffect(() => {
    const total = durationOf(t);
    if (remaining.current.at !== t.updatedAt) remaining.current = { at: t.updatedAt, left: total };
    if (t.removing || !Number.isFinite(remaining.current.left) || paused || hidden) return undefined;
    const start = Date.now();
    const timer = setTimeout(() => toast.dismiss(t.id), Math.max(0, remaining.current.left));
    return () => {
      clearTimeout(timer);
      remaining.current.left -= Date.now() - start;
    };
  }, [t.updatedAt, t.removing, paused, hidden]);

  const h = height || frontHeight;
  const i = Math.min(index, visible);
  const sx = 1 - i * 0.05;
  const sy = front || !h || !frontHeight ? sx : sx * (frontHeight / h);
  const resting = expanded
    ? `translateY(${-offset}px)`
    : front
      ? "translateY(0)"
      : `translateY(${-i * LIFT}px) scale(${sx}, ${sy})`;
  let transform = resting;
  let opacity = 1;
  if (!mounted) {
    transform = "translateY(100%)";
    opacity = 0;
  } else if (t.removing) {
    transform = front && !expanded ? "translateY(100%)" : resting;
    opacity = 0;
  } else if (hidden) opacity = 0;

  const icon = t.loading ? (
    <Spinner size={16} label="Working" />
  ) : t.icon ? (
    <Icon name={t.icon} size={16} />
  ) : TONE_ICON[t.tone] ? (
    <Icon name={TONE_ICON[t.tone]} size={16} />
  ) : null;

  return (
    <li
      ref={ref}
      className={cx("sg-toast", `sg-toast--${t.tone}`, t.className)}
      data-front={front || undefined}
      data-expanded={expanded || undefined}
      data-hidden={hidden || undefined}
      data-removing={t.removing || undefined}
      aria-hidden={hidden || undefined}
      style={{ transform, opacity, zIndex: visible + 1 - Math.min(index, visible) }}
    >
      <div className="sg-toast__content">
        {icon && (
          <span className="sg-toast__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="sg-toast__text">
          {t.title && <div className="sg-toast__title">{t.title}</div>}
          {t.description && <div className="sg-toast__description">{t.description}</div>}
        </div>
        {t.action && (
          <Button
            size="sm"
            className="sg-toast__action"
            tabIndex={hidden ? -1 : undefined}
            onClick={() => {
              if (t.action.onClick) t.action.onClick();
              toast.dismiss(t.id);
            }}
          >
            {t.action.label}
          </Button>
        )}
      </div>
      {t.dismissible !== false && (
        <button
          type="button"
          className="sg-toast__close"
          aria-label="Dismiss notification"
          tabIndex={hidden ? -1 : undefined}
          onClick={() => toast.dismiss(t.id)}
        >
          <Icon name="x" size={12} strokeWidth={2} />
        </button>
      )}
    </li>
  );
}

export function Toaster({
  visible = 3,
  expand = false,
  container,
  hotkey = ["alt", "t"],
  label = "Notifications",
  className,
}) {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [heights, setHeights] = useState({});
  const sectionRef = useRef(null);

  const onHeight = useCallback((id, h) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  useEffect(() => {
    const off = () => setBlurred(true);
    const on = () => setBlurred(false);
    const vis = () => setBlurred(document.visibilityState === "hidden");
    window.addEventListener("blur", off);
    window.addEventListener("focus", on);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("blur", off);
      window.removeEventListener("focus", on);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  useEffect(() => {
    if (!hotkey) return undefined;
    const keys = (Array.isArray(hotkey) ? hotkey : [hotkey]).map((k) => String(k).toLowerCase());
    const main = keys.find((k) => k.length === 1);
    const onKey = (e) => {
      if (!main || e.code !== `Key${main.toUpperCase()}` || e.altKey !== keys.includes("alt")) return;
      const root = sectionRef.current;
      if (!root || !store.length) return;
      e.preventDefault();
      const target = root.querySelector(".sg-toast[data-front] button") || root;
      target.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey && String(hotkey)]);

  useEffect(() => {
    if (!list.length) {
      setHovered(false);
      setFocused(false);
    }
  }, [list.length]);

  const expanded = (expand || hovered || focused) && list.filter((t) => !t.removing).length > 1;
  const paused = hovered || focused || blurred;
  const firstLive = list.find((t) => !t.removing) || list[0];
  const frontHeight = firstLive ? heights[firstLive.id] || 0 : 0;
  const items = [];
  let n = 0;
  let acc = 0;
  for (const t of list) {
    items.push({ t, index: n, offset: acc });
    if (!t.removing) {
      if (n < visible) acc += (heights[t.id] || 0) + GAP;
      n++;
    }
  }
  const stackHeight = expanded ? Math.max(0, acc - GAP) : frontHeight;
  const hotkeyLabel = hotkey
    ? ` ${(Array.isArray(hotkey) ? hotkey : [hotkey]).map((k) => (k === "alt" ? "alt" : String(k).toUpperCase())).join("+")}`
    : "";

  return (
    <OverlayPortal container={container}>
      <section
        ref={sectionRef}
        className={cx("sg-toaster", className)}
        aria-label={`${label}${hotkeyLabel}`}
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        tabIndex={-1}
        data-empty={!list.length || undefined}
      >
        <ol
          className="sg-toaster__list"
          data-expanded={expanded || undefined}
          style={{ height: stackHeight }}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") setHovered(true);
          }}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
          }}
        >
          {items.map(({ t, index, offset }) => (
            <ToastItem
              key={t.id}
              t={t}
              index={index}
              visible={visible}
              expanded={expanded}
              frontHeight={frontHeight}
              height={heights[t.id]}
              offset={offset}
              paused={paused}
              onHeight={onHeight}
            />
          ))}
        </ol>
      </section>
    </OverlayPortal>
  );
}
