import { cx } from "../_lib/util.js";

const px = (v) => (typeof v === "number" ? `${v}px` : v);
const KEY_WIDTHS = [136, 184, 112, 160, 200, 128, 176, 96];
const DOT_COUNTS = [12, 16, 10, 14, 18, 12, 8, 15];
const META_WIDTHS = [56, 72, 48, 64];

export function Skeleton({ variant = "text", lines = 1, width, height, className, style, ...rest }) {
  if (variant === "text") {
    const n = Math.max(1, lines);
    return (
      <span
        className={cx("sg-skeleton-text", className)}
        style={{ width: px(width), ...style }}
        aria-hidden="true"
        {...rest}
      >
        {Array.from({ length: n }).map((_, i) => (
          <span key={i} className="sg-skeleton-text__line">
            <span
              className="sg-skeleton"
              style={{ width: n > 1 && i === n - 1 ? "62%" : undefined, height: px(height) }}
            />
          </span>
        ))}
      </span>
    );
  }
  const size =
    variant === "circle"
      ? { width: px(width || height || 24), height: px(height || width || 24) }
      : { width: px(width), height: px(height) };
  return (
    <span
      className={cx("sg-skeleton", `sg-skeleton--${variant}`, className)}
      style={{ ...size, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonRows({ count = 5, density = "comfortable", label = "Loading secrets", className, ...rest }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cx("sg-skeleton-rows", `sg-skeleton-rows--${density}`, className)}
      {...rest}
    >
      <span className="sg-visually-hidden">{label}</span>
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <div key={i} className="sg-skeleton-row" aria-hidden="true" style={{ "--_delay": i }}>
          <span className="sg-skeleton sg-skeleton-row__check" />
          <span className="sg-skeleton-row__key">
            <span className="sg-skeleton" style={{ width: KEY_WIDTHS[i % KEY_WIDTHS.length] }} />
          </span>
          <span className="sg-skeleton-row__value">
            {Array.from({ length: DOT_COUNTS[i % DOT_COUNTS.length] }).map((_, k) => (
              <span key={k} className="sg-skeleton sg-skeleton-row__dot" />
            ))}
          </span>
          <span className="sg-skeleton-row__meta">
            <span className="sg-skeleton sg-skeleton--circle sg-skeleton-row__avatar" />
            <span
              className="sg-skeleton sg-skeleton-row__time"
              style={{ width: META_WIDTHS[i % META_WIDTHS.length] }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
