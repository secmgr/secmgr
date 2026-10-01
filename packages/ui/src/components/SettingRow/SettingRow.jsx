import { forwardRef, useId } from "react";
import { cx } from "../_lib/util.js";
import { Card } from "../Card/Card.jsx";

export const SettingRow = forwardRef(function SettingRow(
  { label, description, children, danger = false, htmlFor, className, ...rest },
  ref,
) {
  const id = useId();
  const LabelTag = htmlFor ? "label" : "div";
  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-desc` : undefined}
      className={cx("sg-setting-row", danger && "sg-setting-row--danger", className)}
      {...rest}
    >
      <div className="sg-setting-row__inner">
        <div className="sg-setting-row__text">
          <LabelTag id={`${id}-label`} className="sg-setting-row__label" htmlFor={htmlFor}>
            {label}
          </LabelTag>
          {description && (
            <p id={`${id}-desc`} className="sg-setting-row__description">
              {description}
            </p>
          )}
        </div>
        {children != null && <div className="sg-setting-row__control">{children}</div>}
      </div>
    </div>
  );
});

export function SettingsGroup({ title, description, children, danger = false, className, ...rest }) {
  const id = useId();
  return (
    <section
      className={cx("sg-settings-group", danger && "sg-settings-group--danger", className)}
      aria-labelledby={title ? `${id}-title` : undefined}
      {...rest}
    >
      {(title || description) && (
        <div className="sg-settings-group__header">
          {title && (
            <h2 id={`${id}-title`} className="sg-settings-group__title">
              {title}
            </h2>
          )}
          {description && <p className="sg-settings-group__description">{description}</p>}
        </div>
      )}
      <Card padding="none" className="sg-settings-group__card">
        {children}
      </Card>
    </section>
  );
}
