import { forwardRef, useEffect, useState } from "react";
import { diffSegments } from "../_lib/compare.js";
import { cx, n, relativeTime, useControllable } from "../_lib/util.js";
import { Avatar } from "../Avatar/Avatar.jsx";
import { Badge } from "../Badge/Badge.jsx";
import { Button } from "../Button/Button.jsx";
import { Checkbox } from "../Checkbox/Checkbox.jsx";
import { EnvBadge } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { SecretValue } from "../SecretValue/SecretValue.jsx";

const label = (v) => `v${v.version}`;

function Segs({ segs, tone }) {
  return segs.map((s, i) =>
    s.changed ? (
      <mark key={i} className="sg-version-timeline__mark" data-tone={tone}>
        {s.text}
      </mark>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
}

export const VersionTimeline = forwardRef(function VersionTimeline(
  {
    versions = [],
    secretKey,
    env,
    selected,
    defaultSelected = [],
    onSelectedChange,
    onCompare,
    onRestore,
    avatars = false,
    valueRenderer,
    revealTimeout,
    now,
    loading = false,
    className,
    ...rest
  },
  ref,
) {
  const [sel, setSel] = useControllable(selected, defaultSelected, onSelectedChange);
  const [shown, setShown] = useState(() => new Set());
  const [compareShown, setCompareShown] = useState(false);
  const picked = (sel || []).slice(0, 2);
  const pickedSet = new Set(picked);
  const currentVersion = versions.length ? (versions.find((v) => v.current) || versions[0]).version : null;

  useEffect(() => {
    if (!revealTimeout || (shown.size === 0 && !compareShown)) return undefined;
    const t = setTimeout(() => {
      setShown(new Set());
      setCompareShown(false);
    }, revealTimeout);
    return () => clearTimeout(t);
  }, [revealTimeout, shown, compareShown]);

  const toggleShown = (v) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  const togglePick = (v, on) => {
    let next = picked.filter((x) => x !== v);
    if (on) next = [...next, v].slice(-2);
    setSel(next);
    if (on && next.length === 2 && onCompare) {
      const [a, b] = next.slice().sort((x, y) => x - y);
      onCompare(a, b);
    }
  };

  const shownValue = (v, isShown) => {
    if (valueRenderer) {
      const c = valueRenderer(v.value, { version: v.version, revealed: isShown });
      if (c !== undefined) return c;
    }
    if (v.value === undefined) return <span className="sg-version-timeline__empty">Deleted</span>;
    if (!isShown)
      return (
        <SecretValue
          value={v.value}
          revealed={false}
          secretKey={secretKey ? `${secretKey} v${v.version}` : `v${v.version}`}
          className="sg-version-timeline__secret"
        />
      );
    if (v.value === "") return <span className="sg-version-timeline__empty">Empty</span>;
    return <span className="sg-version-timeline__text">{v.value}</span>;
  };

  const compareRows =
    picked.length === 2
      ? picked
          .slice()
          .sort((a, b) => a - b)
          .map((x) => versions.find((v) => v.version === x))
          .filter(Boolean)
      : [];
  const segs =
    compareRows.length === 2 && compareShown && !valueRenderer
      ? diffSegments(compareRows[0].value, compareRows[1].value)
      : null;

  return (
    <div ref={ref} className={cx("sg-version-timeline", className)} {...rest}>
      {(secretKey || env) && (
        <div className="sg-version-timeline__header">
          {secretKey && <span className="sg-version-timeline__key">{secretKey}</span>}
          {env && <EnvBadge env={env} size="sm" />}
          {!loading && <span className="sg-version-timeline__count">{n(versions.length, "version")}</span>}
          <span className="sg-version-timeline__hint">
            {picked.length === 1
              ? "Select one more version to compare"
              : picked.length === 2
                ? ""
                : "Select two versions to compare"}
          </span>
        </div>
      )}
      {compareRows.length === 2 && (
        <div
          className="sg-version-timeline__compare"
          role="group"
          aria-label={`Comparing ${label(compareRows[0])} and ${label(compareRows[1])}`}
        >
          <div className="sg-version-timeline__compare-head">
            <Icon name="git-compare-arrows" size={14} />
            <span className="sg-version-timeline__compare-title">{`Comparing ${label(compareRows[0])} and ${label(compareRows[1])}`}</span>
            <Button
              size="sm"
              variant="ghost"
              icon={compareShown ? "eye-off" : "eye"}
              aria-pressed={compareShown}
              onClick={() => setCompareShown(!compareShown)}
            >
              {compareShown ? "Hide values" : "Reveal values"}
            </Button>
            <IconButton
              icon="x"
              size="xs"
              label="Clear comparison"
              onClick={() => {
                setSel([]);
                setCompareShown(false);
              }}
            />
          </div>
          {compareRows.map((v, i) => (
            <div key={v.version} className="sg-version-timeline__compare-row" data-side={i === 0 ? "before" : "after"}>
              <span className="sg-version-timeline__compare-marker" aria-hidden="true" />
              <span className="sg-version-timeline__compare-label">{label(v)}</span>
              <span className="sg-version-timeline__compare-value">
                {segs ? (
                  <span className="sg-version-timeline__text">
                    <Segs segs={i === 0 ? segs.base : segs.compare} tone={i === 0 ? "remove" : "add"} />
                  </span>
                ) : (
                  shownValue(v, compareShown)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <ol className="sg-version-timeline__list">
        {loading &&
          [0, 1, 2].map((i) => (
            <li key={i} className="sg-version-timeline__item sg-version-timeline__item--skeleton" aria-hidden="true">
              <span className="sg-version-timeline__rail">
                <span className="sg-version-timeline__dot" />
              </span>
              <span className="sg-version-timeline__body">
                <span className="sg-version-timeline__bone" style={{ width: `${40 + i * 12}%` }} />
                <span className="sg-version-timeline__bone" style={{ width: "30%" }} />
              </span>
            </li>
          ))}
        {!loading &&
          versions.map((v, i) => {
            const isCurrent = v.version === currentVersion;
            const isShown = shown.has(v.version);
            const isPicked = pickedSet.has(v.version);
            const when = v.time || (v.date != null ? relativeTime(v.date, now) : "");
            return (
              <li
                key={v.version}
                className="sg-version-timeline__item"
                data-current={isCurrent || undefined}
                data-selected={isPicked || undefined}
                data-last={i === versions.length - 1 || undefined}
              >
                <span className="sg-version-timeline__rail" aria-hidden="true">
                  <span className="sg-version-timeline__dot" />
                </span>
                <div className="sg-version-timeline__body">
                  <div className="sg-version-timeline__line">
                    <span className="sg-version-timeline__version">{label(v)}</span>
                    {isCurrent && (
                      <Badge tone="neutral" variant="outline">
                        Current
                      </Badge>
                    )}
                    <span className="sg-version-timeline__summary">{v.summary}</span>
                    <span className="sg-version-timeline__meta">
                      {v.avatar ||
                        (avatars ? (
                          <Avatar name={v.author} size={16} kind={v.authorType === "token" ? "service" : "person"} />
                        ) : null)}
                      <span className="sg-version-timeline__author">{v.author}</span>
                      {when && <span className="sg-version-timeline__time">{when}</span>}
                    </span>
                  </div>
                  <div className="sg-version-timeline__line sg-version-timeline__line--value">
                    <span className="sg-version-timeline__value">{shownValue(v, isShown)}</span>
                    {v.value !== undefined && !valueRenderer && (
                      <IconButton
                        icon={isShown ? "eye-off" : "eye"}
                        size="xs"
                        label={isShown ? `Hide ${label(v)}` : `Reveal ${label(v)}`}
                        pressed={isShown}
                        className="sg-version-timeline__reveal"
                        onClick={() => toggleShown(v.version)}
                      />
                    )}
                    <span className="sg-version-timeline__actions">
                      {!isCurrent && onRestore && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="history"
                          className="sg-version-timeline__restore"
                          onClick={() => onRestore(v.version)}
                        >{`Restore ${label(v)}`}</Button>
                      )}
                      <label className="sg-version-timeline__pick">
                        <Checkbox
                          checked={isPicked}
                          onCheckedChange={(on) => togglePick(v.version, on)}
                          aria-label={`Select ${label(v)} to compare`}
                        />
                        <span>Compare</span>
                      </label>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
      </ol>
    </div>
  );
});
