import { forwardRef } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";

const ICONS = {
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  danger: "circle-alert",
  neutral: "info",
};

export const Callout = forwardRef(function Callout(
  { tone = "info", icon, title, children, action, onDismiss, dismissLabel = "Dismiss", className, ...rest },
  ref,
) {
  const lead = icon === false ? null : icon == null ? ICONS[tone] || "info" : icon;
  return (
    <div ref={ref} className={cx("sg-callout", `sg-callout--${tone}`, className)} {...rest}>
      <div className="sg-callout__inner">
        {lead && (
          <span className="sg-callout__icon" aria-hidden="true">
            {typeof lead === "string" ? <Icon name={lead} size={16} /> : lead}
          </span>
        )}
        <div className="sg-callout__body">
          {title && <div className="sg-callout__title">{title}</div>}
          {children != null && <div className="sg-callout__text">{children}</div>}
        </div>
        {action && <div className="sg-callout__action">{action}</div>}
        {onDismiss && (
          <IconButton icon="x" size="xs" label={dismissLabel} onClick={onDismiss} className="sg-callout__dismiss" />
        )}
      </div>
    </div>
  );
});
