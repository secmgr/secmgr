import { forwardRef } from "react";
import { cx, n, useControllable } from "../_lib/util.js";
import { EnvBadge, EnvDot, envColor } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { Tooltip } from "../Tooltip/Tooltip.jsx";

function Health({ issues }) {
  if (issues > 0) {
    return (
      <span className="sg-project-card__health" data-tone="warning">
        <Icon name="triangle-alert" size={14} />
        <span>{n(issues, "issue")}</span>
      </span>
    );
  }
  return (
    <span className="sg-project-card__health" data-tone="success">
      <Icon name="circle-check" size={14} />
      <span>Healthy</span>
    </span>
  );
}

export const ProjectCard = forwardRef(function ProjectCard(
  {
    variant = "grid",
    name,
    repo,
    envs = [],
    issues = 0,
    health,
    activity,
    time,
    starred,
    defaultStarred = false,
    onStarredChange,
    menu,
    href,
    onOpen,
    loading = false,
    className,
    ...rest
  },
  ref,
) {
  const [star, setStar] = useControllable(starred, defaultStarred, onStarredChange);
  const total = envs.reduce((s, e) => s + (e.count || 0), 0);
  const label = `${name}, ${n(envs.length, "environment")}, ${issues > 0 ? n(issues, "issue") : "healthy"}`;

  if (loading) {
    return (
      <div
        ref={ref}
        className={cx("sg-project-card", `sg-project-card--${variant}`, "sg-project-card--loading", className)}
        aria-busy="true"
        {...rest}
      >
        <span className="sg-project-card__bone" style={{ width: "44%", height: 14 }} />
        <span className="sg-project-card__bone" style={{ width: "62%" }} />
        <span className="sg-project-card__bone" style={{ width: "80%" }} />
        <span className="sg-project-card__bone" style={{ width: "56%" }} />
      </div>
    );
  }

  const Link = href ? "a" : "button";
  const linkProps = href ? { href } : { type: "button" };

  return (
    <article
      ref={ref}
      className={cx("sg-project-card", `sg-project-card--${variant}`, className)}
      data-starred={star || undefined}
      {...rest}
    >
      <div className="sg-project-card__body">
        <div className="sg-project-card__head">
          <h3 className="sg-project-card__name">
            <Link {...linkProps} className="sg-project-card__link" aria-label={label} onClick={onOpen}>
              <span className="sg-project-card__name-text">{name}</span>
            </Link>
          </h3>
          {repo && (
            <span className="sg-project-card__repo">
              <Icon name="folder-git-2" size={14} />
              <span className="sg-project-card__repo-text">{repo}</span>
            </span>
          )}
        </div>
        <div className="sg-project-card__envs" aria-label={`${n(envs.length, "environment")}, ${n(total, "secret")}`}>
          {variant === "row"
            ? envs.map((e) => (
                <Tooltip
                  key={e.name}
                  content={`${e.name}: ${n(e.count || 0, "secret")}${e.protected ? ", protected" : ""}`}
                >
                  <span className="sg-project-card__env-mini" aria-label={`${e.name}: ${n(e.count || 0, "secret")}`}>
                    <EnvDot color={envColor(e)} size={6} />
                    <span aria-hidden="true">{e.count != null ? e.count : e.name}</span>
                  </span>
                </Tooltip>
              ))
            : envs.map((e) => <EnvBadge key={e.name} env={e} variant="dot" size="sm" count={e.count} />)}
        </div>
        <div className="sg-project-card__meta">
          {health || <Health issues={issues} />}
          {activity && (
            <span className="sg-project-card__activity">
              <span className="sg-project-card__activity-text">{activity}</span>
              {time && <span className="sg-project-card__time">{time}</span>}
            </span>
          )}
        </div>
        <div className="sg-project-card__actions">
          <IconButton
            icon="star"
            size="xs"
            label={star ? `Unstar ${name}` : `Star ${name}`}
            pressed={!!star}
            className="sg-project-card__star"
            onClick={() => setStar(!star)}
          />
          {menu}
        </div>
      </div>
    </article>
  );
});
