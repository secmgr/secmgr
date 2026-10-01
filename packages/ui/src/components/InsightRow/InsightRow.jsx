import { forwardRef, isValidElement } from "react";
import { cx } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { EnvBadge, EnvDot, envColor } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { Tooltip } from "../Tooltip/Tooltip.jsx";

const SEVERITY = {
  danger: { icon: "circle-alert", word: "Critical" },
  warning: { icon: "triangle-alert", word: "Warning" },
  info: { icon: "info", word: "Info" },
};

function renderAction(action, size, primary) {
  if (!action) return null;
  if (isValidElement(action)) return action;
  return (
    <Button
      size={size}
      variant={primary ? "secondary" : "ghost"}
      icon={action.icon}
      iconRight={action.iconRight}
      onClick={action.onClick}
      href={action.href}
      className="sg-insight-row__action"
    >
      {action.label}
    </Button>
  );
}

export const InsightRow = forwardRef(function InsightRow(
  {
    severity = "warning",
    title,
    description,
    keys = [],
    envs = [],
    action,
    onDismiss,
    onSnooze,
    menu,
    variant = "default",
    className,
    ...rest
  },
  ref,
) {
  const meta = SEVERITY[severity] || SEVERITY.warning;
  if (variant === "compact") {
    return (
      <div
        ref={ref}
        className={cx("sg-insight-row", "sg-insight-row--compact", className)}
        data-severity={severity}
        {...rest}
      >
        <Icon name={meta.icon} size={16} label={meta.word} className="sg-insight-row__icon" />
        <span className="sg-insight-row__title">{title}</span>
        {envs.length > 0 && (
          <Tooltip content={envs.map((e) => (typeof e === "string" ? e : e.name)).join(", ")}>
            <span
              className="sg-insight-row__dots"
              role="img"
              aria-label={envs.map((e) => (typeof e === "string" ? e : e.name)).join(", ")}
            >
              {envs.map((e) => (
                <EnvDot key={typeof e === "string" ? e : e.name} color={envColor(e)} size={6} />
              ))}
            </span>
          </Tooltip>
        )}
        {renderAction(action, "sm", false)}
      </div>
    );
  }
  return (
    <div ref={ref} className={cx("sg-insight-row", className)} data-severity={severity} {...rest}>
      <span className="sg-insight-row__tile">
        <Icon name={meta.icon} size={16} label={meta.word} />
      </span>
      <div className="sg-insight-row__body">
        <span className="sg-insight-row__title">{title}</span>
        {description && <span className="sg-insight-row__description">{description}</span>}
        {(keys.length > 0 || envs.length > 0) && (
          <span className="sg-insight-row__affected">
            {keys.map((k) => (
              <code key={k} className="sg-insight-row__key">
                {k}
              </code>
            ))}
            {envs.map((e) => (
              <EnvBadge key={typeof e === "string" ? e : e.name} env={e} size="sm" />
            ))}
          </span>
        )}
      </div>
      <div className="sg-insight-row__actions">
        {renderAction(action, "sm", true)}
        {onSnooze && <IconButton icon="bell-off" size="sm" label="Snooze for 7 days" onClick={onSnooze} />}
        {onDismiss && <IconButton icon="x" size="sm" label="Dismiss" onClick={onDismiss} />}
        {menu}
      </div>
    </div>
  );
});
