import { forwardRef, useId, useRef } from "react";
import { firstEnabled, stepIndex } from "../_lib/inputs.js";
import { cx, useControllable } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const RadioGroup = forwardRef(function RadioGroup(
  {
    options = [],
    value,
    defaultValue = null,
    onValueChange,
    variant = "list",
    orientation = "vertical",
    name,
    disabled = false,
    invalid = false,
    id,
    className,
    ...rest
  },
  ref,
) {
  const uid = useId();
  const base = id || `sg-rg-${uid}`;
  const [selected, setSelected] = useControllable(value, defaultValue, onValueChange);
  const refs = useRef([]);
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const n = items.length;
  const isDis = (i) => disabled || !!items[i]?.disabled;
  const selIdx = items.findIndex((o) => o.value === selected);
  const tabIdx = selIdx >= 0 && !isDis(selIdx) ? selIdx : firstEnabled(n, isDis);
  const isInvalid = invalid || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";

  const choose = (i, focus) => {
    if (i < 0 || isDis(i)) return;
    if (items[i].value !== selected) setSelected(items[i].value);
    if (focus && refs.current[i]) refs.current[i].focus();
  };
  const onKeyDown = (e, i) => {
    let next = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = stepIndex(n, i, 1, isDis, true);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = stepIndex(n, i, -1, isDis, true);
    else if (e.key === "Home") next = firstEnabled(n, isDis);
    else if (e.key === "End") next = firstEnabled(n, isDis, true);
    else if (e.key === " ") {
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
      id={base}
      role="radiogroup"
      aria-orientation={orientation}
      aria-disabled={disabled || undefined}
      aria-invalid={isInvalid || undefined}
      className={cx("sg-radio-group", `sg-radio-group--${variant}`, `sg-radio-group--${orientation}`, className)}
      data-invalid={isInvalid || undefined}
      {...rest}
    >
      {items.map((o, i) => {
        const checked = o.value === selected;
        const itemId = `${base}-${i}`;
        const labelId = `${itemId}-label`;
        const descId = o.description ? `${itemId}-description` : undefined;
        const off = isDis(i);
        return (
          <label
            key={String(o.value)}
            htmlFor={itemId}
            className={cx("sg-radio", variant === "cards" && "sg-radio--card", o.className)}
            data-state={checked ? "on" : "off"}
            data-disabled={off || undefined}
          >
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={itemId}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-labelledby={labelId}
              aria-describedby={descId}
              tabIndex={i === tabIdx ? 0 : -1}
              disabled={off}
              className="sg-radio__control"
              onClick={() => choose(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="sg-radio__dot" aria-hidden="true" />
            </button>
            <span className="sg-radio__text">
              <span id={labelId} className="sg-radio__label">
                {o.icon && <Icon name={o.icon} size={16} className="sg-radio__icon" />}
                <span className="sg-radio__label-text">{o.label}</span>
              </span>
              {o.description && (
                <span id={descId} className="sg-radio__description">
                  {o.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
      {name && <input type="hidden" name={name} value={selected == null ? "" : String(selected)} />}
    </div>
  );
});
