import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { safeId } from "../_lib/layout.js";
import { cx, useControllable, useIsoLayoutEffect } from "../_lib/util.js";
import { EnvDot } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";

const TabsContext = createContext(null);
const EDGE = 24;

export const Tabs = forwardRef(function Tabs(
  {
    items = [],
    value,
    defaultValue,
    onValueChange,
    variant = "underline",
    size = "md",
    label,
    children,
    className,
    ...rest
  },
  ref,
) {
  const enabled = items.filter((i) => !i.disabled);
  const [current, setCurrent] = useControllable(
    value,
    defaultValue !== undefined ? defaultValue : enabled[0]?.value,
    onValueChange,
  );
  const base = `sg-tabs-${safeId(useId())}`;
  const scrollerRef = useRef(null);
  const listRef = useRef(null);
  const tabs = useRef(new Map());
  const [indicator, setIndicator] = useState(null);
  const [ready, setReady] = useState(false);
  const [fade, setFade] = useState({ start: false, end: false });
  const hasPanels = children != null;
  const selected = items.some((i) => i.value === current && !i.disabled) ? current : null;
  const focusValue = selected !== null ? selected : enabled[0]?.value;

  const measure = useCallback(() => {
    const el = tabs.current.get(current);
    const inner = el?.querySelector(".sg-tabs__inner");
    setIndicator(inner ? { x: inner.offsetLeft, w: inner.offsetWidth } : null);
    const sc = scrollerRef.current;
    if (sc) {
      const max = sc.scrollWidth - sc.clientWidth;
      setFade({ start: sc.scrollLeft > 1, end: sc.scrollLeft < max - 1 });
    }
  }, [current]);

  useIsoLayoutEffect(() => {
    measure();
  }, [measure, items.length]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    const list = listRef.current;
    const sc = scrollerRef.current;
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      if (list) ro.observe(list);
      if (sc) ro.observe(sc);
    }
    if (document.fonts?.ready) document.fonts.ready.then(() => measure());
    return () => {
      cancelAnimationFrame(id);
      if (ro) ro.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const sc = scrollerRef.current;
    const el = tabs.current.get(current);
    if (!sc || !el || sc.scrollWidth <= sc.clientWidth) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < sc.scrollLeft + EDGE)
      sc.scrollTo({ left: Math.max(0, left - EDGE), behavior: ready ? "smooth" : "auto" });
    else if (right > sc.scrollLeft + sc.clientWidth - EDGE)
      sc.scrollTo({ left: right - sc.clientWidth + EDGE, behavior: ready ? "smooth" : "auto" });
  }, [current]);

  const onKeyDown = (e) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key) || !enabled.length) return;
    const at = enabled.findIndex((i) => String(i.value) === e.target.getAttribute("data-value"));
    let next = null;
    if (e.key === "ArrowRight") next = enabled[(at + 1) % enabled.length];
    if (e.key === "ArrowLeft") next = enabled[(at - 1 + enabled.length) % enabled.length];
    if (e.key === "Home") next = enabled[0];
    if (e.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    setCurrent(next.value);
    const el = tabs.current.get(next.value);
    if (el) el.focus();
  };

  const tabId = (v) => `${base}-tab-${safeId(v)}`;
  const panelId = (v) => `${base}-panel-${safeId(v)}`;

  return (
    <TabsContext.Provider value={{ current: selected, tabId, panelId }}>
      <div
        ref={ref}
        className={cx("sg-tabs", `sg-tabs--${variant}`, `sg-tabs--${size}`, className)}
        data-ready={ready || undefined}
        {...rest}
      >
        <div className="sg-tabs__bar">
          <div
            ref={scrollerRef}
            className="sg-tabs__scroller"
            data-fade-start={fade.start || undefined}
            data-fade-end={fade.end || undefined}
            onScroll={measure}
          >
            <div
              ref={listRef}
              role="tablist"
              aria-label={label}
              aria-orientation="horizontal"
              className="sg-tabs__list"
              onKeyDown={onKeyDown}
            >
              {items.map((it) => {
                const on = it.value === selected;
                return (
                  <button
                    key={it.value}
                    ref={(el) => {
                      if (el) tabs.current.set(it.value, el);
                      else tabs.current.delete(it.value);
                    }}
                    type="button"
                    role="tab"
                    id={tabId(it.value)}
                    aria-selected={on}
                    aria-controls={hasPanels ? panelId(it.value) : undefined}
                    tabIndex={it.value === focusValue ? 0 : -1}
                    disabled={it.disabled}
                    data-value={String(it.value)}
                    className={cx("sg-tabs__tab", it.className)}
                    onClick={() => setCurrent(it.value)}
                  >
                    <span className="sg-tabs__inner">
                      {it.dot ? (
                        <EnvDot color={it.dot} size={8} />
                      ) : it.icon ? (
                        <Icon name={it.icon} size={size === "sm" ? 14 : 16} />
                      ) : null}
                      <span className="sg-tabs__label">{it.label}</span>
                      {it.count != null && <span className="sg-tabs__count">{it.count}</span>}
                    </span>
                  </button>
                );
              })}
              {variant === "underline" && indicator && (
                <span
                  className="sg-tabs__indicator"
                  aria-hidden="true"
                  style={{ transform: `translateX(${indicator.x}px) scaleX(${indicator.w})` }}
                />
              )}
            </div>
          </div>
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
});

export function TabPanel({ value, children, className, ...rest }) {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const on = ctx.current === value;
  return (
    <div
      role="tabpanel"
      id={ctx.panelId(value)}
      aria-labelledby={ctx.tabId(value)}
      hidden={!on}
      tabIndex={0}
      className={cx("sg-tab-panel", className)}
      {...rest}
    >
      {on ? children : null}
    </div>
  );
}
