import { forwardRef, useEffect, useRef, useState } from "react";
import { copyText, cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const CopyButton = forwardRef(function CopyButton(
  {
    value,
    label = "Copy value",
    copiedLabel = "Copied",
    variant = "icon",
    size,
    appearance = "ghost",
    timeout = 1600,
    copied,
    onCopied,
    onClick,
    disabled = false,
    children,
    className,
    ...rest
  },
  ref,
) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shown = copied ? "copied" : state;
  const isText = variant === "text";
  const sz = size || "sm";
  const iconSize = sz === "xs" || (isText && sz === "sm") ? 14 : 16;

  const handle = async (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || disabled) return;
    let v = typeof value === "function" ? value() : value;
    if (v && typeof v.then === "function") v = await v;
    const ok = await copyText(v == null ? "" : String(v));
    clearTimeout(timer.current);
    setState(ok ? "copied" : "failed");
    if (ok && onCopied) onCopied(v);
    timer.current = setTimeout(() => setState("idle"), timeout);
  };

  const icons = (
    <span className="sg-copy-button__icons" style={{ width: iconSize, height: iconSize }} aria-hidden="true">
      <Icon name="copy" size={iconSize} className="sg-copy-button__copy" />
      <Icon name="check" size={iconSize} className="sg-copy-button__check" />
    </span>
  );
  const status = (
    <span className="sg-visually-hidden" role="status">
      {shown === "copied"
        ? copiedLabel
        : shown === "failed"
          ? "Copy failed. Select the value and copy it manually."
          : ""}
    </span>
  );

  if (isText) {
    return (
      <>
        <button
          ref={ref}
          type="button"
          className={cx(
            "sg-button",
            `sg-button--${appearance}`,
            `sg-button--${sz === "xs" ? "sm" : sz}`,
            "sg-copy-button",
            "sg-copy-button--text",
            className,
          )}
          data-state={shown}
          disabled={disabled}
          onClick={handle}
          {...rest}
        >
          {icons}
          <span className="sg-button__label sg-copy-button__labels">
            <span className="sg-copy-button__label-idle">{children || "Copy"}</span>
            <span className="sg-copy-button__label-done" aria-hidden="true">
              {copiedLabel}
            </span>
          </span>
        </button>
        {status}
      </>
    );
  }
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={cx(
          "sg-icon-button",
          `sg-icon-button--${appearance}`,
          `sg-icon-button--${sz}`,
          "sg-copy-button",
          className,
        )}
        aria-label={label}
        title={shown === "copied" ? copiedLabel : label}
        data-state={shown}
        disabled={disabled}
        onClick={handle}
        {...rest}
      >
        {icons}
      </button>
      {status}
    </>
  );
});
