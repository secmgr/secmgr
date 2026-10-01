import { cloneElement, createContext, isValidElement, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useFloating } from "../_lib/floating.js";
import {
  childRef,
  compose,
  firstFocusable,
  focusQuietly,
  LayerProvider,
  mergeRefs,
  OverlayPortal,
  transformOrigin,
  useFocusScope,
  useLayer,
  useLayerZ,
  usePresence,
  useStableId,
} from "../_lib/overlay.js";
import { cx } from "../_lib/util.js";

const PopoverContext = createContext(null);

export function Popover({
  trigger,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  anchorRef,
  side = "bottom",
  align = "start",
  offset = 6,
  autoFocus = true,
  className,
  style: styleProp,
  children,
  id: idProp,
  ...rest
}) {
  const [inner, setInner] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : inner;
  const setOpen = useCallback(
    (v) => {
      if (!controlled) setInner(v);
      if (onOpenChange) onOpenChange(v);
    },
    [controlled, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const anchor = anchorRef || triggerRef;
  const id = useStableId("sg-popover", idProp);
  const presence = usePresence(open, 120);
  const { style, side: placed } = useFloating({
    open: presence.mounted,
    anchorRef: anchor,
    floatingRef: panelRef,
    placement: `${side}-${align}`,
    offset,
  });
  const z = useLayerZ("var(--z-popover)");

  const inside = (t) => {
    const nodes = [panelRef.current, triggerRef.current, anchor.current];
    return nodes.some((n) => n?.contains?.(t));
  };
  useLayer(open, { contains: inside, onEscape: close, onOutside: close });
  const returnRef = useMemo(
    () => ({
      get current() {
        return triggerRef.current || anchor.current;
      },
    }),
    [anchor],
  );
  useFocusScope(open, panelRef, {
    initialFocus: autoFocus ? (root) => firstFocusable(root) || root : false,
    returnFocusRef: returnRef,
  });

  const onPanelKeyDown = (e) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const list = Array.from(
      panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = list[0];
    const last = list[list.length - 1];
    const back = triggerRef.current || anchor.current;
    const cur = document.activeElement;
    if (!back) return;
    if (!e.shiftKey && (cur === last || !list.length)) {
      focusQuietly(back);
      close();
    } else if (e.shiftKey && (cur === first || cur === panelRef.current)) {
      e.preventDefault();
      focusQuietly(back);
      close();
    }
  };

  let triggerEl = null;
  if (isValidElement(trigger)) {
    const tp = trigger.props;
    triggerEl = cloneElement(trigger, {
      ref: mergeRefs(triggerRef, childRef(trigger)),
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "aria-controls": open ? id : undefined,
      onClick: compose(tp.onClick, () => setOpen(!open)),
    });
  }

  const ctx = { close, open };
  return (
    <PopoverContext.Provider value={ctx}>
      {triggerEl}
      {presence.mounted && (
        <OverlayPortal>
          <LayerProvider z={z}>
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              tabIndex={-1}
              className={cx("sg-popover", className)}
              data-state={presence.state}
              data-side={placed}
              style={{ ...style, zIndex: z, transformOrigin: transformOrigin(placed, align), ...styleProp }}
              onKeyDown={onPanelKeyDown}
              {...rest}
            >
              {children}
            </div>
          </LayerProvider>
        </OverlayPortal>
      )}
    </PopoverContext.Provider>
  );
}

export function PopoverClose({ children }) {
  const ctx = useContext(PopoverContext);
  if (!isValidElement(children)) return children || null;
  return cloneElement(children, { onClick: compose(children.props.onClick, () => ctx?.close()) });
}

export function usePopover() {
  return useContext(PopoverContext);
}
