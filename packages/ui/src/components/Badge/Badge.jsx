import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export function Badge({ tone = "neutral", variant = "soft", icon, dot = false, className, children, ...rest }) {
  return (
    <span className={cx("sg-badge", `sg-badge--${tone}`, `sg-badge--${variant}`, className)} {...rest}>
      {dot && <span className="sg-badge__dot" aria-hidden="true" />}
      {icon && <Icon name={icon} size={14} />}
      {children != null && <span className="sg-badge__label">{children}</span>}
    </span>
  );
}
