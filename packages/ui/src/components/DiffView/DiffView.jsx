import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { diffCounts, diffEnvs, diffSegments, envName, useRovingRows } from "../_lib/compare.js";
import { cx, n, useControllable } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { Checkbox } from "../Checkbox/Checkbox.jsx";
import { EnvBadge, EnvDot, envColor } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { SecretValue } from "../SecretValue/SecretValue.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

export { diffEnvs, diffSegments };

function Segments({ segs, className }) {
  return (
    <span className={className}>
      {segs.map((s, i) =>
        s.changed ? (
          <mark key={i} className="sg-diff-view__mark">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

export const DiffView = forwardRef(function DiffView(
  {
    base,
    compare,
    baseValues,
    compareValues,
    rows: rowsProp,
    revealed,
    defaultRevealed = false,
    onRevealedChange,
    onlyDifferences,
    defaultOnlyDifferences = false,
    onOnlyDifferencesChange,
    showIdentical,
    defaultShowIdentical = false,
    onShowIdenticalChange,
    revealTimeout,
    onAction,
    valueRenderer,
    toolbar,
    loading = false,
    className,
    ...rest
  },
  ref,
) {
  const baseName = envName(base);
  const compareName = envName(compare);
  const [revealAll, setRevealAll] = useControllable(revealed, defaultRevealed, onRevealedChange);
  const [onlyDiff, setOnlyDiff] = useControllable(onlyDifferences, defaultOnlyDifferences, onOnlyDifferencesChange);
  const [openSame, setOpenSame] = useControllable(showIdentical, defaultShowIdentical, onShowIdenticalChange);
  const [flipped, setFlipped] = useState(() => new Set());
  const [active, setActive] = useState(null);
  const bodyRef = useRef(null);
  const move = useRovingRows(bodyRef, "[data-diff-row]");

  const rows = useMemo(() => rowsProp || diffEnvs(baseValues, compareValues), [rowsProp, baseValues, compareValues]);
  const counts = useMemo(() => diffCounts(rows), [rows]);
  const diffs = rows.filter((r) => r.status !== "same");
  const same = rows.filter((r) => r.status === "same");

  const toggleAll = useCallback(() => {
    setFlipped(new Set());
    setRevealAll(!revealAll);
  }, [revealAll, setRevealAll]);
  const isRevealed = (key) => (revealAll ? !flipped.has(key) : flipped.has(key));
  const anyRevealed = revealAll || flipped.size > 0;
  const toggleRow = (key) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    if (!revealTimeout || !anyRevealed) return undefined;
    const t = setTimeout(() => {
      setFlipped(new Set());
      if (revealAll) setRevealAll(false);
    }, revealTimeout);
    return () => clearTimeout(t);
  }, [revealTimeout, anyRevealed, revealAll, flipped]);

  const act = (action, row) => {
    if (onAction) onAction(action, row);
  };

  const onKeyDown = (e) => {
    if (e.target.closest?.("button, input, a") && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const moved = move(e);
    if (moved) {
      setActive(moved.dataset.group === "same" ? "__same" : moved.dataset.key);
      return;
    }
    const row = e.target.closest?.("[data-diff-row]");
    if (!row) return;
    if (e.key === "r" && row.dataset.key) {
      e.preventDefault();
      toggleRow(row.dataset.key);
    }
    if ((e.key === "Enter" || e.key === " ") && row.dataset.group === "same") {
      e.preventDefault();
      setOpenSame(!openSame);
    }
  };

  const baseDot = <EnvDot color={envColor(base || baseName)} size={6} />;
  const compareDot = <EnvDot color={envColor(compare || compareName)} size={6} />;

  const renderValue = (row, side) => {
    const value = side === "base" ? row.base : row.compare;
    const envLabel = side === "base" ? baseName : compareName;
    const other = side === "base" ? compareName : baseName;
    if (value === undefined) {
      const action = side === "compare" ? "add-to-compare" : "add-to-base";
      return (
        <span className="sg-diff-view__missing-wrap">
          <span className="sg-diff-view__missing">Missing</span>
          {onAction && (
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              className="sg-diff-view__add"
              onClick={() => act(action, row)}
              aria-label={`Add ${row.key} to ${envLabel}`}
            >
              {`Add to ${envLabel}`}
            </Button>
          )}
        </span>
      );
    }
    const shown = isRevealed(row.key);
    const ctx = { key: row.key, env: envLabel, side, revealed: shown, status: row.status, other };
    if (valueRenderer) {
      const custom = valueRenderer(value, ctx);
      if (custom !== undefined) return custom;
    }
    if (!shown)
      return <SecretValue value={value} revealed={false} secretKey={row.key} className="sg-diff-view__secret" />;
    if (value === "") return <span className="sg-diff-view__empty">Empty</span>;
    if (row.status === "changed") {
      const segs = diffSegments(row.base, row.compare);
      return <Segments segs={side === "base" ? segs.base : segs.compare} className="sg-diff-view__text" />;
    }
    return <span className="sg-diff-view__text">{value}</span>;
  };

  const renderRow = (row) => {
    const shown = isRevealed(row.key);
    const status = row.status;
    const srStatus =
      status === "changed"
        ? "Differs"
        : status === "removed"
          ? `Missing in ${compareName}`
          : status === "added"
            ? `Only in ${compareName}`
            : "Identical";
    return (
      <div
        key={row.key}
        role="row"
        className="sg-diff-view__row"
        data-status={status}
        data-diff-row=""
        data-key={row.key}
        tabIndex={active === row.key || (active == null && row === rows.find((r) => r.status !== "same")) ? 0 : -1}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setActive(row.key);
        }}
        aria-label={`${row.key}, ${srStatus}`}
      >
        <span className="sg-diff-view__marker" aria-hidden="true" />
        <div role="rowheader" className="sg-diff-view__key">
          <span className="sg-diff-view__key-text">{row.key}</span>
        </div>
        <div role="cell" className="sg-diff-view__cell" data-side="base">
          <span className="sg-diff-view__side" aria-hidden="true">
            {baseDot}
            <span>{baseName}</span>
          </span>
          <span className="sg-diff-view__value">{renderValue(row, "base")}</span>
        </div>
        <div role="cell" className="sg-diff-view__gutter">
          {status === "changed" && <Icon name="equal-not" size={14} className="sg-diff-view__relation" />}
          {status === "same" && <Icon name="equal" size={14} className="sg-diff-view__relation" />}
          {status === "changed" && onAction && (
            <IconButton
              icon="arrow-right"
              size="xs"
              label={`Copy to ${compareName}`}
              className="sg-diff-view__copy"
              onClick={() => act("copy-to-compare", row)}
            />
          )}
        </div>
        <div role="cell" className="sg-diff-view__cell" data-side="compare">
          <span className="sg-diff-view__side" aria-hidden="true">
            {compareDot}
            <span>{compareName}</span>
          </span>
          <span className="sg-diff-view__value">{renderValue(row, "compare")}</span>
        </div>
        <div role="cell" className="sg-diff-view__actions">
          {status === "changed" && onAction && (
            <Button
              size="sm"
              variant="ghost"
              icon="arrow-down"
              className="sg-diff-view__use"
              onClick={() => act("copy-to-compare", row)}
            >
              {`Use ${baseName} value`}
            </Button>
          )}
          <IconButton
            icon={shown ? "eye-off" : "eye"}
            size="xs"
            label={shown ? `Hide values of ${row.key}` : `Reveal values of ${row.key}`}
            pressed={shown}
            data-flipped={flipped.has(row.key) || undefined}
            className="sg-diff-view__reveal"
            onClick={() => toggleRow(row.key)}
          />
        </div>
      </div>
    );
  };

  const summary = [];
  if (counts.changed)
    summary.push({ tone: "changed", text: `${counts.changed} ${counts.changed === 1 ? "differs" : "differ"}` });
  if (counts.removed) summary.push({ tone: "removed", text: `${counts.removed} missing in ${compareName}` });
  if (counts.added) summary.push({ tone: "added", text: `${counts.added} only in ${compareName}` });
  if (counts.same) summary.push({ tone: "same", text: `${counts.same} identical` });

  return (
    <div ref={ref} className={cx("sg-diff-view", className)} data-revealed={revealAll || undefined} {...rest}>
      <div className="sg-diff-view__toolbar">
        <div className="sg-diff-view__summary" aria-live="polite">
          {loading ? (
            <span className="sg-diff-view__loading">
              <Spinner size={14} label="Comparing" />
              {`Comparing ${baseName} and ${compareName}`}
            </span>
          ) : (
            summary.map((s, i) => (
              <span key={i} className="sg-diff-view__count" data-tone={s.tone}>
                <span className="sg-diff-view__count-mark" aria-hidden="true" />
                {s.text}
              </span>
            ))
          )}
        </div>
        <div className="sg-diff-view__tools">
          {toolbar}
          <label className="sg-diff-view__filter">
            <Checkbox checked={!!onlyDiff} onCheckedChange={setOnlyDiff} />
            <span>Only differences</span>
          </label>
          <Button
            size="sm"
            variant="ghost"
            icon={revealAll ? "eye-off" : "eye"}
            aria-pressed={!!revealAll}
            className="sg-diff-view__reveal-all"
            onClick={toggleAll}
          >
            {revealAll ? "Hide values" : "Reveal values"}
          </Button>
        </div>
      </div>
      <div role="table" aria-label={`${baseName} compared with ${compareName}`} className="sg-diff-view__table">
        <div role="rowgroup" className="sg-diff-view__head">
          <div role="row" className="sg-diff-view__head-row">
            <span role="columnheader" className="sg-diff-view__head-key">
              Key
            </span>
            <span role="columnheader" className="sg-diff-view__head-env">
              <EnvBadge env={base} size="sm" />
            </span>
            <span className="sg-diff-view__head-gutter" aria-hidden="true">
              <Icon name="arrow-left-right" size={14} />
            </span>
            <span role="columnheader" className="sg-diff-view__head-env">
              <EnvBadge env={compare} size="sm" />
            </span>
            <span className="sg-diff-view__head-actions" aria-hidden="true" />
          </div>
        </div>
        <div role="rowgroup" ref={bodyRef} className="sg-diff-view__body" onKeyDown={onKeyDown}>
          {loading &&
            [0, 1, 2].map((i) => (
              <div key={i} role="row" className="sg-diff-view__row sg-diff-view__row--skeleton" aria-hidden="true">
                <span className="sg-diff-view__marker" />
                <div className="sg-diff-view__key">
                  <span className="sg-diff-view__bone" style={{ width: `${48 + i * 12}%` }} />
                </div>
                <div className="sg-diff-view__cell">
                  <span className="sg-diff-view__bone" style={{ width: "56%" }} />
                </div>
                <div className="sg-diff-view__gutter" />
                <div className="sg-diff-view__cell">
                  <span className="sg-diff-view__bone" style={{ width: "56%" }} />
                </div>
                <div className="sg-diff-view__actions" />
              </div>
            ))}
          {!loading && diffs.length === 0 && (
            <div role="row" className="sg-diff-view__match">
              <span role="cell" className="sg-diff-view__match-cell">
                <Icon name="circle-check" size={16} />
                <span>{`${baseName} and ${compareName} match on all ${n(same.length, "key")}.`}</span>
              </span>
            </div>
          )}
          {!loading && diffs.map(renderRow)}
          {!loading && same.length > 0 && !onlyDiff && (
            <>
              <div
                role="row"
                className="sg-diff-view__fold"
                data-diff-row=""
                data-group="same"
                tabIndex={active === "__same" || (active == null && diffs.length === 0) ? 0 : -1}
                onFocus={(e) => {
                  if (e.target === e.currentTarget) setActive("__same");
                }}
                aria-expanded={!!openSame}
                onClick={() => setOpenSame(!openSame)}
              >
                <span role="cell" className="sg-diff-view__fold-cell">
                  <Icon name={openSame ? "fold-vertical" : "unfold-vertical"} size={14} />
                  <span>
                    {openSame ? `Hide ${n(same.length, "identical key")}` : `Show ${n(same.length, "identical key")}`}
                  </span>
                </span>
              </div>
              {openSame && same.map(renderRow)}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
