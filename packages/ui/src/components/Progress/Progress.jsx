import { useId } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

const TONE_ICON = { success: "circle-check", warning: "triangle-alert", danger: "circle-alert" };

export function Progress({
  value,
  max = 100,
  indeterminate = false,
  label,
  valueLabel,
  showValue = false,
  hint,
  tone = "neutral",
  className,
  "aria-label": ariaLabel,
  ...rest
}) {
  const uid = useId();
  const labelId = label ? `sg-progress-${uid}-label` : undefined;
  const hintId = hint ? `sg-progress-${uid}-hint` : undefined;
  const isInd = indeterminate || value == null;
  const pct = isInd ? 0 : Math.min(100, Math.max(0, (Number(value) / (max || 100)) * 100));
  const right = valueLabel != null ? valueLabel : showValue && !isInd ? `${Math.round(pct)}%` : null;
  const valueText = typeof right === "string" ? right : isInd ? "In progress" : `${Math.round(pct)}%`;

  return (
    <div
      className={cx("sg-progress", `sg-progress--${tone}`, { "sg-progress--indeterminate": isInd }, className)}
      data-complete={!isInd && pct >= 100 ? "" : undefined}
      {...rest}
    >
      {(label || right != null) && (
        <div className="sg-progress__head">
          {label && (
            <span id={labelId} className="sg-progress__label">
              {TONE_ICON[tone] && <Icon name={TONE_ICON[tone]} size={14} className="sg-progress__icon" />}
              <span className="sg-progress__label-text">{label}</span>
            </span>
          )}
          {right != null && <span className="sg-progress__value">{right}</span>}
        </div>
      )}
      <div
        className="sg-progress__track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : ariaLabel || "Progress"}
        aria-describedby={hintId}
        aria-valuemin={isInd ? undefined : 0}
        aria-valuemax={isInd ? undefined : max}
        aria-valuenow={isInd ? undefined : Number(value)}
        aria-valuetext={valueText}
        aria-busy={isInd || pct < 100 || undefined}
      >
        <div
          className="sg-progress__bar"
          style={isInd ? undefined : { transform: `translateX(${(pct - 100).toFixed(2)}%)` }}
        />
      </div>
      {hint && (
        <div id={hintId} className="sg-progress__hint">
          {hint}
        </div>
      )}
    </div>
  );
}
