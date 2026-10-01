import { forwardRef, useRef } from "react";
import { firstEnabled, stepIndex } from "../_lib/inputs.js";
import { cx, useControllable } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const SegmentedControl = forwardRef(function SegmentedControl(
  {
    options = [],
    value,
    defaultValue,
    onValueChange,
    size = "md",
    fullWidth = false,
    disabled = false,
    invalid,
    className,
    style,
    ...rest
  },
  ref,
) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const n = items.length;
  const initial = defaultValue !== undefined ? defaultValue : items.find((o) => !o.disabled)?.value;
  const [selected, setSelected] = useControllable(value, initial, onValueChange);
  const refs = useRef([]);
  const idx = items.findIndex((o) => o.value === selected);
  const isDis = (i) => disabled || !!items[i]?.disabled;
  const tabIdx = idx >= 0 && !isDis(idx) ? idx : firstEnabled(n, isDis);
  const iconSize = size === "sm" ? 14 : 16;

  const choose = (i, focus) => {
    if (i < 0 || isDis(i)) return;
    if (items[i].value !== selected) setSelected(items[i].value);
    if (focus && refs.current[i]) refs.current[i].focus();
  };
  const onKeyDown = (e, i) => {
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = stepIndex(n, i, 1, isDis, true);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = stepIndex(n, i, -1, isDis, true);
    else if (e.key === "Home") next = firstEnabled(n, isDis);
    else if (e.key === "End") next = firstEnabled(n, isDis, true);
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      choose(i);
      return;
    }
    if (next != null) {
      e.preventDefault();
      choose(next, true);
    }
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-orientation="horizontal"
      aria-disabled={disabled || undefined}
      className={cx("sg-segmented", `sg-segmented--${size}`, { "sg-segmented--full": fullWidth }, className)}
      style={{ ...style, "--_n": Math.max(n, 1), "--_i": Math.max(idx, 0) }}
      data-disabled={disabled || undefined}
      {...rest}
    >
      <span className="sg-segmented__thumb" aria-hidden="true" data-hidden={idx < 0 || undefined} />
      {items.map((o, i) => {
        const on = i === idx;
        const iconOnly = !o.label && !!o.icon;
        const name = o["aria-label"] || (iconOnly ? String(o.value) : undefined);
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={name}
            title={iconOnly ? name : undefined}
            tabIndex={i === tabIdx ? 0 : -1}
            disabled={isDis(i)}
            className={cx("sg-segmented__item", { "sg-segmented__item--icon": iconOnly }, o.className)}
            data-state={on ? "on" : "off"}
            onClick={() => choose(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.icon && <Icon name={o.icon} size={iconSize} className="sg-segmented__icon" />}
            {o.label != null && <span className="sg-segmented__label">{o.label}</span>}
            {o.count != null && (
              <span className="sg-segmented__count">
                {typeof o.count === "number" ? o.count.toLocaleString("en-US") : o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
