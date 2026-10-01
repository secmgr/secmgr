import { forwardRef } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

export const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    icon,
    iconRight,
    loading = false,
    disabled = false,
    kbd,
    fullWidth = false,
    href,
    type = "button",
    className,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  const iconSize = size === "sm" ? 14 : 16;
  const inert = disabled || loading;
  const classes = cx("sg-button", `sg-button--${variant}`, `sg-button--${size}`, {
    "sg-button--full": fullWidth,
    "sg-button--loading": loading,
    "sg-button--icon-only": !children,
  });
  const content = (
    <>
      {loading ? <Spinner size={iconSize} label="Working" /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children != null && <span className="sg-button__label">{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} className="sg-button__icon-right" />}
      {kbd && (
        <Kbd
          keys={kbd}
          size="sm"
          tone={variant === "primary" || variant === "danger" ? "inverse" : "default"}
          className="sg-button__kbd"
        />
      )}
    </>
  );
  if (href && !inert) {
    return (
      <a ref={ref} href={href} className={cx(classes, className)} onClick={onClick} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cx(classes, className)}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={inert ? undefined : onClick}
      {...rest}
    >
      {content}
    </button>
  );
});
