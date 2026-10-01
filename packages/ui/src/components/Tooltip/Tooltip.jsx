import { Children, cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import { useFloating } from "../_lib/floating.js";
import {
  childRef,
  compose,
  isProgrammaticFocus,
  mergeRefs,
  OverlayPortal,
  usePresence,
  useStableId,
} from "../_lib/overlay.js";
import { cx } from "../_lib/util.js";
import { Kbd } from "../Kbd/Kbd.jsx";

const SKIP_WINDOW = 300;
let lastClosedAt = 0;
let current = null;

function canSkipDelay() {
  return !!current || Date.now() - lastClosedAt < SKIP_WINDOW;
}

export function Tooltip({
  content,
  kbd,
  side = "top",
  align = "center",
  offset = 6,
  delay = 450,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  describe = true,
  className,
  children,
}) {
  const [inner, setInner] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = !disabled && content != null && content !== "" && (controlled ? openProp : inner);
  const [instant, setInstant] = useState(false);
  const triggerRef = useRef(null);
  const floatRef = useRef(null);
  const timer = useRef(0);
  const id = useStableId("sg-tooltip");
  const presence = usePresence(open, 100);
  const { style, side: placed } = useFloating({
    open: presence.mounted,
    anchorRef: triggerRef,
    floatingRef: floatRef,
    placement: `${side}-${align}`,
    offset,
  });

  const setOpen = useCallback(
    (v) => {
      if (!controlled) setInner(v);
      if (onOpenChange) onOpenChange(v);
    },
    [controlled, onOpenChange],
  );

  const viaPointer = useRef(false);
  const closeRef = useRef(null);
  closeRef.current = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  const show = useCallback(
    (immediate) => {
      clearTimeout(timer.current);
      const el = triggerRef.current;
      if (el && el.getAttribute("aria-expanded") === "true") return;
      viaPointer.current = true;
      if (immediate || canSkipDelay()) {
        setInstant(canSkipDelay());
        setOpen(true);
        return;
      }
      setInstant(false);
      timer.current = setTimeout(() => setOpen(true), delay);
    },
    [delay, setOpen],
  );

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, [setOpen]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const shared = viaPointer.current;
    viaPointer.current = false;
    const mine = { close: () => closeRef.current() };
    if (shared) {
      if (current && current !== mine) current.close();
      current = mine;
    }
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
    };
    const onScroll = (e) => {
      if (!floatRef.current?.contains(e.target)) closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      if (current === mine) current = null;
      if (shared) lastClosedAt = Date.now();
    };
  }, [open]);

  const child = Children.only(children);
  if (!isValidElement(child)) return child;
  const cp = child.props;
  const trigger = cloneElement(child, {
    ref: mergeRefs(triggerRef, childRef(child)),
    "aria-describedby": open && describe ? cx(cp["aria-describedby"], id) : cp["aria-describedby"],
    onPointerEnter: compose(cp.onPointerEnter, (e) => {
      if (e.pointerType !== "touch") show(false);
    }),
    onPointerLeave: compose(cp.onPointerLeave, hide),
    onPointerDown: compose(cp.onPointerDown, hide),
    onFocus: compose(cp.onFocus, (e) => {
      if (isProgrammaticFocus()) return;
      let visible = true;
      try {
        visible = e.currentTarget.matches(":focus-visible");
      } catch (_err) {
        visible = true;
      }
      if (visible) show(true);
    }),
    onBlur: compose(cp.onBlur, hide),
  });

  return (
    <>
      {trigger}
      {presence.mounted && (
        <OverlayPortal>
          <div
            ref={floatRef}
            id={id}
            role="tooltip"
            className={cx("sg-tooltip", className)}
            data-state={presence.state === "open" ? (instant ? "instant-open" : "open") : "closed"}
            data-side={placed}
            style={style}
          >
            <span className="sg-tooltip__label">{content}</span>
            {kbd && <Kbd keys={kbd} size="sm" tone="inverse" className="sg-tooltip__kbd" />}
          </div>
        </OverlayPortal>
      )}
    </>
  );
}
