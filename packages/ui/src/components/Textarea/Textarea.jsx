import { forwardRef, useCallback, useEffect, useId, useRef } from "react";
import { useMergedRef, useValueState } from "../_lib/inputs.js";
import { cx, useIsoLayoutEffect } from "../_lib/util.js";

export const Textarea = forwardRef(function Textarea(
  {
    autoGrow = false,
    minRows = 3,
    maxRows = 12,
    rows,
    mono = false,
    invalid = false,
    counter = false,
    readOnly = false,
    disabled = false,
    value,
    defaultValue,
    onChange,
    onValueChange,
    maxLength,
    className,
    style,
    ...rest
  },
  ref,
) {
  const inner = useRef(null);
  const lastWidth = useRef(0);
  const setRef = useMergedRef(inner, ref);
  const [current, setInner, controlled] = useValueState(value, defaultValue);
  const uid = useId();
  const counterId = `sg-ta-count-${uid}`;
  const ariaInvalid = rest["aria-invalid"];
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  const fit = useCallback(() => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    const cs = window.getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || 20;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const min = minRows * lh + pad;
    const max = Math.max(min, maxRows * lh + pad);
    el.style.height = "auto";
    const chrome = el.offsetHeight - el.clientHeight;
    const h = Math.min(Math.max(el.scrollHeight, min), max) + chrome;
    el.style.height = `${Math.round(h)}px`;
    el.style.overflowY = el.scrollHeight > max + 1 ? "auto" : "hidden";
  }, [autoGrow, minRows, maxRows]);

  useIsoLayoutEffect(() => {
    fit();
  }, [current, fit, mono]);

  useEffect(() => {
    const el = inner.current;
    if (!autoGrow || !el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w !== lastWidth.current) {
        lastWidth.current = w;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoGrow, fit]);

  const handleChange = (e) => {
    if (!controlled) setInner(e.target.value);
    if (onChange) onChange(e);
    if (onValueChange) onValueChange(e.target.value);
  };

  const limit = typeof counter === "number" ? counter : maxLength;
  const count = current.length;
  const tone = limit && count > limit ? "over" : limit && count >= limit * 0.9 ? "near" : undefined;
  const describedBy = cx(rest["aria-describedby"], counter && counterId) || undefined;

  return (
    <div
      className={cx("sg-textarea", { "sg-textarea--mono": mono, "sg-textarea--auto": autoGrow }, className)}
      style={style}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <textarea
        ref={setRef}
        className="sg-textarea__field"
        rows={autoGrow ? minRows : rows || minRows}
        value={current}
        onChange={handleChange}
        readOnly={readOnly}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={isInvalid || undefined}
        spellCheck={mono ? false : undefined}
        autoCapitalize={mono ? "off" : undefined}
        autoCorrect={mono ? "off" : undefined}
        {...rest}
        aria-describedby={describedBy}
      />
      {counter !== false && counter != null && (
        <div className="sg-textarea__footer" aria-hidden={disabled || undefined}>
          <span id={counterId} className="sg-textarea__counter" data-tone={tone}>
            {limit
              ? `${count.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`
              : count.toLocaleString("en-US")}
            <span className="sg-visually-hidden"> characters</span>
          </span>
        </div>
      )}
    </div>
  );
});
