import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { computePosition } from "../_lib/floating.js";
import { cx, Portal, useControllable, useEscape, useOutsideClick } from "../_lib/util.js";
import { EnvDot, envColor } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";

function normalize(list) {
  return (list || []).map((e) => {
    const env = typeof e === "string" ? { name: e } : e;
    return { ...env, color: envColor(env) };
  });
}

function EnvLabel({ env, showCount }) {
  return (
    <>
      <EnvDot color={env.color} size={8} />
      <span className="sg-env-switcher__name">{env.name}</span>
      {env.protected && <Icon name="lock" size={12} label="Protected" className="sg-env-switcher__lock" />}
      {showCount && env.count != null && <span className="sg-env-switcher__count">{env.count}</span>}
    </>
  );
}

function EnvMenu({ anchorRef, open, onClose, items, value, onSelect, onAdd, addLabel, label, showCounts }) {
  const listRef = useRef(null);
  const [node, setNode] = useState(null);
  const [pos, setPos] = useState(null);
  const id = useId();
  const setList = (el) => {
    listRef.current = el;
    setNode(el);
  };
  useLayoutEffect(() => {
    if (!open || !node || !anchorRef.current) {
      if (pos) setPos(null);
      return undefined;
    }
    const place = () => {
      const p = computePosition(
        anchorRef.current.getBoundingClientRect(),
        node.getBoundingClientRect(),
        "bottom-start",
        6,
      );
      setPos((q) => (q && q.top === p.top && q.left === p.left ? q : p));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, node]);
  const placed = !!pos;
  useLayoutEffect(() => {
    if (open && node && placed) node.focus({ preventScroll: true });
  }, [open, node, placed]);
  const style = {
    position: "fixed",
    top: pos ? pos.top : -9999,
    left: pos ? pos.left : -9999,
    visibility: pos ? "visible" : "hidden",
  };
  const total = items.length + (onAdd ? 1 : 0);
  const initial = Math.max(
    0,
    items.findIndex((e) => e.name === value),
  );
  const [idx, setIdx] = useState(initial);
  const close = useCallback(
    (restore) => {
      onClose();
      if (restore && anchorRef.current) anchorRef.current.focus();
    },
    [onClose, anchorRef],
  );
  const outside = useCallback(() => close(false), [close]);
  useOutsideClick(open, [listRef, anchorRef], outside);
  const escapeMenu = useCallback(() => close(true), [close]);
  useEscape(open, escapeMenu);
  useEffect(() => {
    if (open) setIdx(initial);
  }, [open]);
  if (!open) return null;
  const choose = (i) => {
    if (i < items.length) onSelect(items[i].name);
    else if (onAdd) onAdd();
    close(true);
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => (i - 1 + total) % total);
    } else if (e.key === "Home") {
      e.preventDefault();
      setIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIdx(total - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(idx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  };
  return (
    <Portal>
      <div
        ref={setList}
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        aria-activedescendant={`${id}-${idx}`}
        className="sg-env-menu"
        style={style}
        onKeyDown={onKeyDown}
      >
        {items.map((env, i) => (
          <div
            key={env.name}
            id={`${id}-${i}`}
            role="option"
            aria-selected={env.name === value}
            data-active={i === idx || undefined}
            className="sg-env-menu__item"
            onMouseEnter={() => setIdx(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(i)}
          >
            <EnvLabel env={env} showCount={showCounts} />
            <Icon name="check" size={14} className="sg-env-menu__check" />
          </div>
        ))}
        {onAdd && (
          <>
            <div className="sg-env-menu__sep" role="separator" />
            <div
              id={`${id}-${items.length}`}
              role="option"
              aria-selected={false}
              data-active={idx === items.length || undefined}
              className="sg-env-menu__item sg-env-menu__item--add"
              onMouseEnter={() => setIdx(items.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(items.length)}
            >
              <Icon name="plus" size={14} />
              <span className="sg-env-switcher__name">{addLabel}</span>
            </div>
          </>
        )}
      </div>
    </Portal>
  );
}

export const EnvSwitcher = forwardRef(function EnvSwitcher(
  {
    environments = [],
    value,
    defaultValue,
    onValueChange,
    mode = "tabs",
    onAdd,
    addLabel = "Add environment",
    showCounts = true,
    activation = "auto",
    idPrefix,
    "aria-label": ariaLabel = "Environments",
    className,
    ...rest
  },
  ref,
) {
  const envs = normalize(environments);
  const [current, setCurrent] = useControllable(
    value,
    defaultValue !== undefined ? defaultValue : envs[0]?.name,
    onValueChange,
  );
  const active = envs.find((e) => e.name === current) || envs[0];
  const auto = useId();
  const prefix = idPrefix || `sg-env-${auto.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const measureRef = useRef(null);
  const moreRef = useRef(null);
  const triggerRef = useRef(null);
  const [dims, setDims] = useState(null);
  const [bar, setBar] = useState(null);
  const pendingFocus = useRef(null);

  const setRoot = (el) => {
    rootRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const measure = useCallback(() => {
    const root = rootRef.current;
    const m = measureRef.current;
    if (!root || !m) return;
    const tabs = Array.from(m.querySelectorAll("[data-measure-tab]")).map((el) => el.offsetWidth);
    const moreW = (m.querySelector("[data-measure-more]") || { offsetWidth: 0 }).offsetWidth;
    const addW = onAdd ? (m.querySelector("[data-measure-add]") || { offsetWidth: 0 }).offsetWidth + 2 : 0;
    const next = { tabs, moreW, avail: root.clientWidth - addW };
    setDims((d) =>
      d && d.avail === next.avail && d.moreW === next.moreW && d.tabs.join() === next.tabs.join() ? d : next,
    );
  }, [onAdd ? 1 : 0, envs.length]);

  useLayoutEffect(() => {
    if (mode !== "tabs") return undefined;
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [mode, measure, showCounts, environments]);

  let visible = envs;
  if (dims && dims.tabs.length === envs.length) {
    const sum = dims.tabs.reduce((x, y) => x + y, 0);
    if (sum > dims.avail) {
      const ai = Math.max(0, envs.indexOf(active));
      const budget = dims.avail - dims.moreW - 2;
      const chosen = new Set([ai]);
      let used = dims.tabs[ai];
      for (let i = 0; i < envs.length; i++) {
        if (i === ai) continue;
        if (used + dims.tabs[i] > budget) break;
        chosen.add(i);
        used += dims.tabs[i];
      }
      visible = envs.filter((_e, i) => chosen.has(i));
    }
  }
  const overflow = envs.filter((e) => visible.indexOf(e) < 0);

  useLayoutEffect(() => {
    if (mode !== "tabs") return;
    const list = listRef.current;
    const root = rootRef.current;
    if (!list || !root) return;
    const tab = list.querySelector('[role="tab"][aria-selected="true"] .sg-env-switcher__tab-inner');
    if (!tab) {
      setBar(null);
      return;
    }
    const r = tab.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const next = { x: Math.round(r.left - rr.left + root.scrollLeft), w: Math.round(r.width), color: active.color };
    setBar((b) => (b && b.x === next.x && b.w === next.w && b.color === next.color ? b : { ...next, ready: !!b }));
  });

  useEffect(() => {
    const name = pendingFocus.current;
    if (!name || !listRef.current) return;
    pendingFocus.current = null;
    const el = listRef.current.querySelector(`[data-env="${CSS.escape(name)}"]`);
    if (el) el.focus();
  });

  const select = (name, focus) => {
    if (name !== current) setCurrent(name);
    if (focus) pendingFocus.current = name;
  };

  const onTabKeyDown = (e) => {
    const names = visible.map((v) => v.name);
    const i = names.indexOf(e.currentTarget.getAttribute("data-env"));
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % names.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + names.length) % names.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = names.length - 1;
    else if ((e.key === "Enter" || e.key === " ") && activation === "manual") {
      e.preventDefault();
      select(names[i], true);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    const el = listRef.current?.querySelector(`[data-env="${CSS.escape(names[next])}"]`);
    if (el) el.focus();
    if (activation === "auto") select(names[next], true);
  };

  if (mode === "select") {
    return (
      <div ref={setRoot} className={cx("sg-env-switcher", "sg-env-switcher--select", className)} {...rest}>
        <button
          ref={triggerRef}
          type="button"
          className="sg-env-switcher__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={active ? `${ariaLabel}: ${active.name}${active.protected ? ", protected" : ""}` : ariaLabel}
          style={{ "--_c": `var(--env-${active ? active.color : "gray"})` }}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {active && <EnvLabel env={active} showCount={false} />}
          <Icon name="chevrons-up-down" size={14} className="sg-env-switcher__chevron" />
        </button>
        <EnvMenu
          anchorRef={triggerRef}
          open={open}
          onClose={() => setOpen(false)}
          items={envs}
          value={current}
          onSelect={(name) => select(name, false)}
          onAdd={onAdd}
          addLabel={addLabel}
          label={ariaLabel}
          showCounts={showCounts}
        />
      </div>
    );
  }

  return (
    <div ref={setRoot} className={cx("sg-env-switcher", "sg-env-switcher--tabs", className)} {...rest}>
      <div ref={listRef} role="tablist" aria-label={ariaLabel} className="sg-env-switcher__list">
        {visible.map((env) => {
          const on = env === active;
          return (
            <button
              key={env.name}
              type="button"
              role="tab"
              id={`${prefix}-tab-${env.name}`}
              aria-controls={`${prefix}-panel-${env.name}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              data-env={env.name}
              className="sg-env-switcher__tab"
              style={{ "--_c": `var(--env-${env.color})` }}
              onClick={() => select(env.name, true)}
              onKeyDown={onTabKeyDown}
            >
              <span className="sg-env-switcher__tab-inner">
                <EnvLabel env={env} showCount={showCounts} />
              </span>
            </button>
          );
        })}
      </div>
      {overflow.length > 0 && (
        <button
          ref={moreRef}
          type="button"
          className="sg-env-switcher__more"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className="sg-env-switcher__more-dots" aria-hidden="true">
            {overflow.slice(0, 3).map((e) => (
              <EnvDot key={e.name} color={e.color} size={6} />
            ))}
          </span>
          {overflow.length} more
          <Icon name="chevron-down" size={14} />
        </button>
      )}
      {onAdd && <IconButton size="sm" icon="plus" label={addLabel} className="sg-env-switcher__add" onClick={onAdd} />}
      {bar && (
        <span
          className="sg-env-switcher__bar"
          data-ready={bar.ready || undefined}
          style={{
            width: 100,
            transform: `translateX(${bar.x}px) scaleX(${bar.w / 100})`,
            background: `var(--env-${bar.color})`,
          }}
          aria-hidden="true"
        />
      )}
      <div ref={measureRef} className="sg-env-switcher__measure" aria-hidden="true">
        {envs.map((env) => (
          <span key={env.name} data-measure-tab="" className="sg-env-switcher__tab">
            <span className="sg-env-switcher__tab-inner">
              <EnvLabel env={env} showCount={showCounts} />
            </span>
          </span>
        ))}
        <span data-measure-more="" className="sg-env-switcher__more">
          <span className="sg-env-switcher__more-dots">
            <EnvDot size={6} />
            <EnvDot size={6} />
            <EnvDot size={6} />
          </span>
          {envs.length} more
          <Icon name="chevron-down" size={14} />
        </span>
        {onAdd && <span data-measure-add="" className="sg-icon-button sg-icon-button--sm" />}
      </div>
      <EnvMenu
        anchorRef={moreRef}
        open={open && overflow.length > 0}
        onClose={() => setOpen(false)}
        items={overflow}
        value={current}
        onSelect={(name) => select(name, false)}
        label={`More ${ariaLabel.toLowerCase()}`}
        showCounts={showCounts}
      />
    </div>
  );
});
