import { forwardRef, useId } from "react";
import { cx, useControllable } from "../_lib/util.js";
import { Spinner } from "../Spinner/Spinner.jsx";

export const Switch = forwardRef(function Switch(
  {
    checked,
    defaultChecked = false,
    onCheckedChange,
    size = "md",
    disabled = false,
    loading = false,
    label,
    description,
    labelPosition = "end",
    name,
    value = "on",
    invalid,
    id,
    className,
    onClick,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [on, setOn] = useControllable(checked, defaultChecked, onCheckedChange);
  const uid = useId();
  const switchId = id || `sg-switch-${uid}`;
  const labelId = `${switchId}-label`;
  const descId = `${switchId}-description`;
  const inert = disabled || loading;
  const labelledBy = rest["aria-labelledby"] || (label && !rest["aria-label"] ? labelId : undefined);
  const describedBy = cx(rest["aria-describedby"], description && label && descId) || undefined;

  const control = (
    <button
      ref={ref}
      id={switchId}
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={disabled}
      className={cx("sg-switch", `sg-switch--${size}`, !label && className)}
      data-state={on ? "on" : "off"}
      data-loading={loading || undefined}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented || inert) return;
        setOn(!on);
      }}
      onKeyDown={(e) => {
        if (onKeyDown) onKeyDown(e);
        if (e.defaultPrevented || (e.key !== " " && e.key !== "Enter")) return;
        e.preventDefault();
        if (!inert && !e.repeat) setOn(!on);
      }}
      {...rest}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <span className="sg-switch__thumb" aria-hidden="true">
        {loading && <Spinner size={size === "sm" ? 8 : 10} label="Saving" className="sg-switch__spinner" />}
      </span>
    </button>
  );
  const hidden = name && on ? <input type="hidden" name={name} value={value} /> : null;
  if (!label)
    return hidden ? (
      <>
        {control}
        {hidden}
      </>
    ) : (
      control
    );
  return (
    <label
      className={cx(
        "sg-switch-field",
        `sg-switch-field--${labelPosition}`,
        `sg-switch-field--${size}`,
        { "sg-switch-field--disabled": disabled },
        className,
      )}
      htmlFor={switchId}
    >
      {control}
      <span className="sg-switch-field__text">
        <span id={labelId} className="sg-switch-field__label">
          {label}
        </span>
        {description && (
          <span id={descId} className="sg-switch-field__description">
            {description}
          </span>
        )}
      </span>
      {hidden}
    </label>
  );
});
