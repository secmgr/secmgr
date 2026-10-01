import { forwardRef, useMemo, useRef, useState } from "react";
import { envName, groupByPrefix, matrixRows, prefixOf } from "../_lib/compare.js";
import { cx, n, useControllable } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { Checkbox } from "../Checkbox/Checkbox.jsx";
import { EnvDot, envColor } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";

export { fingerprint } from "../_lib/compare.js";

function defaultReference(envs) {
  const prot = envs.find((e) => e && typeof e === "object" && e.protected);
  return envName(prot || envs[0]);
}

function describe(cell, refName) {
  if (cell.state === "missing") return "missing";
  if (cell.empty) return cell.state === "same" ? `empty, same as ${refName}` : "empty";
  if (cell.state === "reference") return `reference value, fingerprint ${cell.fingerprint}`;
  if (cell.state === "same") return `same as ${refName}, fingerprint ${cell.fingerprint}`;
  if (cell.state === "differs") return `differs from ${refName}, fingerprint ${cell.fingerprint}`;
  return `fingerprint ${cell.fingerprint}`;
}

export const CompareMatrix = forwardRef(function CompareMatrix(
  {
    envs = [],
    values = {},
    reference,
    referenceSelect,
    onlyDifferences,
    defaultOnlyDifferences = false,
    onOnlyDifferencesChange,
    groupBy = "prefix",
    collapsed,
    defaultCollapsed = [],
    onCollapsedChange,
    annotations,
    onCellClick,
    onAdd,
    maxHeight,
    loading = false,
    className,
    style,
    ...rest
  },
  ref,
) {
  const names = envs.map(envName);
  const refName = reference && names.includes(reference) ? reference : defaultReference(envs);
  const [onlyDiff, setOnlyDiff] = useControllable(onlyDifferences, defaultOnlyDifferences, onOnlyDifferencesChange);
  const [shut, setShut] = useControllable(collapsed, defaultCollapsed, onCollapsedChange);
  const [active, setActive] = useState(null);
  const bodyRef = useRef(null);

  const rows = useMemo(() => matrixRows(envs, values, refName), [envs, values, refName]);
  const byKey = useMemo(() => {
    const m = {};
    for (const r of rows) m[r.key] = r;
    return m;
  }, [rows]);
  const items = useMemo(
    () =>
      groupBy === "prefix" ? groupByPrefix(rows.map((r) => r.key)) : rows.map((r) => ({ type: "key", key: r.key })),
    [rows, groupBy],
  );
  const diffTotal = rows.filter((r) => r.hasDifference).length;
  const shutSet = new Set(shut || []);
  const toggleGroup = (p) => {
    const next = new Set(shutSet);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setShut(Array.from(next));
  };

  const keep = (k) => byKey[k].hasDifference || !!annotations?.[k];
  const visible = [];
  for (const it of items) {
    if (it.type === "group") {
      const keys = onlyDiff ? it.keys.filter(keep) : it.keys;
      if (!keys.length) continue;
      visible.push({ type: "group", prefix: it.prefix, keys, all: it.keys });
      if (!shutSet.has(it.prefix)) for (const k of keys) visible.push({ type: "key", key: k, grouped: true });
    } else if (!onlyDiff || keep(it.key)) visible.push({ type: "key", key: it.key });
  }

  const cellId = (rowKey, col) => `${rowKey}|${col}`;
  const ids = [];
  visible.forEach((it) => {
    if (it.type === "group") ids.push(cellId(`g:${it.prefix}`, 0));
    else for (let ci = 0; ci < names.length; ci++) ids.push(cellId(it.key, ci + 1));
  });
  const current = active && ids.includes(active) ? active : ids[0];
  const tab = (id) => (id === current ? 0 : -1);

  const onKeyDown = (e) => {
    const el = e.target.closest?.("[data-mx-row]");
    if (!el || !bodyRef.current) return;
    const r = Number(el.dataset.mxRow);
    const c = Number(el.dataset.mxCol);
    const all = Array.from(bodyRef.current.querySelectorAll("[data-mx-row]"));
    const inRow = (ri) => all.filter((x) => Number(x.dataset.mxRow) === ri);
    const pick = (list, col) =>
      list.reduce(
        (best, x) =>
          !best || Math.abs(Number(x.dataset.mxCol) - col) < Math.abs(Number(best.dataset.mxCol) - col) ? x : best,
        null,
      );
    const lastRow = Number(all[all.length - 1].dataset.mxRow);
    let target = null;
    if (e.key === "ArrowRight") target = inRow(r).find((x) => Number(x.dataset.mxCol) === c + 1);
    else if (e.key === "ArrowLeft") target = inRow(r).find((x) => Number(x.dataset.mxCol) === c - 1);
    else if (e.key === "ArrowDown" && r < lastRow) target = pick(inRow(r + 1), c);
    else if (e.key === "ArrowUp" && r > 0) target = pick(inRow(r - 1), c);
    else if (e.key === "Home") target = e.ctrlKey || e.metaKey ? all[0] : inRow(r)[0];
    else if (e.key === "End") target = e.ctrlKey || e.metaKey ? all[all.length - 1] : inRow(r)[inRow(r).length - 1];
    else return;
    e.preventDefault();
    if (target) {
      target.focus();
      setActive(target.dataset.mxId);
    }
  };

  const focusProps = (id, ri, ci) => ({
    tabIndex: tab(id),
    "data-mx-row": ri,
    "data-mx-col": ci,
    "data-mx-id": id,
    onFocus: () => setActive(id),
  });

  const renderCell = (row, nm, ri, ci) => {
    const cell = row.cells[nm];
    const id = cellId(row.key, ci);
    if (cell.state === "missing") {
      return (
        <td key={nm} className="sg-compare-matrix__td" data-state="missing">
          <div className="sg-compare-matrix__missing">
            <span className="sg-compare-matrix__missing-label">Missing</span>
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              className="sg-compare-matrix__add"
              aria-label={`Add ${row.key} to ${nm}`}
              onClick={() => (onAdd ? onAdd(row.key, nm) : onCellClick?.(row.key, nm))}
              {...focusProps(id, ri, ci)}
            >
              Add
            </Button>
          </div>
        </td>
      );
    }
    const icon = cell.state === "same" ? "check" : cell.state === "differs" ? "equal-not" : null;
    return (
      <td key={nm} className="sg-compare-matrix__td" data-state={cell.state}>
        <button
          type="button"
          className="sg-compare-matrix__cell"
          data-state={cell.state}
          aria-label={`${row.key} in ${nm}: ${describe(cell, refName)}`}
          onClick={() => onCellClick?.(row.key, nm)}
          {...focusProps(id, ri, ci)}
        >
          <span className="sg-compare-matrix__mark" aria-hidden="true">
            {icon && <Icon name={icon} size={14} />}
          </span>
          {cell.empty ? (
            <span className="sg-compare-matrix__empty">Empty</span>
          ) : (
            <span className="sg-compare-matrix__fp">{cell.fingerprint}</span>
          )}
        </button>
      </td>
    );
  };

  const groupSummary = (keys, nm) => {
    let missing = 0;
    let differs = 0;
    for (const k of keys) {
      const s = byKey[k].cells[nm].state;
      if (s === "missing") missing++;
      else if (s === "differs") differs++;
    }
    if (missing) return <span className="sg-compare-matrix__sum" data-tone="missing">{`${missing} missing`}</span>;
    if (differs)
      return (
        <span
          className="sg-compare-matrix__sum"
          data-tone="differs"
        >{`${differs} ${differs === 1 ? "differs" : "differ"}`}</span>
      );
    return (
      <span className="sg-compare-matrix__sum" data-tone="same">
        <Icon name="check" size={14} />
      </span>
    );
  };

  let ri = -1;
  return (
    <div ref={ref} className={cx("sg-compare-matrix", className)} style={style} {...rest}>
      <div className="sg-compare-matrix__toolbar">
        <label className="sg-compare-matrix__filter">
          <Checkbox checked={!!onlyDiff} onCheckedChange={setOnlyDiff} />
          <span>Only differences</span>
          <span className="sg-compare-matrix__filter-count">{diffTotal}</span>
        </label>
        <div className="sg-compare-matrix__legend" aria-label="Legend">
          <span className="sg-compare-matrix__legend-item" data-state="same">
            <Icon name="check" size={14} />
            <span className="sg-compare-matrix__fp">a3f9</span>
            {`Same as ${refName}`}
          </span>
          <span className="sg-compare-matrix__legend-item" data-state="differs">
            <Icon name="equal-not" size={14} />
            Differs
          </span>
          <span className="sg-compare-matrix__legend-item" data-state="missing">
            <span className="sg-compare-matrix__legend-swatch" aria-hidden="true" />
            Missing
          </span>
        </div>
        {referenceSelect && <div className="sg-compare-matrix__reference">{referenceSelect}</div>}
      </div>
      <div className="sg-compare-matrix__scroll" style={maxHeight ? { maxHeight } : undefined}>
        <table
          className="sg-compare-matrix__table"
          role="grid"
          aria-rowcount={visible.length + 1}
          aria-colcount={names.length + 1}
        >
          <thead>
            <tr>
              <th scope="col" className="sg-compare-matrix__corner">
                <span>Key</span>
                <span className="sg-compare-matrix__corner-count">{loading ? "" : rows.length}</span>
              </th>
              {envs.map((env) => {
                const nm = envName(env);
                return (
                  <th
                    key={nm}
                    scope="col"
                    className="sg-compare-matrix__env"
                    data-reference={nm === refName || undefined}
                  >
                    <span className="sg-compare-matrix__env-name">
                      <EnvDot color={envColor(env)} />
                      <span className="sg-compare-matrix__env-text">{nm}</span>
                      {env?.protected && (
                        <Icon name="lock" size={12} label="Protected" className="sg-compare-matrix__lock" />
                      )}
                    </span>
                    <span className="sg-compare-matrix__env-sub">
                      {nm === refName ? "Reference" : `${Object.keys(values[nm] || {}).length} secrets`}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {loading &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="sg-compare-matrix__skeleton" aria-hidden="true">
                  <th className="sg-compare-matrix__key">
                    <span className="sg-compare-matrix__bone" style={{ width: `${40 + (i % 3) * 16}%` }} />
                  </th>
                  {names.map((nm) => (
                    <td key={nm} className="sg-compare-matrix__td">
                      <span className="sg-compare-matrix__bone" style={{ width: 40 }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && visible.length === 0 && (
              <tr className="sg-compare-matrix__none">
                <td colSpan={names.length + 1}>
                  <Icon name="circle-check" size={16} />
                  {`No differences. ${names.length} environments match on all ${n(rows.length, "key")}.`}
                </td>
              </tr>
            )}
            {!loading &&
              visible.map((it) => {
                ri += 1;
                const rowIndex = ri;
                if (it.type === "group") {
                  const open = !shutSet.has(it.prefix);
                  const diffCount = it.all.filter((k) => byKey[k].hasDifference).length;
                  const id = cellId(`g:${it.prefix}`, 0);
                  return (
                    <tr key={`g:${it.prefix}`} className="sg-compare-matrix__group" data-open={open || undefined}>
                      <th scope="rowgroup" className="sg-compare-matrix__key">
                        <button
                          type="button"
                          className="sg-compare-matrix__group-toggle"
                          aria-expanded={open}
                          onClick={() => toggleGroup(it.prefix)}
                          {...focusProps(id, rowIndex, 0)}
                        >
                          <Icon name="chevron-right" size={14} className="sg-compare-matrix__chevron" />
                          <span className="sg-compare-matrix__prefix">{it.prefix}</span>
                          <span className="sg-compare-matrix__group-count">{n(it.all.length, "key")}</span>
                          {diffCount > 0 && (
                            <span className="sg-compare-matrix__group-diff">{`${diffCount} with differences`}</span>
                          )}
                        </button>
                      </th>
                      {names.map((nm) => (
                        <td key={nm} className="sg-compare-matrix__td sg-compare-matrix__td--group">
                          {groupSummary(it.keys, nm)}
                        </td>
                      ))}
                    </tr>
                  );
                }
                const row = byKey[it.key];
                const pre = it.grouped ? prefixOf(row.key) : "";
                const tone = row.missing > 0 ? "missing" : row.hasDifference ? "differs" : undefined;
                return (
                  <tr key={row.key} className="sg-compare-matrix__row" data-diff={tone}>
                    <th
                      scope="row"
                      className={cx("sg-compare-matrix__key", it.grouped && "sg-compare-matrix__key--nested")}
                    >
                      <span className="sg-compare-matrix__marker" aria-hidden="true" />
                      <span className="sg-compare-matrix__key-inner">
                        <span className="sg-compare-matrix__key-text">
                          {pre && <span className="sg-compare-matrix__key-prefix">{pre}</span>}
                          {row.key.slice(pre.length)}
                        </span>
                        {annotations?.[row.key]}
                      </span>
                    </th>
                    {names.map((nm, ci) => renderCell(row, nm, rowIndex, ci + 1))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
