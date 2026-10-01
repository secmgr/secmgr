import { forwardRef, useMemo, useState } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

const W = 96;
const H = 32;
const PAD = 4;

function geometry(series) {
  const vals = series.map(Number);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = vals.length > 1 ? (W - PAD * 2) / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => [PAD + i * step, max === min ? H / 2 : PAD + (H - PAD * 2) * (1 - (v - min) / span)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)} ${H} L${pts[0][0].toFixed(2)} ${H} Z`;
  return { pts, line, area };
}

function Sparkline({ series, labels, unit, onHover, hover }) {
  const g = useMemo(() => geometry(series), [series]);
  const last = g.pts[g.pts.length - 1];
  const at = hover != null ? g.pts[hover] : null;
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    g.pts.forEach((p, i) => {
      if (Math.abs(p[0] - x) < Math.abs(g.pts[best][0] - x)) best = i;
    });
    onHover(best);
  };
  const first = series[0];
  const end = series[series.length - 1];
  const summary = `${labels?.[0] ? `${labels[0]} to ${labels[labels.length - 1]}` : `Last ${series.length} points`}: from ${first} to ${end}${unit ? ` ${unit}` : ""}`;
  return (
    <svg
      className="sg-stat-tile__spark"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={summary}
      onPointerMove={move}
      onPointerLeave={() => onHover(null)}
    >
      <path className="sg-stat-tile__area" d={g.area} />
      <path
        className="sg-stat-tile__line"
        d={g.line}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {at && <line className="sg-stat-tile__cross" x1={at[0]} x2={at[0]} y1={0} y2={H} strokeWidth="1" />}
      <circle className="sg-stat-tile__dot" cx={(at || last)[0]} cy={(at || last)[1]} r="3.5" strokeWidth="2" />
      <rect x="0" y="0" width={W} height={H} fill="transparent" />
    </svg>
  );
}

export const StatTile = forwardRef(function StatTile(
  {
    label,
    value,
    delta,
    deltaTone = "neutral",
    series,
    seriesLabels,
    unit,
    icon,
    href,
    onClick,
    loading = false,
    className,
    ...rest
  },
  ref,
) {
  const [hover, setHover] = useState(null);
  const interactive = !!(href || onClick);
  const Root = href ? "a" : onClick ? "button" : "div";
  const rootProps = href ? { href } : onClick ? { type: "button", onClick } : {};
  const readout =
    hover != null && series
      ? `${seriesLabels?.[hover] ? `${seriesLabels[hover]} · ` : ""}${series[hover]}${unit ? ` ${unit}` : ""}`
      : null;

  if (loading) {
    return (
      <div ref={ref} className={cx("sg-stat-tile", "sg-stat-tile--loading", className)} aria-busy="true" {...rest}>
        <span className="sg-stat-tile__bone" style={{ width: "48%" }} />
        <span className="sg-stat-tile__bone" style={{ width: 40, height: 20 }} />
        <span className="sg-stat-tile__bone" style={{ width: "36%" }} />
      </div>
    );
  }

  return (
    <Root
      ref={ref}
      className={cx("sg-stat-tile", interactive && "sg-stat-tile--interactive", className)}
      {...rootProps}
      {...rest}
    >
      <span className="sg-stat-tile__label">
        {icon && <Icon name={icon} size={14} />}
        <span className="sg-stat-tile__label-text">{label}</span>
        {interactive && <Icon name="arrow-up-right" size={14} className="sg-stat-tile__go" />}
      </span>
      <span className="sg-stat-tile__value">{value}</span>
      {series && series.length > 1 && (
        <Sparkline series={series} labels={seriesLabels} unit={unit} hover={hover} onHover={setHover} />
      )}
      {(delta || readout) && (
        <span className="sg-stat-tile__delta" data-tone={readout ? "neutral" : deltaTone} aria-live="polite">
          {readout || delta}
        </span>
      )}
    </Root>
  );
});
