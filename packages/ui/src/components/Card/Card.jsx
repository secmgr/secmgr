import { forwardRef } from "react";
import { cx } from "../_lib/util.js";

export const Card = forwardRef(function Card(
  {
    title,
    description,
    actions,
    footer,
    padding = "md",
    interactive = false,
    href,
    onClick,
    label,
    titleAs: Title = "h3",
    children,
    className,
    ...rest
  },
  ref,
) {
  const clickable = interactive && (href || onClick);
  const Hit = href ? "a" : "button";
  const hitProps = clickable ? { href, type: href ? undefined : "button", onClick, className: "sg-card__link" } : null;
  const hasHead = title || description || actions;
  return (
    <div
      ref={ref}
      className={cx("sg-card", `sg-card--pad-${padding}`, interactive && "sg-card--interactive", className)}
      {...rest}
    >
      {clickable && !title && <Hit {...hitProps} aria-label={label} className="sg-card__link sg-card__link--bare" />}
      {hasHead && (
        <div className="sg-card__header">
          <div className="sg-card__heading">
            {title && (
              <Title className="sg-card__title">
                {clickable ? (
                  <Hit {...hitProps} aria-label={label}>
                    {title}
                  </Hit>
                ) : (
                  title
                )}
              </Title>
            )}
            {description && <p className="sg-card__description">{description}</p>}
          </div>
          {actions && <div className="sg-card__actions">{actions}</div>}
        </div>
      )}
      {children != null && <div className="sg-card__body">{children}</div>}
      {footer && <div className="sg-card__footer">{footer}</div>}
    </div>
  );
});
