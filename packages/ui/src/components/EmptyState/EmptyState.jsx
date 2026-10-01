import { forwardRef } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const EmptyState = forwardRef(function EmptyState(
  { icon, title, description, actions, hint, variant = "page", titleAs, className, ...rest },
  ref,
) {
  const Title = titleAs || (variant === "page" ? "h2" : "p");
  return (
    <div ref={ref} className={cx("sg-empty", `sg-empty--${variant}`, className)} {...rest}>
      {icon && (
        <div className="sg-empty__icon" aria-hidden="true">
          {typeof icon === "string" ? <Icon name={icon} size={20} /> : icon}
        </div>
      )}
      {title && <Title className="sg-empty__title">{title}</Title>}
      {description && <p className="sg-empty__description">{description}</p>}
      {actions && <div className="sg-empty__actions">{actions}</div>}
      {hint && <div className="sg-empty__hint">{hint}</div>}
    </div>
  );
});
