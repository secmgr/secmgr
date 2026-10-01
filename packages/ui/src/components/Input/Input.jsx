import { forwardRef, useRef, useState } from "react";
import { setNativeValue, useMergedRef, useValueState } from "../_lib/inputs.js";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

export const Input = forwardRef(function Input(
  {
    size = "md",
    icon,
    prefix,
    suffix,
    invalid = false,
    mono = false,
    clearable = false,
    clearLabel = "Clear",
    onClear,
    kbd,
    loading = false,
    loadingLabel = "Loading",
    revealable = false,
    selectOnFocus = false,
    readOnly = false,
    disabled = false,
    type = "text",
    value,
    defaultValue,
    onChange,
    onValueChange,
    onFocus,
    className,
    style,
    ...rest
  },
  ref,
) {
  const inner = useRef(null);
  const setRef = useMergedRef(inner, ref);
  const [current, setInner, controlled] = useValueState(value, defaultValue);
  const [revealed, setRevealed] = useState(false);
  const empty = current === "";
  const iconSize = size === "sm" ? 14 : 16;
  const ariaInvalid = rest["aria-invalid"];
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";
  const inert = disabled || readOnly;
  const isPassword = type === "password";

  const handleChange = (e) => {
    if (!controlled) setInner(e.target.value);
    if (onChange) onChange(e);
    if (onValueChange) onValueChange(e.target.value);
  };
  const handleFocus = (e) => {
    if (selectOnFocus) e.target.select();
    if (onFocus) onFocus(e);
  };
  const clear = () => {
    const el = inner.current;
    if (!el) return;
    setNativeValue(el, "");
    el.focus();
    if (onClear) onClear();
  };
  const onWrapperDown = (e) => {
    const el = inner.current;
    if (disabled || !el || e.target === el || e.target.closest("button")) return;
    e.preventDefault();
    el.focus();
  };
  const keepFocus = (e) => e.preventDefault();

  let trailing = null;
  if (loading) trailing = <Spinner size={iconSize} label={loadingLabel} className="sg-input__spinner" />;
  else if (clearable && !empty && !inert)
    trailing = (
      <IconButton
        icon="x"
        label={clearLabel}
        size="xs"
        tabIndex={-1}
        className="sg-input__button"
        onMouseDown={keepFocus}
        onClick={clear}
      />
    );
  else if (kbd && empty && !disabled)
    trailing = <Kbd keys={kbd} size={size === "lg" ? "md" : "sm"} className="sg-input__kbd" />;

  return (
    <div
      className={cx("sg-input", `sg-input--${size}`, { "sg-input--mono": mono }, className)}
      style={style}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-empty={empty || undefined}
      onMouseDown={onWrapperDown}
    >
      {icon && <Icon name={icon} size={iconSize} className="sg-input__icon" />}
      {prefix != null && prefix !== false && <span className="sg-input__affix sg-input__prefix">{prefix}</span>}
      <input
        ref={setRef}
        className="sg-input__field"
        type={isPassword && revealed ? "text" : type}
        value={current}
        onChange={handleChange}
        onFocus={handleFocus}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-busy={loading || undefined}
        spellCheck={mono ? false : undefined}
        autoCapitalize={mono ? "off" : undefined}
        autoCorrect={mono ? "off" : undefined}
        {...rest}
      />
      {trailing}
      {revealable && isPassword && !disabled && (
        <IconButton
          icon={revealed ? "eye-off" : "eye"}
          label={revealed ? "Hide value" : "Reveal value"}
          size="xs"
          pressed={revealed}
          className="sg-input__button"
          onMouseDown={keepFocus}
          onClick={() => setRevealed((v) => !v)}
        />
      )}
      {suffix != null && suffix !== false && <span className="sg-input__affix sg-input__suffix">{suffix}</span>}
    </div>
  );
});
