import { Children, cloneElement, isValidElement, useId } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export function Field({
  label,
  hint,
  error,
  description,
  required = false,
  optional = false,
  counter,
  layout = "vertical",
  disabled = false,
  id,
  className,
  children,
  ...rest
}) {
  const uid = useId();
  const only = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const childProps = only ? only.props : {};
  const controlId = id || childProps.id || `sg-field-${uid}`;
  const labelId = `${controlId}-label`;
  const descId = `${controlId}-description`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasError = error != null && error !== false && error !== "";
  const hasCounter = counter != null && counter !== false;

  let control = children;
  if (only) {
    const isComponent = typeof only.type !== "string";
    const describedBy =
      cx(childProps["aria-describedby"], description && descId, hasError ? errorId : hint && hintId) || undefined;
    const extra = { id: controlId, "aria-describedby": describedBy };
    if (hasError) extra["aria-invalid"] = true;
    if (required) extra["aria-required"] = true;
    if (disabled) extra.disabled = true;
    if (isComponent) {
      if (hasError) extra.invalid = true;
      if (label && !childProps["aria-label"] && !childProps["aria-labelledby"]) extra["aria-labelledby"] = labelId;
    }
    control = cloneElement(only, extra);
  }

  return (
    <div
      className={cx("sg-field", `sg-field--${layout}`, className)}
      data-invalid={hasError || undefined}
      data-disabled={disabled || undefined}
      {...rest}
    >
      <div className="sg-field__inner">
        {(label || description) && (
          <div className="sg-field__head">
            {label && (
              <label id={labelId} htmlFor={controlId} className="sg-field__label">
                <span className="sg-field__label-text">{label}</span>
                {required && (
                  <span className="sg-field__required" aria-hidden="true">
                    *
                  </span>
                )}
                {optional && !required && <span className="sg-field__optional">Optional</span>}
              </label>
            )}
            {description && (
              <p id={descId} className="sg-field__description">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="sg-field__body">
          {control}
          {(hasError || hint || hasCounter) && (
            <div className="sg-field__foot">
              {hasError ? (
                <p id={errorId} className="sg-field__error">
                  <Icon name="circle-alert" size={14} className="sg-field__error-icon" />
                  <span>{error}</span>
                </p>
              ) : hint ? (
                <p id={hintId} className="sg-field__hint">
                  {hint}
                </p>
              ) : (
                <span />
              )}
              {hasCounter && <span className="sg-field__counter">{counter}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
