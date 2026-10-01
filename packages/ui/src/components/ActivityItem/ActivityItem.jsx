import { forwardRef, useId } from "react";
import { envName } from "../_lib/compare.js";
import { cx, n, relativeTime, useControllable } from "../_lib/util.js";
import { Avatar } from "../Avatar/Avatar.jsx";
import { EnvBadge } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { SecretValue } from "../SecretValue/SecretValue.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

const ICON = {
  created: "plus",
  updated: "pencil",
  deleted: "trash-2",
  revealed: "eye",
  read: "key-round",
  protected: "lock",
  unprotected: "lock-open",
  rotated: "rotate-cw",
  imported: "upload",
  copied: "copy",
  restored: "history",
};

function Keys({ keys, count }) {
  const list = Array.isArray(keys) ? keys : keys ? [keys] : [];
  if (count != null && (!list.length || list.length > 2))
    return <span className="sg-activity-item__count">{n(count, "secret")}</span>;
  if (list.length > 2) return <span className="sg-activity-item__count">{n(list.length, "secret")}</span>;
  if (list.length === 2)
    return (
      <>
        <code className="sg-activity-item__key">{list[0]}</code> and{" "}
        <code className="sg-activity-item__key">{list[1]}</code>
      </>
    );
  if (list.length === 1) return <code className="sg-activity-item__key">{list[0]}</code>;
  return <span className="sg-activity-item__count">{n(count || 0, "secret")}</span>;
}

function Sentence({ actor, actorType, action, keys, count, env, target, version }) {
  const who =
    actorType === "token" ? (
      <code className="sg-activity-item__actor sg-activity-item__actor--token">{actor}</code>
    ) : (
      <span className="sg-activity-item__actor">{actor}</span>
    );
  const where = env ? <EnvBadge env={env} size="sm" className="sg-activity-item__env" /> : null;
  const to = target ? <EnvBadge env={target} size="sm" className="sg-activity-item__env" /> : null;
  const k = <Keys keys={keys} count={count} />;
  switch (action) {
    case "created":
      return (
        <>
          {who} added {k} to {where}
        </>
      );
    case "deleted":
      return (
        <>
          {who} deleted {k} from {where}
        </>
      );
    case "revealed":
      return (
        <>
          {who} revealed {k} in {where}
        </>
      );
    case "read":
      return (
        <>
          {who} read {k} from {where}
        </>
      );
    case "protected":
      return (
        <>
          {who} protected {where}
        </>
      );
    case "unprotected":
      return (
        <>
          {who} removed protection from {where}
        </>
      );
    case "rotated":
      return (
        <>
          {who} rotated {k} in {where}
        </>
      );
    case "imported":
      return (
        <>
          {who} imported {k} into {where}
        </>
      );
    case "copied":
      return (
        <>
          {who} copied {k} from {where} to {to}
        </>
      );
    case "restored":
      return (
        <>
          {who} restored {k} to {version || "an earlier version"} in {where}
        </>
      );
    default:
      return (
        <>
          {who} updated {k} in {where}
        </>
      );
  }
}

export const ActivityItem = forwardRef(function ActivityItem(
  {
    actor,
    actorType = "member",
    action = "updated",
    keys,
    count,
    env,
    target,
    version,
    time,
    date,
    now,
    diff,
    avatar,
    icon,
    expanded,
    defaultExpanded = false,
    onExpandedChange,
    valueRenderer,
    connector = false,
    loading = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [open, setOpen] = useControllable(expanded, defaultExpanded, onExpandedChange);
  const panelId = useId();
  const when = time || (date != null ? relativeTime(date, now) : null);
  const iconName = icon || ICON[action] || "pencil";

  if (loading) {
    return (
      <div
        ref={ref}
        className={cx("sg-activity-item", "sg-activity-item--loading", className)}
        aria-hidden="true"
        {...rest}
      >
        <span className="sg-activity-item__tile">
          <Spinner size={12} label="Loading activity" />
        </span>
        <span className="sg-activity-item__bone" style={{ width: "58%" }} />
      </div>
    );
  }

  const sentence = children || (
    <Sentence
      actor={actor}
      actorType={actorType}
      action={action}
      keys={keys}
      count={count}
      env={env}
      target={target}
      version={version}
    />
  );
  const mask = (v, side) => {
    if (valueRenderer) {
      const c = valueRenderer(v, { side, key: Array.isArray(keys) ? keys[0] : keys, env: envName(env) });
      if (c !== undefined) return c;
    }
    if (v === "") return <span className="sg-activity-item__empty">Empty</span>;
    return (
      <SecretValue
        value={v}
        revealed={false}
        secretKey={Array.isArray(keys) ? keys[0] : keys}
        className="sg-activity-item__secret"
      />
    );
  };
  const head = (
    <>
      {avatar && (
        <span className="sg-activity-item__avatar">
          {avatar === true ? (
            <Avatar name={actor || ""} size={20} kind={actorType === "token" ? "service" : "person"} />
          ) : (
            avatar
          )}
        </span>
      )}
      <span className="sg-activity-item__sentence">{sentence}</span>
      {when && <span className="sg-activity-item__time">{when}</span>}
      {diff && <Icon name="chevron-right" size={14} className="sg-activity-item__chevron" />}
    </>
  );

  return (
    <div
      ref={ref}
      className={cx("sg-activity-item", className)}
      data-action={action}
      data-connector={connector || undefined}
      data-open={(diff && open) || undefined}
      {...rest}
    >
      <span className="sg-activity-item__tile" aria-hidden="true">
        <Icon name={iconName} size={14} />
      </span>
      <div className="sg-activity-item__main">
        {diff ? (
          <button
            type="button"
            className="sg-activity-item__head sg-activity-item__head--toggle"
            aria-expanded={!!open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            {head}
          </button>
        ) : (
          <div className="sg-activity-item__head">{head}</div>
        )}
        {diff && open && (
          <div id={panelId} className="sg-activity-item__diff" role="group" aria-label="Change">
            <div className="sg-activity-item__diff-row" data-side="before">
              <span className="sg-activity-item__diff-marker" aria-hidden="true" />
              <span className="sg-activity-item__diff-label">{diff.beforeLabel || "Before"}</span>
              <span className="sg-activity-item__diff-value">
                {diff.before === undefined ? (
                  <span className="sg-activity-item__empty">Not set</span>
                ) : (
                  mask(diff.before, "before")
                )}
              </span>
            </div>
            <div className="sg-activity-item__diff-row" data-side="after">
              <span className="sg-activity-item__diff-marker" aria-hidden="true" />
              <span className="sg-activity-item__diff-label">{diff.afterLabel || "After"}</span>
              <span className="sg-activity-item__diff-value">
                {diff.after === undefined ? (
                  <span className="sg-activity-item__empty">Deleted</span>
                ) : (
                  mask(diff.after, "after")
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}

export function dayLabel(date, now = Date.now()) {
  const d = new Date(date);
  const today = new Date(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(
    "en-US",
    sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
  );
}

function clock(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const ActivityFeed = forwardRef(function ActivityFeed(
  { items = [], now, loading = false, empty, valueRenderer, avatars = false, className, ...rest },
  ref,
) {
  const at = now != null ? new Date(now).getTime() : Date.now();
  if (loading) {
    return (
      <div ref={ref} className={cx("sg-activity-feed", className)} aria-busy="true" {...rest}>
        <div className="sg-activity-feed__group">
          <div className="sg-activity-feed__day">
            <span className="sg-activity-item__bone" style={{ width: 48 }} />
          </div>
          <ol className="sg-activity-feed__list">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <ActivityItem loading connector={i < 2} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div ref={ref} className={cx("sg-activity-feed", "sg-activity-feed--empty", className)} {...rest}>
        {empty || (
          <div className="sg-activity-feed__none">
            <Icon name="history" size={20} />
            <span>No activity yet. Changes, reveals and reads show up here.</span>
          </div>
        )}
      </div>
    );
  }
  const groups = [];
  for (const it of items) {
    const label = it.date != null ? dayLabel(it.date, at) : "Earlier";
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return (
    <div ref={ref} className={cx("sg-activity-feed", className)} {...rest}>
      {groups.map((g) => (
        <section key={g.label} className="sg-activity-feed__group" aria-label={g.label}>
          <h4 className="sg-activity-feed__day">{g.label}</h4>
          <ol className="sg-activity-feed__list">
            {g.items.map((it, i) => {
              const { id, date, time, ...itemProps } = it;
              const when =
                time || (date != null ? (g.label === "Today" ? relativeTime(date, at) : clock(date)) : undefined);
              return (
                <li key={id || i} className="sg-activity-feed__entry">
                  <ActivityItem
                    {...itemProps}
                    avatar={itemProps.avatar || (avatars ? true : undefined)}
                    time={when}
                    valueRenderer={itemProps.valueRenderer || valueRenderer}
                    connector={i < g.items.length - 1}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
});
