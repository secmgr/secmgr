import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { useFloating } from "../_lib/floating.js";
import {
  firstEnabled,
  isPrintableKey,
  layerAbove,
  stepIndex,
  useMergedRef,
  usePresence,
  useTypeahead,
} from "../_lib/inputs.js";
import { useLayer, useLayerZ } from "../_lib/overlay.js";
import { cx, useControllable, useOutsideClick } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";

const textOf = (o) =>
  o.textValue != null
    ? String(o.textValue)
    : typeof o.label === "string" || typeof o.label === "number"
      ? String(o.label)
      : String(o.value);

function normalize(options) {
  return (options || []).map((o) =>
    typeof o === "string" || typeof o === "number"
      ? { value: o, label: String(o) }
      : { ...o, label: o.label != null ? o.label : String(o.value) },
  );
}

export const Select = forwardRef(function Select(
  {
    options = [],
    value,
    defaultValue = null,
    onValueChange,
    placeholder = "Select an option",
    size = "md",
    invalid = false,
    disabled = false,
    renderValue,
    searchable,
    searchPlaceholder,
    noun,
    emptyText,
    icon,
    mono = false,
    name,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    placement = "bottom-start",
    menuClassName,
    className,
    style,
    id,
    onKeyDown,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    ...rest
  },
  ref,
) {
  const uid = useId();
  const triggerId = id || `sg-select-${uid}`;
  const listId = `${triggerId}-listbox`;
  const items = useMemo(() => normalize(options), [options]);
  const [selected, setSelected] = useControllable(value, defaultValue, onValueChange);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [layer, setLayer] = useState(null);
  const triggerRef = useRef(null);
  const setTriggerRef = useMergedRef(triggerRef, ref);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const scrollToActive = useRef(false);
  const typeahead = useTypeahead();
  const presence = usePresence(!!open, 80);
  const floating = useFloating({
    open: presence.mounted,
    anchorRef: triggerRef,
    floatingRef: menuRef,
    placement,
    offset: 4,
    matchWidth: true,
  });

  const isSearchable = searchable != null ? searchable : items.length > 8;
  const plural = noun ? (/s$/.test(noun) ? noun : `${noun}s`) : "options";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) =>
      [textOf(o), String(o.value), typeof o.description === "string" ? o.description : "", o.group || ""].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [items, query]);
  const isDisabled = useCallback((i) => !filtered[i] || !!filtered[i].disabled, [filtered]);
  const selectedItem = items.find((o) => o.value === selected) || null;

  const focusTrigger = () => {
    if (triggerRef.current) triggerRef.current.focus({ preventScroll: true });
  };
  const close = (restore) => {
    setOpen(false);
    if (restore) focusTrigger();
  };
  const openMenu = (how, seed) => {
    if (disabled) return;
    const sel = items.findIndex((o) => o.value === selected && !o.disabled);
    let start = sel >= 0 ? sel : firstEnabled(items.length, (i) => !!items[i].disabled, how === "last");
    if (how === "last" && sel < 0) start = firstEnabled(items.length, (i) => !!items[i].disabled, true);
    if (seed && !isSearchable) {
      const q = typeahead(seed);
      const hit = items.findIndex((o) => !o.disabled && textOf(o).toLowerCase().startsWith(q));
      if (hit >= 0) start = hit;
    }
    setQuery(seed && isSearchable ? seed : "");
    setActive(start);
    scrollToActive.current = true;
    setLayer(null);
    const above = layerAbove(triggerRef.current);
    if (above != null) {
      const base = parseInt(window.getComputedStyle(document.documentElement).getPropertyValue("--z-popover"), 10) || 0;
      setLayer(Math.max(base, above));
    }
    setOpen(true);
  };
  const commit = (o) => {
    if (!o || o.disabled) return;
    setSelected(o.value);
    close(true);
  };

  const visible = floating.style.visibility === "visible";
  useEffect(() => {
    if (!open || !visible) return;
    const target = isSearchable ? searchRef.current : listRef.current;
    if (target && !target.contains(document.activeElement)) target.focus({ preventScroll: true });
  }, [open, visible]);

  useEffect(() => {
    if (!open || active >= 0) return;
    const sel = filtered.findIndex((o) => o.value === selected && !o.disabled);
    setActive(sel >= 0 ? sel : firstEnabled(filtered.length, isDisabled));
    scrollToActive.current = true;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      close(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open || !query) return;
    setActive(firstEnabled(filtered.length, isDisabled));
  }, [query]);

  useEffect(() => {
    if (presence.mounted) floating.update();
  }, [filtered.length, presence.mounted]);

  useEffect(() => {
    if (!open || active < 0 || !scrollToActive.current || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${active}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active, open, filtered]);

  useOutsideClick(!!open, [triggerRef, menuRef], () => close(false));
  const inLayer = (t) => !!(menuRef.current?.contains(t) || triggerRef.current?.contains(t));
  useLayer(!!open, { contains: inLayer, onEscape: () => close(true), onOutside: () => close(false) });
  const contextZ = useLayerZ("var(--z-popover)");

  const onTriggerKey = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented || disabled || open) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu("last");
    } else if (isPrintableKey(e)) {
      e.preventDefault();
      openMenu("first", e.key);
    }
  };

  const move = (fn) => {
    scrollToActive.current = true;
    setActive(fn);
  };
  const onMenuKey = (e) => {
    const n = filtered.length;
    const inSearch = e.target === searchRef.current;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move((a) => (a < 0 ? firstEnabled(n, isDisabled) : stepIndex(n, a, 1, isDisabled, false)));
        break;
      case "ArrowUp":
        e.preventDefault();
        move((a) => (a < 0 ? firstEnabled(n, isDisabled, true) : stepIndex(n, a, -1, isDisabled, false)));
        break;
      case "Home":
        if (inSearch && query) break;
        e.preventDefault();
        move(() => firstEnabled(n, isDisabled));
        break;
      case "End":
        if (inSearch && query) break;
        e.preventDefault();
        move(() => firstEnabled(n, isDisabled, true));
        break;
      case "PageDown":
        e.preventDefault();
        move((a) => {
          let i = a;
          for (let k = 0; k < 8; k++) i = stepIndex(n, i, 1, isDisabled, false);
          return i;
        });
        break;
      case "PageUp":
        e.preventDefault();
        move((a) => {
          let i = a;
          for (let k = 0; k < 8; k++) i = stepIndex(n, i, -1, isDisabled, false);
          return i;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (active >= 0) commit(filtered[active]);
        break;
      case " ":
        if (inSearch) break;
        e.preventDefault();
        if (active >= 0) commit(filtered[active]);
        break;
      case "Tab":
        close(true);
        break;
      default:
        if (!inSearch && isPrintableKey(e)) {
          e.preventDefault();
          const q = typeahead(e.key);
          const from = q.length === 1 ? active + 1 : Math.max(active, 0);
          for (let k = 0; k < n; k++) {
            const i = (from + k) % n;
            if (!filtered[i].disabled && textOf(filtered[i]).toLowerCase().startsWith(q)) {
              move(() => i);
              break;
            }
          }
        }
    }
  };

  const optionId = (i) => `${listId}-${i}`;
  const segments = [];
  filtered.forEach((o, i) => {
    const g = o.group || null;
    const last = segments[segments.length - 1];
    if (last && last.group === g) last.items.push({ o, i });
    else segments.push({ group: g, items: [{ o, i }] });
  });

  const renderOption = ({ o, i }) => {
    const isSel = o.value === selected;
    return (
      <div
        key={`${String(o.value)}-${i}`}
        id={optionId(i)}
        role="option"
        data-index={i}
        aria-selected={isSel}
        aria-disabled={o.disabled || undefined}
        data-active={i === active || undefined}
        className={cx("sg-select__option", { "sg-select__option--tall": !!o.description })}
        onPointerMove={() => {
          if (!o.disabled && i !== active) {
            scrollToActive.current = false;
            setActive(i);
          }
        }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commit(o)}
      >
        {o.prefix != null && <span className="sg-select__prefix">{o.prefix}</span>}
        {o.icon && <Icon name={o.icon} size={16} className="sg-select__option-icon" />}
        <span className="sg-select__text">
          <span className="sg-select__label">{o.label}</span>
          {o.description && <span className="sg-select__description">{o.description}</span>}
        </span>
        {o.kbd && <Kbd keys={o.kbd} size="sm" className="sg-select__kbd" />}
        <span className="sg-select__check" aria-hidden="true">
          {isSel && <Icon name="check" size={16} />}
        </span>
      </div>
    );
  };

  const empty =
    typeof emptyText === "function" ? emptyText(query) : emptyText || `No ${plural} match '${query.trim()}'`;
  const activeId = open && active >= 0 && filtered[active] ? optionId(active) : undefined;
  const labelledBy = ariaLabelledby || undefined;
  const iconSize = size === "sm" ? 14 : 16;
  const valueNode = selectedItem ? (renderValue ? renderValue(selectedItem) : selectedItem.label) : placeholder;
  const isInvalid = invalid || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";

  const menu = presence.mounted
    ? ReactDOM.createPortal(
        <div
          ref={menuRef}
          className={cx("sg-select__menu", { "sg-select__menu--mono": mono }, menuClassName)}
          style={{ ...floating.style, zIndex: layer != null ? layer : contextZ }}
          data-state={presence.state}
          data-side={floating.side}
          onKeyDown={onMenuKey}
        >
          {isSearchable && (
            <div className="sg-select__search">
              <Icon name="search" size={14} className="sg-select__search-icon" />
              <input
                ref={searchRef}
                className="sg-select__search-input"
                type="text"
                value={query}
                placeholder={searchPlaceholder || `Filter ${plural}`}
                onChange={(e) => setQuery(e.target.value)}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeId}
                aria-label={searchPlaceholder || `Filter ${plural}`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            className="sg-select__list"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel || placeholder}
            aria-activedescendant={isSearchable ? undefined : activeId}
          >
            {segments.map((s, k) =>
              s.group ? (
                <div key={`g-${k}`} role="group" aria-labelledby={`${listId}-g${k}`} className="sg-select__group">
                  <div id={`${listId}-g${k}`} className="sg-select__group-label">
                    {s.group}
                  </div>
                  {s.items.map(renderOption)}
                </div>
              ) : (
                s.items.map(renderOption)
              ),
            )}
          </div>
          {filtered.length === 0 && (
            <div className="sg-select__empty" role="status">
              {empty}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={setTriggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={!!open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        aria-invalid={isInvalid || undefined}
        disabled={disabled}
        className={cx("sg-input", `sg-input--${size}`, "sg-select__trigger", { "sg-input--mono": mono }, className)}
        style={style}
        data-state={open ? "open" : "closed"}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
        data-placeholder={selectedItem ? undefined : ""}
        onClick={() => (open ? close(true) : openMenu("first"))}
        onKeyDown={onTriggerKey}
        {...rest}
      >
        {icon && <Icon name={icon} size={iconSize} className="sg-input__icon" />}
        {!renderValue && selectedItem && selectedItem.prefix != null && (
          <span className="sg-select__prefix">{selectedItem.prefix}</span>
        )}
        {!icon && !renderValue && selectedItem?.icon && (
          <Icon name={selectedItem.icon} size={iconSize} className="sg-input__icon" />
        )}
        <span className="sg-select__value">{valueNode}</span>
        <Icon name="chevrons-up-down" size={14} className="sg-select__chevron" />
      </button>
      {name && <input type="hidden" name={name} value={selected == null ? "" : String(selected)} />}
      {menu}
    </>
  );
});
