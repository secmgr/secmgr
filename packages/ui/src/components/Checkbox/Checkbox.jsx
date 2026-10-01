import { forwardRef, useEffect, useId, useRef } from "react";
import { cx, useControllable } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const Checkbox = forwardRef(function Checkbox(
  {
    checked,
    defaultChecked = false,
    indeterminate = false,
    onCheckedChange,
    disabled = false,
    label,
    description,
    id,
    className,
    ...rest
  },
  ref,
) {
  const [on, setOn] = useControllable(checked, defaultChecked, onCheckedChange);
  const inner = useRef(null);
  const auto = useId();
  const inputId = id || `sg-cb-${auto}`;
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  const setRefs = (el) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const state = indeterminate ? "mixed" : on ? "on" : "off";
  const box = (
    <span className={cx("sg-checkbox", className)} data-state={state} data-disabled={disabled || undefined}>
      <input
        ref={setRefs}
        id={inputId}
        type="checkbox"
        className="sg-checkbox__input"
        checked={!!on}
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : !!on}
        onChange={(e) => setOn(e.target.checked)}
        {...rest}
      />
      <span className="sg-checkbox__box" aria-hidden="true">
        <Icon name={indeterminate ? "minus" : "check"} size={12} strokeWidth={3} className="sg-checkbox__mark" />
      </span>
    </span>
  );
  if (!label) return box;
  return (
    <label className={cx("sg-checkbox-field", disabled && "sg-checkbox-field--disabled")} htmlFor={inputId}>
      {box}
      <span className="sg-checkbox-field__text">
        <span className="sg-checkbox-field__label">{label}</span>
        {description && <span className="sg-checkbox-field__description">{description}</span>}
      </span>
    </label>
  );
});
