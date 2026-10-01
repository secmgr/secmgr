import { forwardRef } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";
import { Tooltip } from "../Tooltip/Tooltip.jsx";

const MODIFIERS = { mod: "Meta", cmd: "Meta", ctrl: "Control", shift: "Shift", alt: "Alt" };
const NAMED = {
  esc: "Escape",
  enter: "Enter",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  backspace: "Backspace",
  tab: "Tab",
  space: "Space",
};

function keyShortcut(kbd) {
  const keys = Array.isArray(kbd) ? kbd : [kbd];
  const chord = keys.some((k) => MODIFIERS[String(k).toLowerCase()]);
  if (keys.length > 1 && !chord) return undefined;
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return keys
    .map((k) => {
      const low = String(k).toLowerCase();
      if (low === "mod") return mac ? "Meta" : "Control";
      return MODIFIERS[low] || NAMED[low] || (low.length === 1 ? low.toUpperCase() : k);
    })
    .join("+");
}

export const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    variant = "ghost",
    size = "md",
    pressed,
    loading = false,
    disabled = false,
    kbd,
    tooltip = true,
    tooltipSide = "top",
    type = "button",
    className,
    onClick,
    ...rest
  },
  ref,
) {
  const iconSize = size === "xs" ? 14 : 16;
  const inert = disabled || loading;
  const button = (
    <button
      ref={ref}
      type={type}
      className={cx("sg-icon-button", `sg-icon-button--${variant}`, `sg-icon-button--${size}`, className)}
      aria-label={label}
      aria-keyshortcuts={kbd ? keyShortcut(kbd) : undefined}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={inert ? undefined : onClick}
      {...rest}
    >
      {loading ? <Spinner size={iconSize} label={label} /> : <Icon name={icon} size={iconSize} />}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip content={label} kbd={kbd} side={tooltipSide} describe={false}>
      {button}
    </Tooltip>
  );
});
