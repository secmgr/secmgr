import { forwardRef, useEffect, useMemo, useRef } from "react";
import { classifyImport, diffSegments, entriesFromParsed, envName, statusCounts } from "../_lib/compare.js";
import { parseDotenv } from "../_lib/secrets.js";
import { cx, n, useControllable } from "../_lib/util.js";
import { Badge } from "../Badge/Badge.jsx";
import { Button } from "../Button/Button.jsx";
import { Checkbox } from "../Checkbox/Checkbox.jsx";
import { EnvBadge } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { SecretValue } from "../SecretValue/SecretValue.jsx";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

export { classifyImport };

const ORDER = ["invalid", "changed", "duplicate", "new", "unchanged"];
const META = {
  new: { label: "New", tone: "success", variant: "soft", chip: "new" },
  changed: { label: "Changed", tone: "warning", variant: "soft", chip: "changed" },
  unchanged: { label: "Unchanged", tone: "neutral", variant: "outline", chip: "unchanged" },
  invalid: { label: "Invalid", tone: "danger", variant: "soft", chip: "invalid" },
  duplicate: { label: "Duplicate", tone: "warning", variant: "soft", chip: "duplicate" },
};
const CHIP_ORDER = ["new", "changed", "unchanged", "invalid", "duplicate"];
const SELECTABLE = { new: true, changed: true };

const DECISIONS = [
  { value: "overwrite", label: "Overwrite" },
  { value: "skip", label: "Skip" },
];

function Segs({ segs, tone }) {
  return segs.map((s, i) =>
    s.changed ? (
      <mark key={i} className="sg-import-preview__mark" data-tone={tone}>
        {s.text}
      </mark>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
}

export const ImportPreview = forwardRef(function ImportPreview(
  {
    env,
    rows: rowsProp,
    text,
    entries,
    existing,
    selected,
    defaultSelected,
    onSelectedChange,
    revealed,
    defaultRevealed = false,
    onRevealedChange,
    filter,
    defaultFilter = null,
    onFilterChange,
    showUnchanged,
    defaultShowUnchanged = false,
    onShowUnchangedChange,
    footer,
    valueRenderer,
    loading = false,
    className,
    ...rest
  },
  ref,
) {
  const target = envName(env);
  const rows = useMemo(() => {
    if (rowsProp) return rowsProp;
    const list = entries || (text != null ? entriesFromParsed(parseDotenv(text)) : []);
    return classifyImport(list, existing || {});
  }, [rowsProp, text, entries, existing]);
  const counts = useMemo(() => statusCounts(rows), [rows]);
  const selectableIds = useMemo(() => rows.filter((r) => SELECTABLE[r.status]).map((r) => r.id), [rows]);
  const [sel, setSel] = useControllable(selected, defaultSelected || selectableIds, onSelectedChange);
  const [shown, setShown] = useControllable(revealed, defaultRevealed, onRevealedChange);
  const [only, setOnly] = useControllable(filter, defaultFilter, onFilterChange);
  const [openSame, setOpenSame] = useControllable(showUnchanged, defaultShowUnchanged, onShowUnchangedChange);
  const firstRows = useRef(rows);
  useEffect(() => {
    if (firstRows.current === rows) return;
    firstRows.current = rows;
    if (selected === undefined) setSel(selectableIds);
  }, [rows]);
  const selSet = new Set(sel || []);
  const selCount = selectableIds.filter((id) => selSet.has(id)).length;
  const allOn = selectableIds.length > 0 && selCount === selectableIds.length;
  const someOn = selCount > 0 && !allOn;

  const setOne = (id, on) => {
    const next = new Set(selSet);
    if (on) next.add(id);
    else next.delete(id);
    setSel(selectableIds.filter((x) => next.has(x)));
  };
  const setAll = (on) => setSel(on ? selectableIds.slice() : []);

  const sorted = ORDER.flatMap((st) => rows.filter((r) => r.status === st));
  const main = sorted.filter((r) => r.status !== "unchanged" && (!only || r.status === only));
  const same = sorted.filter((r) => r.status === "unchanged");
  const showSameRows = only === "unchanged" || (!only && openSame);

  const masked = (value, ctx) => {
    if (valueRenderer) {
      const c = valueRenderer(value, ctx);
      if (c !== undefined) return c;
    }
    if (!shown)
      return <SecretValue value={value} revealed={false} secretKey={ctx.key} className="sg-import-preview__secret" />;
    if (value === "") return <span className="sg-import-preview__empty">Empty</span>;
    return <span className="sg-import-preview__text">{value}</span>;
  };

  const renderValue = (r) => {
    if (r.status === "invalid") {
      return (
        <span className="sg-import-preview__reason">
          <Icon name="circle-alert" size={14} />
          {`Line ${r.line}: ${r.reason}`}
        </span>
      );
    }
    if (r.status === "changed") {
      const segs = shown && !valueRenderer ? diffSegments(r.current, r.value) : null;
      return (
        <span className="sg-import-preview__change">
          <span className="sg-import-preview__old">
            {segs ? (
              <span className="sg-import-preview__text">
                <Segs segs={segs.base} tone="remove" />
              </span>
            ) : (
              masked(r.current, { key: r.key, side: "current", revealed: !!shown })
            )}
          </span>
          <Icon name="arrow-right" size={14} className="sg-import-preview__arrow" label="becomes" />
          <span className="sg-import-preview__new">
            {segs ? (
              <span className="sg-import-preview__text">
                <Segs segs={segs.compare} tone="add" />
              </span>
            ) : (
              masked(r.value, { key: r.key, side: "new", revealed: !!shown })
            )}
          </span>
        </span>
      );
    }
    if (r.status === "duplicate") {
      return (
        <span className="sg-import-preview__dup">
          <span className="sg-import-preview__dup-value">
            {masked(r.value, { key: r.key, side: "new", revealed: !!shown })}
          </span>
          <span className="sg-import-preview__note">{`Also on line ${r.otherLine}; the last one wins`}</span>
        </span>
      );
    }
    return masked(r.value, { key: r.key, side: "new", revealed: !!shown });
  };

  const renderRow = (r) => {
    const meta = META[r.status];
    const canSelect = !!SELECTABLE[r.status];
    const on = canSelect && selSet.has(r.id);
    return (
      <div
        key={r.id}
        role="row"
        className="sg-import-preview__row"
        data-status={r.status}
        data-selected={on || undefined}
        onClick={(e) => {
          if (!canSelect || e.target.closest?.("button, input, label, a")) return;
          setOne(r.id, !on);
        }}
      >
        <span role="cell" className="sg-import-preview__check">
          {canSelect ? (
            <Checkbox checked={on} onCheckedChange={(v) => setOne(r.id, v)} aria-label={`Import ${r.key}`} />
          ) : (
            <span className="sg-import-preview__skip" title="Not imported" />
          )}
        </span>
        <span role="cell" className="sg-import-preview__status">
          <Badge tone={meta.tone} variant={meta.variant}>
            {meta.label}
          </Badge>
        </span>
        <span role="rowheader" className="sg-import-preview__key" title={r.key}>
          {r.key || <span className="sg-import-preview__empty">No key</span>}
        </span>
        <span role="cell" className="sg-import-preview__value">
          {renderValue(r)}
        </span>
        <span role="cell" className="sg-import-preview__action">
          {r.status === "changed" && (
            <SegmentedControl
              size="sm"
              className="sg-import-preview__decision"
              options={DECISIONS}
              value={on ? "overwrite" : "skip"}
              onValueChange={(v) => setOne(r.id, v === "overwrite")}
              aria-label={`${r.key} already exists in ${target}`}
            />
          )}
        </span>
      </div>
    );
  };

  const summary = {
    selected: selCount,
    selectable: selectableIds.length,
    counts,
    env: target,
    selectedIds: selectableIds.filter((id) => selSet.has(id)),
  };
  const foot = typeof footer === "function" ? footer(summary) : footer;

  return (
    <div ref={ref} className={cx("sg-import-preview", className)} {...rest}>
      <div className="sg-import-preview__header">
        <div className="sg-import-preview__title">
          <span className="sg-import-preview__title-text">Import into</span>
          <EnvBadge env={env} />
          {!loading && <span className="sg-import-preview__lines">{n(rows.length, "line")}</span>}
          <Button
            size="sm"
            variant="ghost"
            icon={shown ? "eye-off" : "eye"}
            aria-pressed={!!shown}
            className="sg-import-preview__reveal"
            onClick={() => setShown(!shown)}
            disabled={loading || rows.length === 0}
          >
            {shown ? "Hide values" : "Reveal values"}
          </Button>
        </div>
        {loading ? (
          <div className="sg-import-preview__parsing">
            <Spinner size={14} label="Parsing" />
            Parsing .env
          </div>
        ) : (
          rows.length > 0 && (
            <div className="sg-import-preview__chips" role="group" aria-label="Filter lines by status">
              {CHIP_ORDER.filter((st) => counts[st] > 0).map((st) => (
                <button
                  key={st}
                  type="button"
                  className="sg-import-preview__chip"
                  data-tone={META[st].tone}
                  aria-pressed={only === st}
                  onClick={() => setOnly(only === st ? null : st)}
                >
                  <span className="sg-import-preview__chip-dot" aria-hidden="true" />
                  <span className="sg-import-preview__chip-count">{counts[st]}</span>
                  {` ${st}`}
                </button>
              ))}
              {only && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="x"
                  className="sg-import-preview__clear"
                  onClick={() => setOnly(null)}
                >
                  Show all
                </Button>
              )}
            </div>
          )
        )}
        {!loading && counts.invalid > 0 && (
          <div className="sg-import-preview__alert" role="status">
            <Icon name="circle-alert" size={16} />
            <span>{`${n(counts.invalid, "line")} could not be parsed. Fix the highlighted ${counts.invalid === 1 ? "line" : "lines"} or ${counts.invalid === 1 ? "skip it" : "skip them"}.`}</span>
          </div>
        )}
      </div>
      {!loading && rows.length > 0 && (
        <div className="sg-import-preview__bulk">
          <Checkbox
            checked={allOn}
            indeterminate={someOn}
            disabled={!selectableIds.length}
            onCheckedChange={(v) => setAll(v)}
            aria-label="Select every importable line"
          />
          <span className="sg-import-preview__bulk-text">
            {selCount === selectableIds.length
              ? `All ${n(selectableIds.length, "secret")} selected`
              : `${selCount} of ${n(selectableIds.length, "secret")} selected`}
          </span>
        </div>
      )}
      <div role="table" aria-label={`Lines to import into ${target}`} className="sg-import-preview__list">
        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="sg-import-preview__row sg-import-preview__row--skeleton" aria-hidden="true">
              <span className="sg-import-preview__check" />
              <span className="sg-import-preview__bone" style={{ width: 64 }} />
              <span className="sg-import-preview__bone" style={{ width: `${50 + (i % 2) * 24}%` }} />
              <span className="sg-import-preview__bone" style={{ width: "40%" }} />
            </div>
          ))}
        {!loading && rows.length === 0 && (
          <div className="sg-import-preview__none">
            <Icon name="file-text" size={20} />
            <span>
              No secrets found. Paste lines like <code>KEY=value</code>, one per line.
            </span>
          </div>
        )}
        {!loading && main.map(renderRow)}
        {!loading && same.length > 0 && !only && (
          <button
            type="button"
            className="sg-import-preview__fold"
            aria-expanded={!!openSame}
            onClick={() => setOpenSame(!openSame)}
          >
            <Icon name={openSame ? "fold-vertical" : "unfold-vertical"} size={14} />
            {openSame ? `Hide ${n(same.length, "unchanged key")}` : `Show ${n(same.length, "unchanged key")}`}
          </button>
        )}
        {!loading && showSameRows && same.map(renderRow)}
      </div>
      {foot && <div className="sg-import-preview__footer">{foot}</div>}
    </div>
  );
});
