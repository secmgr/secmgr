import { forwardRef, useMemo, useRef, useState } from "react";
import { cx, useControllable } from "../_lib/util.js";
import { Checkbox } from "../Checkbox/Checkbox.jsx";
import { Icon } from "../Icon/Icon.jsx";

const SKELETON = [72, 48, 60, 36, 54, 44, 66];
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role='menuitem'], [role='switch'], [data-row-click-ignore]";

function trackOf(col) {
  if (col.width == null) return col.minWidth ? `minmax(${col.minWidth}px, 1fr)` : "minmax(0, 1fr)";
  return typeof col.width === "number" ? `${col.width}px` : col.width;
}

function minWidthOf(columns, selectable) {
  let w = selectable ? 32 : 0;
  for (const c of columns) w += typeof c.width === "number" ? c.width : c.minWidth || 140;
  return w;
}

export const Table = forwardRef(function Table(
  {
    columns = [],
    rows,
    groups,
    rowKey = "id",
    rowLabel,
    selectable = false,
    selected,
    defaultSelected = [],
    onSelectedChange,
    density = "comfortable",
    onRowClick,
    empty,
    loading = false,
    loadingRows = 5,
    stickyHeader = true,
    maxHeight,
    framed = false,
    label,
    className,
    style,
    ...rest
  },
  ref,
) {
  const getKey = typeof rowKey === "function" ? rowKey : (r) => r[rowKey];
  const [sel, setSel] = useControllable(selected, defaultSelected, onSelectedChange);
  const selSet = useMemo(() => new Set(sel || []), [sel]);
  const [closed, setClosed] = useState(
    () => new Set((groups || []).filter((g) => g.defaultCollapsed).map((g) => g.key)),
  );
  const [activeId, setActiveId] = useState(null);
  const bodyRef = useRef(null);

  const flat = groups ? groups.flatMap((g) => g.rows) : rows || [];
  const keys = flat.map(getKey);
  const allOn = keys.length > 0 && keys.every((k) => selSet.has(k));
  const someOn = !allOn && keys.some((k) => selSet.has(k));

  const toggleRow = (k) => {
    const next = new Set(selSet);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSel(keys.filter((x) => next.has(x)));
  };
  const toggleAll = () => setSel(allOn ? [] : keys.slice());
  const toggleGroup = (gk, open) => {
    setClosed((prev) => {
      const next = new Set(prev);
      const shouldOpen = open !== undefined ? open : next.has(gk);
      if (shouldOpen) next.delete(gk);
      else next.add(gk);
      return next;
    });
  };

  const items = [];
  if (groups) {
    for (const g of groups) {
      items.push({ type: "group", id: `g:${g.key}`, group: g });
      if (!closed.has(g.key)) for (const r of g.rows) items.push({ type: "row", id: `r:${getKey(r)}`, row: r });
    }
  } else {
    for (const r of flat) items.push({ type: "row", id: `r:${getKey(r)}`, row: r });
  }
  const focusId = items.some((it) => it.id === activeId) ? activeId : items[0]?.id;
  const rowIndex = new Map(flat.map((r, i) => [getKey(r), i]));

  const moveTo = (el) => {
    if (!el) return;
    el.focus();
    setActiveId(el.getAttribute("data-row-id"));
  };

  const onKeyDown = (e) => {
    const el = e.target;
    if (!el.hasAttribute?.("data-row-id")) return;
    const list = Array.from(bodyRef.current.querySelectorAll("[data-row-id]"));
    const i = list.indexOf(el);
    const id = el.getAttribute("data-row-id");
    const item = items.find((it) => it.id === id);
    if (!item) return;
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      moveTo(list[Math.min(list.length - 1, i + 1)]);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      moveTo(list[Math.max(0, i - 1)]);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      moveTo(list[0]);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      moveTo(list[list.length - 1]);
      return;
    }
    if (item.type === "group") {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleGroup(item.group.key);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        toggleGroup(item.group.key, false);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        toggleGroup(item.group.key, true);
      }
      return;
    }
    if (e.key === "Enter" && onRowClick) {
      e.preventDefault();
      onRowClick(item.row, e);
      return;
    }
    if ((e.key === " " || e.key === "x") && selectable) {
      e.preventDefault();
      toggleRow(getKey(item.row));
    }
  };

  const onRowClickInternal = (item) => (e) => {
    setActiveId(item.id);
    if (e.target.closest?.(INTERACTIVE) && e.target.closest(INTERACTIVE) !== e.currentTarget) return;
    if (onRowClick) onRowClick(item.row, e);
  };

  const cellClass = (c) =>
    cx(
      "sg-table__cell",
      c.align && c.align !== "left" && `sg-table__cell--${c.align}`,
      c.mono && "sg-table__cell--mono",
      c.className,
    );
  const renderContent = (c, r, i) => {
    const v = c.render ? c.render(r, i) : r[c.key];
    return typeof v === "string" || typeof v === "number" ? <span className="sg-table__text">{v}</span> : v;
  };

  const renderRow = (item) => {
    const r = item.row;
    const k = getKey(r);
    const on = selSet.has(k);
    return (
      <div
        key={item.id}
        role="row"
        data-row-id={item.id}
        tabIndex={item.id === focusId ? 0 : -1}
        aria-selected={selectable ? on : undefined}
        aria-rowindex={rowIndex.get(k) + 2}
        className={cx("sg-table__row", onRowClick && "sg-table__row--clickable", r.className)}
        onClick={onRowClickInternal(item)}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setActiveId(item.id);
        }}
      >
        {selectable && (
          <div role="gridcell" className="sg-table__cell sg-table__cell--select">
            <Checkbox
              checked={on}
              onCheckedChange={() => toggleRow(k)}
              aria-label={`Select ${rowLabel ? rowLabel(r) : k}`}
              tabIndex={-1}
            />
          </div>
        )}
        {columns.map((c) => (
          <div key={c.key} role="gridcell" className={cellClass(c)}>
            {renderContent(c, r, rowIndex.get(k))}
          </div>
        ))}
      </div>
    );
  };

  const renderGroup = (item) => {
    const g = item.group;
    const open = !closed.has(g.key);
    const count = g.count != null ? g.count : g.rows.length;
    return (
      <div
        key={item.id}
        role="row"
        data-row-id={item.id}
        tabIndex={item.id === focusId ? 0 : -1}
        aria-expanded={open}
        className="sg-table__group"
        onClick={() => {
          setActiveId(item.id);
          toggleGroup(g.key);
        }}
      >
        <div role="gridcell" className="sg-table__group-cell">
          <Icon name="chevron-right" size={14} className="sg-table__group-chevron" />
          {g.icon && (
            <span className="sg-table__group-icon">
              {typeof g.icon === "string" ? <Icon name={g.icon} size={14} /> : g.icon}
            </span>
          )}
          <span className="sg-table__group-label">{g.label}</span>
          <span className="sg-table__group-count">{count}</span>
        </div>
      </div>
    );
  };

  const template = [selectable && "var(--space-32)", ...columns.map(trackOf)].filter(Boolean).join(" ");
  const showEmpty = !loading && flat.length === 0;

  return (
    <div
      ref={ref}
      className={cx(
        "sg-table",
        `sg-table--${density}`,
        framed && "sg-table--framed",
        stickyHeader && "sg-table--sticky",
        className,
      )}
      style={{ maxHeight, ...style }}
      {...rest}
    >
      <div
        role="grid"
        aria-label={label}
        aria-busy={loading || undefined}
        aria-multiselectable={selectable || undefined}
        aria-rowcount={flat.length + 1}
        className="sg-table__grid"
        style={{ "--_cols": template, minWidth: minWidthOf(columns, selectable) }}
      >
        <div role="rowgroup" className="sg-table__head">
          <div role="row" aria-rowindex={1} className="sg-table__row sg-table__row--head">
            {selectable && (
              <div role="columnheader" className="sg-table__cell sg-table__cell--select">
                <Checkbox
                  checked={allOn}
                  indeterminate={someOn}
                  onCheckedChange={toggleAll}
                  disabled={loading || !keys.length}
                  aria-label={allOn ? "Clear selection" : "Select all rows"}
                />
              </div>
            )}
            {columns.map((c) => (
              <div key={c.key} role="columnheader" className={cellClass(c)}>
                <span className="sg-table__text">{c.header}</span>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup" className="sg-table__body" ref={bodyRef} onKeyDown={onKeyDown}>
          {loading ? (
            Array.from({ length: loadingRows }, (_, ri) => (
              <div key={ri} role="row" className="sg-table__row sg-table__row--skeleton" aria-hidden="true">
                {selectable && (
                  <div className="sg-table__cell sg-table__cell--select">
                    <span className="sg-table__bone sg-table__bone--box" />
                  </div>
                )}
                {columns.map((c, ci) => (
                  <div key={c.key} className={cellClass(c)}>
                    <span
                      className="sg-table__bone"
                      style={{ width: `${SKELETON[(ri * 3 + ci) % SKELETON.length]}%` }}
                    />
                  </div>
                ))}
              </div>
            ))
          ) : showEmpty ? (
            <div role="row" className="sg-table__empty">
              <div role="gridcell" className="sg-table__empty-cell">
                {empty || <span className="sg-table__empty-text">No rows to show.</span>}
              </div>
            </div>
          ) : (
            items.map((it) => (it.type === "group" ? renderGroup(it) : renderRow(it)))
          )}
        </div>
      </div>
    </div>
  );
});
