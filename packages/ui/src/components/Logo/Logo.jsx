import { useId } from "react";
import { safeId } from "../_lib/layout.js";
import { cx } from "../_lib/util.js";

const R = 8.75;
const CY = 16;
const CX1 = 16 - R / 2;
const CX2 = 16 + R / 2;
const DY = Math.sqrt(R * R - (R / 2) * (R / 2));
const TOP = +(CY - DY).toFixed(3);
const BOT = +(CY + DY).toFixed(3);
const CLIP = 5.2;
const f = (v) => +v.toFixed(3);

function Rings({ stroke, gap }) {
  const id = `sg-rings-${safeId(useId())}`;
  const cut = f(stroke + gap * 2);
  return (
    <>
      <defs>
        <clipPath id={`${id}-ct`}>
          <circle cx="16" cy={TOP} r={CLIP} />
        </clipPath>
        <clipPath id={`${id}-cb`}>
          <circle cx="16" cy={BOT} r={CLIP} />
        </clipPath>
        <mask id={`${id}-ma`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect width="32" height="32" fill="#fff" />
          <circle cx={f(CX2)} cy={CY} r={R} fill="none" stroke="#000" strokeWidth={cut} clipPath={`url(#${id}-ct)`} />
        </mask>
        <mask id={`${id}-mb`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect width="32" height="32" fill="#fff" />
          <circle cx={f(CX1)} cy={CY} r={R} fill="none" stroke="#000" strokeWidth={cut} clipPath={`url(#${id}-cb)`} />
        </mask>
      </defs>
      <circle
        cx={f(CX1)}
        cy={CY}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        mask={`url(#${id}-ma)`}
      />
      <circle
        cx={f(CX2)}
        cy={CY}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        mask={`url(#${id}-mb)`}
      />
    </>
  );
}

export function Mark({ size = 24, title, stroke = 2, className, ...rest }) {
  return (
    <svg
      className={cx("sg-mark", className)}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      <Rings stroke={stroke} gap={1.1} />
    </svg>
  );
}

export function Wordmark({ size = 20, title = "secmgr", className, style, ...rest }) {
  return (
    <span
      className={cx("sg-wordmark", className)}
      style={{ fontSize: size, ...style }}
      role="img"
      aria-label={title}
      {...rest}
    >
      <Mark size="1.28em" className="sg-wordmark__mark" />
      <span className="sg-wordmark__text" aria-hidden="true">
        secmgr
      </span>
    </span>
  );
}

export function AppIcon({ size = 32, title, className, style, ...rest }) {
  const small = size <= 24;
  const inner = small ? size * 0.72 : (size * 300) / 512;
  const stroke = small ? 2.2 : size <= 48 ? 1.8 : 1.6;
  return (
    <span
      className={cx("sg-app-icon", className)}
      style={{ width: size, height: size, "--_k": size / 48, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      {...rest}
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32" fill="none" focusable="false" aria-hidden="true">
        <Rings stroke={stroke} gap={1} />
      </svg>
    </span>
  );
}
