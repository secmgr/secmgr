import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { focusables, useIsoLayoutEffect } from "./util.js";

const subscribe = () => () => {};

export function OverlayPortal({ children, container }) {
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return ReactDOM.createPortal(children, container || document.body);
}

export function mergeRefs(...refs) {
  return (node) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(node);
      else r.current = node;
    }
  };
}

export function compose(theirs, ours) {
  return (e) => {
    if (theirs) theirs(e);
    if (!e?.defaultPrevented) ours(e);
  };
}

export function childRef(child) {
  if (!child) return null;
  return child.props?.ref || null;
}

export const LayerContext = createContext({ depth: 0, z: null });

export function useLayerZ(fallback) {
  const ctx = useContext(LayerContext);
  return ctx.z ? `max(${fallback}, calc(${ctx.z} + 1))` : fallback;
}

export function useOpenState(openProp, defaultOpen, onOpenChange) {
  const [inner, setInner] = useState(!!defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? !!openProp : inner;
  const setOpen = useCallback(
    (v) => {
      if (!controlled) setInner(v);
      if (onOpenChange) onOpenChange(v);
    },
    [controlled, onOpenChange],
  );
  return [open, setOpen];
}

export function LayerProvider({ z, children }) {
  const parent = useContext(LayerContext);
  const value = React.useMemo(() => ({ depth: parent.depth + 1, z: z || parent.z }), [parent.depth, parent.z, z]);
  return <LayerContext.Provider value={value}>{children}</LayerContext.Provider>;
}

const layers = [];
let installed = false;

function topLayer() {
  return layers[layers.length - 1];
}

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || e.isComposing) return;
      const top = topLayer();
      if (!top?.handlers.current.onEscape) return;
      e.preventDefault();
      e.stopPropagation();
      top.handlers.current.onEscape(e);
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!layers.length) return;
      const t = e.target;
      let inside = -1;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].contains(t)) {
          inside = i;
          break;
        }
      }
      const dismiss = layers.slice(inside + 1).reverse();
      for (const l of dismiss) if (l.handlers.current.onOutside) l.handlers.current.onOutside(e);
    },
    true,
  );
}

export function useLayer(active, { contains, onEscape, onOutside }) {
  const { depth } = useContext(LayerContext);
  const handlers = useRef({});
  handlers.current = { onEscape, onOutside, contains };
  const entryRef = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    install();
    const entry = { depth, handlers, contains: (t) => !!handlers.current.contains?.(t) };
    entryRef.current = entry;
    let at = layers.length;
    while (at > 0 && layers[at - 1].depth > depth) at--;
    layers.splice(at, 0, entry);
    return () => {
      const i = layers.indexOf(entry);
      if (i >= 0) layers.splice(i, 1);
      entryRef.current = null;
    };
  }, [active, depth]);
  return entryRef;
}

let restoring = false;
export function isProgrammaticFocus() {
  return restoring;
}

export function focusQuietly(el) {
  if (!el || typeof el.focus !== "function") return;
  restoring = true;
  try {
    el.focus({ preventScroll: true });
  } finally {
    restoring = false;
  }
}

const traps = [];

export function useFocusScope(active, ref, { trap = false, initialFocus, restoreFocus = true, returnFocusRef } = {}) {
  const opts = useRef({});
  opts.current = { initialFocus, restoreFocus, returnFocusRef, trap };
  useEffect(() => {
    if (!active) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const previous = document.activeElement;
    const entry = { root };
    if (opts.current.trap) traps.push(entry);
    let retry = 0;
    const pick = () => {
      const init = opts.current.initialFocus;
      if (init === false) return null;
      if (init?.current) return init.current;
      if (typeof init === "function") return init(root);
      const auto = root.querySelector("[data-autofocus], [autofocus]");
      if (auto) return auto;
      return root;
    };
    const target = pick();
    if (target) {
      focusQuietly(target);
      if (document.activeElement !== target)
        retry = setTimeout(() => {
          if (root.contains(target) || target === root) focusQuietly(target);
        }, 0);
    }
    const onKey = (e) => {
      if (e.key !== "Tab" || !opts.current.trap || traps[traps.length - 1] !== entry) return;
      const list = focusables(root);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const a = list[0];
      const b = list[list.length - 1];
      const cur = document.activeElement;
      if (e.shiftKey && (cur === a || cur === root)) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && cur === b) {
        e.preventDefault();
        a.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(retry);
      root.removeEventListener("keydown", onKey);
      const i = traps.indexOf(entry);
      if (i >= 0) traps.splice(i, 1);
      if (!opts.current.restoreFocus) return;
      const cur = document.activeElement;
      const lost = !cur || cur === document.body || root.contains(cur) || !cur.isConnected;
      if (!lost) return;
      const back = opts.current.returnFocusRef?.current || previous;
      if (back?.isConnected) focusQuietly(back);
    };
  }, [active]);
}

export function firstFocusable(root, skip) {
  const list = focusables(root).filter((el) => !skip || !el.closest(skip));
  return list[0] || null;
}

export function usePresence(open, exitMs = 160) {
  const [mounted, setMounted] = useState(open);
  useIsoLayoutEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: open || mounted, state: open ? "open" : "closed" };
}

let lockCount = 0;
let saved = null;
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const html = document.documentElement;
    const body = document.body;
    if (lockCount === 0) {
      const gap = window.innerWidth - html.clientWidth;
      saved = { overflow: html.style.overflow, padding: body.style.paddingRight };
      html.style.overflow = "hidden";
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0 && saved) {
        html.style.overflow = saved.overflow;
        body.style.paddingRight = saved.padding;
        saved = null;
      }
    };
  }, [active]);
}

export function transformOrigin(side, align) {
  const cross = align === "start" ? "start" : align === "end" ? "end" : "center";
  if (side === "bottom" || side === "top") {
    const x = cross === "start" ? "left" : cross === "end" ? "right" : "center";
    return `${x} ${side === "bottom" ? "top" : "bottom"}`;
  }
  const y = cross === "start" ? "top" : cross === "end" ? "bottom" : "center";
  return `${side === "right" ? "left" : "right"} ${y}`;
}

export function useStableId(prefix, given) {
  const id = React.useId();
  return given || `${prefix}-${id.replace(/:/g, "")}`;
}
