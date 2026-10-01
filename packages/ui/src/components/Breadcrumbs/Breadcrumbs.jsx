import { forwardRef } from "react";
import { cx } from "../_lib/util.js";
import { EnvDot } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";

function Lead({ item }) {
  if (item.dot) return <EnvDot color={item.dot} size={8} className="sg-breadcrumbs__dot" />;
  if (!item.icon) return null;
  if (typeof item.icon === "string") return <Icon name={item.icon} size={16} className="sg-breadcrumbs__icon" />;
  return <span className="sg-breadcrumbs__icon">{item.icon}</span>;
}

export const Breadcrumbs = forwardRef(function Breadcrumbs(
  { items = [], label = "Breadcrumb", className, ...rest },
  ref,
) {
  return (
    <nav ref={ref} aria-label={label} className={cx("sg-breadcrumbs", className)} {...rest}>
      <ol className="sg-breadcrumbs__list">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          const text = typeof it.label === "string" ? it.label : "";
          const Tag = last ? "span" : it.href ? "a" : it.onClick ? "button" : "span";
          return (
            <li key={it.key || i} className={cx("sg-breadcrumbs__item", last && "sg-breadcrumbs__item--current")}>
              {i > 0 && (
                <span className="sg-breadcrumbs__sep" aria-hidden="true">
                  /
                </span>
              )}
              <Tag
                className={cx(
                  "sg-breadcrumbs__link",
                  it.mono && "sg-breadcrumbs__link--mono",
                  Tag === "span" && !last && "sg-breadcrumbs__link--static",
                  it.className,
                )}
                href={Tag === "a" ? it.href : undefined}
                type={Tag === "button" ? "button" : undefined}
                onClick={Tag === "a" || Tag === "button" ? it.onClick : undefined}
                aria-current={last ? "page" : undefined}
                title={text || undefined}
              >
                <Lead item={it} />
                <span className="sg-breadcrumbs__label">{it.label}</span>
              </Tag>
              {it.switcher === true ? (
                <IconButton
                  icon="chevrons-up-down"
                  size="xs"
                  label={it.switcherLabel || (text ? `Switch from ${text}` : "Switch")}
                  onClick={it.onSwitch}
                  className="sg-breadcrumbs__switcher"
                />
              ) : it.switcher ? (
                <span className="sg-breadcrumbs__switcher">{it.switcher}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
