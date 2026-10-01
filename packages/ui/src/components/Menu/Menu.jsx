import * as React from "react";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFloating } from "../_lib/floating.js";
import {
  childRef,
  compose,
  focusQuietly,
  LayerProvider,
  mergeRefs,
  OverlayPortal,
  transformOrigin,
  useLayer,
  useLayerZ,
  usePresence,
  useStableId,
} from "../_lib/overlay.js";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";

const RootContext = createContext(null);
const LevelContext = createContext(null);
const RadioContext = createContext(null);

const ITEM = "[data-sg-menu-item]:not([data-disabled])";

function itemsOf(panel) {
  return panel ? Array.from(panel.querySelectorAll(ITEM)) : [];
}

function inTriangle(p, a, b, c) {
  const s = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = s(p, a, b);
  const d2 = s(p, b, c);
  const d3 = s(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function textOf(label, children) {
  if (typeof label === "string") return label;
  if (typeof children === "string") return children;
  return "";
}

function MenuPanel({
  open,
  anchorRef,
  placement,
  offset,
  align,
  level,
  rootId,
  id,
  labelledBy,
  intentRef,
  autoFocus,
  onEscape,
  onOutside,
  containsExtra,
  onArrowLeft,
  className,
  style: styleProp,
  panelRest,
  children,
}) {
  const root = useContext(RootContext);
  const parentLevel = useContext(LevelContext);
  const panelRef = useRef(null);
  const presence = usePresence(open, 120);
  const { style, side } = useFloating({ open: presence.mounted, anchorRef, floatingRef: panelRef, placement, offset });
  const z = useLayerZ("var(--z-popover)");
  const search = useRef({ str: "", timer: 0 });
  const openSub = useRef(null);
  const grace = useRef(null);

  useLayer(open, {
    contains: (t) => !!panelRef.current?.contains(t) || !!containsExtra?.(t),
    onEscape,
    onOutside,
  });

  useEffect(() => {
    if (!open || !autoFocus) return undefined;
    const run = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const items = itemsOf(panel);
      const intent = intentRef?.current;
      const target = intent === "first" ? items[0] : intent === "last" ? items[items.length - 1] : panel;
      focusQuietly(target || panel);
    };
    run();
    const t = setTimeout(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) run();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const level$ = useMemo(
    () => ({
      level,
      panelRef,
      openSub,
      grace,
      typing: () => search.current.str.length > 0,
      closeSubs: (except) => {
        if (openSub.current && openSub.current.trigger !== except) openSub.current.close();
      },
    }),
    [level],
  );

  const mine = (e) => e.target?.closest && e.target.closest("[data-sg-menu-panel]") === panelRef.current;

  const onKeyDown = (e) => {
    if (!mine(e)) return;
    const panel = panelRef.current;
    const items = itemsOf(panel);
    const cur = items.indexOf(document.activeElement);
    const go = (i) => {
      const el = items[(i + items.length) % items.length];
      if (!el) return;
      focusQuietly(el);
      if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    };
    if (e.key === "ArrowDown") {
      e.preventDefault();
      go(cur < 0 ? 0 : cur + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      go(cur < 0 ? items.length - 1 : cur - 1);
      return;
    }
    if (e.key === "Home" || e.key === "PageUp") {
      e.preventDefault();
      go(0);
      return;
    }
    if (e.key === "End" || e.key === "PageDown") {
      e.preventDefault();
      go(items.length - 1);
      return;
    }
    if (e.key === "ArrowLeft" && onArrowLeft) {
      e.preventDefault();
      onArrowLeft();
      return;
    }
    if (e.key === "Tab") {
      const trig = root.triggerRef.current;
      if (trig) {
        focusQuietly(trig);
        if (e.shiftKey) e.preventDefault();
      }
      root.closeAll();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === " " && !search.current.str) return;
      e.preventDefault();
      clearTimeout(search.current.timer);
      search.current.str += e.key.toLowerCase();
      search.current.timer = setTimeout(() => {
        search.current.str = "";
      }, 500);
      const s = search.current.str;
      const repeat = s.split("").every((c) => c === s[0]);
      const q = repeat ? s[0] : s;
      const start = cur < 0 ? 0 : repeat ? cur + 1 : cur;
      const ordered = items.slice(start).concat(items.slice(0, start));
      const hit = ordered.find((el) =>
        (el.getAttribute("data-text") || el.textContent || "").trim().toLowerCase().startsWith(q),
      );
      if (hit) {
        focusQuietly(hit);
        if (hit.scrollIntoView) hit.scrollIntoView({ block: "nearest" });
      }
    }
  };

  const onFocus = (e) => {
    if (!mine(e)) return;
    if (e.target.hasAttribute?.("data-sg-menu-item")) level$.closeSubs(e.target);
  };

  const onPointerEnterPanel = () => {
    if (parentLevel) parentLevel.grace.current = null;
  };

  if (!presence.mounted) return null;
  return (
    <OverlayPortal>
      <LayerProvider z={z}>
        <LevelContext.Provider value={level$}>
          <div
            ref={panelRef}
            id={id}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            data-sg-menu-panel=""
            data-sg-menu-root={rootId}
            data-state={presence.state}
            data-side={side}
            data-level={level}
            className={cx("sg-menu", className)}
            style={{
              ...style,
              visibility: "visible",
              zIndex: z,
              transformOrigin: transformOrigin(side, align),
              ...styleProp,
            }}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onPointerEnter={onPointerEnterPanel}
            {...panelRest}
          >
            {children}
          </div>
        </LevelContext.Provider>
      </LayerProvider>
    </OverlayPortal>
  );
}

export function Menu({
  trigger,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = "bottom",
  align = "start",
  offset = 4,
  autoFocus = true,
  className,
  style,
  children,
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
  const triggerRef = useRef(null);
  const intentRef = useRef("content");
  const rootId = useStableId("sg-menu");
  const contentId = `${rootId}-content`;
  const triggerId = (isValidElement(trigger) && trigger.props.id) || `${rootId}-trigger`;
  const closeAll = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return undefined;
    return () => {
      const cur = document.activeElement;
      const inTree =
        !cur || cur === document.body || !cur.isConnected || !!cur.closest?.(`[data-sg-menu-root="${rootId}"]`);
      if (inTree && triggerRef.current) focusQuietly(triggerRef.current);
    };
  }, [open, rootId]);

  const root$ = useMemo(() => ({ open, closeAll, triggerRef, rootId }), [open, closeAll, rootId]);

  let triggerEl = null;
  if (isValidElement(trigger)) {
    const tp = trigger.props;
    triggerEl = cloneElement(trigger, {
      ref: mergeRefs(triggerRef, childRef(trigger)),
      id: triggerId,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      "aria-controls": open ? contentId : undefined,
      "data-state": open ? "open" : "closed",
      onClick: compose(tp.onClick, (e) => {
        intentRef.current = e.detail === 0 ? "first" : "content";
        setOpen(!open);
      }),
      onKeyDown: compose(tp.onKeyDown, (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          intentRef.current = e.key === "ArrowDown" ? "first" : "last";
          setOpen(true);
        }
      }),
    });
  }

  const containsTrigger = (t) => !!triggerRef.current?.contains(t);

  return (
    <RootContext.Provider value={root$}>
      {triggerEl}
      <MenuPanel
        open={open}
        anchorRef={triggerRef}
        placement={`${side}-${align}`}
        align={align}
        offset={offset}
        level={0}
        rootId={rootId}
        id={contentId}
        labelledBy={triggerId}
        intentRef={intentRef}
        autoFocus={autoFocus}
        onEscape={closeAll}
        onOutside={closeAll}
        containsExtra={containsTrigger}
        className={className}
        style={style}
        panelRest={rest}
      >
        {children}
      </MenuPanel>
    </RootContext.Provider>
  );
}

function useItem({ disabled, onSelect, closeOnSelect, isSubTrigger }) {
  const root = useContext(RootContext);
  const level = useContext(LevelContext);
  const ref = useRef(null);
  const select = (native) => {
    if (disabled) return;
    const ev = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      nativeEvent: native,
    };
    if (onSelect) onSelect(ev);
    if (closeOnSelect && !ev.defaultPrevented && root) root.closeAll();
  };
  const onPointerMove = (e) => {
    if (e.pointerType === "touch" || !level) return;
    const g = level.grace.current;
    if (g && !isSubTrigger) {
      if (Date.now() < g.until && inTriangle({ x: e.clientX, y: e.clientY }, g.a, g.b, g.c)) return;
      level.grace.current = null;
    }
    if (disabled) {
      if (document.activeElement !== level.panelRef.current) focusQuietly(level.panelRef.current);
      return;
    }
    if (document.activeElement !== ref.current) focusQuietly(ref.current);
  };
  const onPointerLeave = (e) => {
    if (e.pointerType === "touch" || !level || isSubTrigger) return;
    const g = level.grace.current;
    if (g && Date.now() < g.until) return;
    if (document.activeElement === ref.current) focusQuietly(level.panelRef.current);
  };
  const onKeyDown = (e) => {
    if (e.target !== ref.current) return;
    if (e.key === "Enter" || (e.key === " " && !level?.typing())) {
      e.preventDefault();
      if (!isSubTrigger) select(e.nativeEvent);
    }
  };
  return {
    ref,
    select,
    onPointerMove,
    onPointerLeave,
    onKeyDown,
    onClick: (e) => {
      if (!isSubTrigger) select(e.nativeEvent);
    },
  };
}

function ItemIcon({ icon }) {
  if (icon == null || icon === false) return null;
  return (
    <span className="sg-menu__icon" aria-hidden="true">
      {typeof icon === "string" ? <Icon name={icon} size={16} /> : icon}
    </span>
  );
}

function ItemBody({ label, description, children }) {
  const main = label != null ? label : children;
  return (
    <span className="sg-menu__text">
      <span className="sg-menu__item-label">{main}</span>
      {description && <span className="sg-menu__description">{description}</span>}
    </span>
  );
}

export const MenuItem = React.forwardRef(function MenuItem(
  {
    icon,
    label,
    description,
    kbd,
    tone = "default",
    disabled = false,
    onSelect,
    closeOnSelect = true,
    textValue,
    className,
    children,
    ...rest
  },
  ref,
) {
  const it = useItem({ disabled, onSelect, closeOnSelect });
  return (
    <div
      ref={mergeRefs(it.ref, ref)}
      role="menuitem"
      tabIndex={-1}
      data-sg-menu-item=""
      data-text={textValue || textOf(label, children) || undefined}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      className={cx(
        "sg-menu__item",
        tone === "danger" && "sg-menu__item--danger",
        description && "sg-menu__item--tall",
        className,
      )}
      onPointerMove={it.onPointerMove}
      onPointerLeave={it.onPointerLeave}
      onKeyDown={it.onKeyDown}
      onClick={it.onClick}
      {...rest}
    >
      <ItemIcon icon={icon} />
      <ItemBody label={label} description={description}>
        {children}
      </ItemBody>
      {kbd && <Kbd keys={kbd} size="sm" className="sg-menu__kbd" />}
    </div>
  );
});

export const MenuCheckboxItem = React.forwardRef(function MenuCheckboxItem(
  {
    checked = false,
    onCheckedChange,
    label,
    description,
    kbd,
    disabled = false,
    onSelect,
    closeOnSelect = false,
    textValue,
    className,
    children,
    ...rest
  },
  ref,
) {
  const it = useItem({
    disabled,
    closeOnSelect,
    onSelect: (ev) => {
      if (onSelect) onSelect(ev);
      if (!ev.defaultPrevented && onCheckedChange) onCheckedChange(!checked);
    },
  });
  return (
    <div
      ref={mergeRefs(it.ref, ref)}
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      data-sg-menu-item=""
      data-state={checked ? "checked" : "unchecked"}
      data-text={textValue || textOf(label, children) || undefined}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      className={cx("sg-menu__item", description && "sg-menu__item--tall", className)}
      onPointerMove={it.onPointerMove}
      onPointerLeave={it.onPointerLeave}
      onKeyDown={it.onKeyDown}
      onClick={it.onClick}
      {...rest}
    >
      <span className="sg-menu__icon sg-menu__indicator" aria-hidden="true">
        {checked && <Icon name="check" size={16} />}
      </span>
      <ItemBody label={label} description={description}>
        {children}
      </ItemBody>
      {kbd && <Kbd keys={kbd} size="sm" className="sg-menu__kbd" />}
    </div>
  );
});

export function MenuRadioGroup({ value, onValueChange, label, children, className, ...rest }) {
  const ctx = useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <RadioContext.Provider value={ctx}>
      <div role="group" aria-label={label} className={cx("sg-menu__group", className)} {...rest}>
        {children}
      </div>
    </RadioContext.Provider>
  );
}

export const MenuRadioItem = React.forwardRef(function MenuRadioItem(
  {
    value,
    icon,
    label,
    description,
    kbd,
    disabled = false,
    onSelect,
    closeOnSelect = true,
    textValue,
    className,
    children,
    ...rest
  },
  ref,
) {
  const group = useContext(RadioContext);
  const checked = !!group && group.value === value;
  const it = useItem({
    disabled,
    closeOnSelect,
    onSelect: (ev) => {
      if (onSelect) onSelect(ev);
      if (!ev.defaultPrevented && group && group.onValueChange) group.onValueChange(value);
    },
  });
  return (
    <div
      ref={mergeRefs(it.ref, ref)}
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      data-sg-menu-item=""
      data-state={checked ? "checked" : "unchecked"}
      data-text={textValue || textOf(label, children) || undefined}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      className={cx("sg-menu__item", description && "sg-menu__item--tall", className)}
      onPointerMove={it.onPointerMove}
      onPointerLeave={it.onPointerLeave}
      onKeyDown={it.onKeyDown}
      onClick={it.onClick}
      {...rest}
    >
      <ItemIcon icon={icon} />
      <ItemBody label={label} description={description}>
        {children}
      </ItemBody>
      {kbd && <Kbd keys={kbd} size="sm" className="sg-menu__kbd" />}
      <span className="sg-menu__radio" aria-hidden="true">
        {checked && <span className="sg-menu__radio-dot" />}
      </span>
    </div>
  );
});

export function MenuSeparator({ className, ...rest }) {
  return (
    <div role="separator" aria-orientation="horizontal" className={cx("sg-menu__separator", className)} {...rest} />
  );
}

export function MenuLabel({ className, children, ...rest }) {
  return (
    <div role="presentation" className={cx("sg-menu__label", className)} {...rest}>
      {children}
    </div>
  );
}

export function MenuSub({
  icon,
  label,
  description,
  disabled = false,
  defaultOpen = false,
  textValue,
  className,
  children,
  ...rest
}) {
  const root = useContext(RootContext);
  const level = useContext(LevelContext);
  const [open, setOpen] = useState(defaultOpen);
  const it = useItem({ disabled, isSubTrigger: true });
  const intentRef = useRef("content");
  const timer = useRef(0);
  const subId = useStableId("sg-menu-sub");
  const rootOpen = !root || root.open;
  const shown = open && rootOpen && !disabled;

  const close = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = 0;
    setOpen(false);
  }, []);
  const openWith = (intent) => {
    clearTimeout(timer.current);
    timer.current = 0;
    intentRef.current = intent;
    setOpen(true);
  };

  useEffect(() => {
    if (!rootOpen) close();
  }, [rootOpen, close]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!level || !shown) return undefined;
    const entry = { trigger: it.ref.current, close };
    level.openSub.current = entry;
    return () => {
      if (level.openSub.current === entry) level.openSub.current = null;
    };
  }, [shown, level, close]);

  const anchor = useMemo(
    () => ({
      get current() {
        const el = it.ref.current;
        if (!el) return null;
        return {
          getBoundingClientRect() {
            const r = el.getBoundingClientRect();
            return {
              top: r.top - 4,
              bottom: r.bottom + 4,
              left: r.left - 4,
              right: r.right + 4,
              width: r.width + 8,
              height: r.height + 8,
              x: r.left - 4,
              y: r.top - 4,
            };
          },
        };
      },
    }),
    [],
  );

  const onPointerMove = (e) => {
    it.onPointerMove(e);
    if (e.pointerType === "touch" || disabled || open) return;
    if (!timer.current)
      timer.current = setTimeout(() => {
        timer.current = 0;
        openWith("none");
      }, 100);
  };
  const onPointerLeave = (e) => {
    clearTimeout(timer.current);
    timer.current = 0;
    if (!open || !level) return;
    const panel = document.getElementById(`${subId}-content`);
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const toRight = r.left >= e.clientX;
    const x = toRight ? r.left : r.right;
    level.grace.current = {
      until: Date.now() + 300,
      a: { x: e.clientX + (toRight ? -4 : 4), y: e.clientY },
      b: { x, y: r.top },
      c: { x, y: r.bottom },
    };
  };
  const onKeyDown = (e) => {
    if (e.target !== it.ref.current || disabled) return;
    if (e.key === "ArrowRight" || e.key === "Enter" || (e.key === " " && !level?.typing())) {
      e.preventDefault();
      if (open) {
        const panel = document.getElementById(`${subId}-content`);
        const first = panel?.querySelector(ITEM);
        if (first) focusQuietly(first);
      } else openWith("first");
    }
  };
  const onClick = () => {
    if (!disabled) {
      if (open) return;
      openWith("content-keep");
    }
  };

  const back = () => {
    close();
    if (it.ref.current) focusQuietly(it.ref.current);
  };
  const containsTrigger = (t) => !!it.ref.current?.contains(t);

  return (
    <>
      <div
        ref={it.ref}
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={shown}
        aria-controls={shown ? `${subId}-content` : undefined}
        id={`${subId}-trigger`}
        data-sg-menu-item=""
        data-state={shown ? "open" : "closed"}
        data-text={textValue || (typeof label === "string" ? label : undefined)}
        data-disabled={disabled || undefined}
        aria-disabled={disabled || undefined}
        className={cx("sg-menu__item", "sg-menu__item--sub", description && "sg-menu__item--tall", className)}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onClick={onClick}
        {...rest}
      >
        <ItemIcon icon={icon} />
        <ItemBody label={label} description={description} />
        <Icon name="chevron-right" size={16} className="sg-menu__chevron" />
      </div>
      <MenuPanel
        open={shown}
        anchorRef={anchor}
        placement="right-start"
        align="start"
        offset={2}
        level={(level ? level.level : 0) + 1}
        rootId={root ? root.rootId : subId}
        id={`${subId}-content`}
        labelledBy={`${subId}-trigger`}
        intentRef={{
          get current() {
            return intentRef.current === "first" ? "first" : "none";
          },
        }}
        autoFocus={intentRef.current === "first"}
        onEscape={back}
        onOutside={close}
        onArrowLeft={back}
        containsExtra={containsTrigger}
      >
        {children}
      </MenuPanel>
    </>
  );
}
