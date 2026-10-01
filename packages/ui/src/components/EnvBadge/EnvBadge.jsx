import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const ENV_COLORS = ["gray", "blue", "teal", "green", "amber", "orange", "rose", "violet"];

export const DEFAULT_ENV_COLOR = {
  development: "blue",
  dev: "blue",
  local: "gray",
  test: "teal",
  preview: "violet",
  staging: "amber",
  stage: "amber",
  qa: "orange",
  production: "rose",
  prod: "rose",
};

export function envColor(env) {
  if (!env) return "gray";
  if (env.color && ENV_COLORS.includes(env.color)) return env.color;
  return DEFAULT_ENV_COLOR[String(env.name || env).toLowerCase()] || "gray";
}

export function EnvDot({ color = "gray", size = 8, className }) {
  return (
    <span
      className={cx("sg-env-dot", className)}
      style={{ "--_c": `var(--env-${color})`, width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function EnvBadge({
  env,
  name,
  color,
  protected: isProtected,
  variant = "soft",
  size = "md",
  count,
  className,
  ...rest
}) {
  const label = name || env?.name || String(env || "");
  const hue = color || envColor(env || label);
  const locked = isProtected !== undefined ? isProtected : !!env?.protected;
  return (
    <span
      className={cx("sg-env-badge", `sg-env-badge--${variant}`, `sg-env-badge--${size}`, className)}
      style={{ "--_c": `var(--env-${hue})`, "--_soft": `var(--env-${hue}-soft)`, "--_text": `var(--env-${hue}-text)` }}
      {...rest}
    >
      <span className="sg-env-badge__dot" aria-hidden="true" />
      <span className="sg-env-badge__name">{label}</span>
      {locked && <Icon name="lock" size={size === "sm" ? 12 : 14} label="Protected" className="sg-env-badge__lock" />}
      {count != null && <span className="sg-env-badge__count">{count}</span>}
    </span>
  );
}
