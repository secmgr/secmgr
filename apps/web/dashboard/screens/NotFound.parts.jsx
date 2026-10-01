import { Button, ConfirmDialog, EmptyState } from "@secmgr/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const BOOT = Date.now();

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function liveNow(select) {
  return select.now + (Date.now() - BOOT);
}

const pad = (x) => String(x).padStart(2, "0");
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function shortDate(iso, now) {
  const d = new Date(iso);
  const n = new Date(now);
  return d.toLocaleDateString(
    "en-US",
    d.getFullYear() === n.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}

export function formatWhen(iso, now, empty = "Never") {
  if (!iso) return empty;
  const d = new Date(iso);
  const diff = now - d.getTime();
  if (diff < 45 * 1000) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))} min ago`;
  if (sameDay(d, new Date(now))) {
    const h = Math.round(diff / HOUR);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (sameDay(d, new Date(now - DAY))) return `yesterday at ${clock(d)}`;
  return shortDate(iso, now);
}

export function formatUntil(iso, now) {
  if (!iso) return { label: "Never", hint: null, expired: false, soon: false };
  const t = new Date(iso).getTime();
  const days = Math.round((t - now) / DAY);
  if (t <= now) {
    const ago = Math.max(1, Math.round((now - t) / DAY));
    return {
      label: `Expired ${shortDate(iso, now)}`,
      hint: ago === 1 ? "1 day ago" : `${ago} days ago`,
      expired: true,
      soon: false,
    };
  }
  return {
    label: shortDate(iso, now),
    hint: days <= 1 ? "in 1 day" : `in ${days} days`,
    expired: false,
    soon: days <= 30,
  };
}

export function toSlug(raw, { trim = false } = {}) {
  let s = String(raw || "")
    .toLowerCase()
    .replace(/[\s_./]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
  if (trim) s = s.replace(/-+$/, "");
  return s.slice(0, 40);
}

export function isEditable(el) {
  if (!el?.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export function useHotkey(key, handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key !== key) return;
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
      if (document.querySelector("[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']")) return;
      e.preventDefault();
      ref.current(e);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [key, enabled]);
}

export function useConfirm() {
  const [state, setState] = useState({ open: false, props: {} });
  const ask = useCallback((props) => setState({ open: true, props }), []);
  const onOpenChange = useCallback((open) => setState((s) => ({ ...s, open })), []);
  const node = <ConfirmDialog {...state.props} open={state.open} onOpenChange={onOpenChange} />;
  return [node, ask];
}

export function useClosable(onClose, ms = 170) {
  const [open, setOpen] = useState(true);
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    setTimeout(() => onClose?.(), ms);
  }, [onClose, ms]);
  const onOpenChange = useCallback(
    (v) => {
      if (!v) close();
    },
    [close],
  );
  return { open, close, onOpenChange };
}

export function ProjectMissing() {
  const { actions } = useStore();
  return (
    <div className="pg">
      <EmptyState
        variant="page"
        icon="folder-git-2"
        titleAs="h1"
        title="This project does not exist"
        description="It may have been renamed or deleted, or you may not have access to it."
        actions={
          <Button variant="primary" iconRight="arrow-right" onClick={() => actions.navigate("projects")}>
            Go to projects
          </Button>
        }
      />
    </div>
  );
}
