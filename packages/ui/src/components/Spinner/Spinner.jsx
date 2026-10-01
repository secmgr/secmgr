import { cx } from "../_lib/util.js";

const SPOKES = Array.from({ length: 8 }, (_, i) => ({ angle: i * -45, opacity: 1 - i * 0.1 }));

export function Spinner({ size = 16, label = "Loading", className }) {
  return (
    <svg
      className={cx("sg-spinner", className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="status"
      aria-label={label}
    >
      {SPOKES.map((s) => (
        <line
          key={s.angle}
          className="sg-spinner__spoke"
          x1="8"
          y1="1.75"
          x2="8"
          y2="4.5"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={s.opacity}
          transform={`rotate(${s.angle} 8 8)`}
        />
      ))}
    </svg>
  );
}
