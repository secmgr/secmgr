import { forwardRef } from "react";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const PageHeader = forwardRef(function PageHeader(
  { title, description, icon, meta, actions, tabs, flush = false, titleAs: Title = "h1", className, ...rest },
  ref,
) {
  return (
    <header
      ref={ref}
      className={cx("sg-page-header", tabs && "sg-page-header--tabs", flush && "sg-page-header--flush", className)}
      {...rest}
    >
      <div className="sg-page-header__main">
        {icon && (
          <div className="sg-page-header__leading">
            {typeof icon === "string" ? (
              <span className="sg-page-header__icon">
                <Icon name={icon} size={16} />
              </span>
            ) : (
              icon
            )}
          </div>
        )}
        <div className="sg-page-header__text">
          <div className="sg-page-header__title-row">
            <Title className="sg-page-header__title">{title}</Title>
            {meta && <div className="sg-page-header__meta">{meta}</div>}
          </div>
          {description && <p className="sg-page-header__description">{description}</p>}
        </div>
        {actions && <div className="sg-page-header__actions">{actions}</div>}
      </div>
      {tabs && <div className="sg-page-header__tabs">{tabs}</div>}
    </header>
  );
});
