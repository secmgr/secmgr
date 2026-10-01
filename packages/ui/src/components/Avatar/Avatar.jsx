import { forwardRef, useEffect, useState } from "react";
import { hashString, initialsOf } from "../_lib/inputs.js";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export const AVATAR_HUES = ["blue", "teal", "green", "amber", "orange", "rose", "violet"];
const SIZES = [16, 20, 24, 32];
const BOT = { 16: 12, 20: 14, 24: 16, 32: 20 };

export function avatarHue(name) {
  return AVATAR_HUES[hashString(name) % AVATAR_HUES.length];
}

export const Avatar = forwardRef(function Avatar(
  { name = "", src, size = 24, kind = "person", alt, title, className, style, ...rest },
  ref,
) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const px = SIZES.includes(size) ? size : 24;
  const label = alt != null ? alt : name;
  const tip = title !== undefined ? title : name || undefined;

  if (kind === "service") {
    return (
      <span
        ref={ref}
        role="img"
        aria-label={label ? `Service token ${label}` : "Service token"}
        title={tip}
        className={cx("sg-avatar", "sg-avatar--service", `sg-avatar--${px}`, className)}
        style={style}
        {...rest}
      >
        <Icon name="bot" size={BOT[px]} />
      </span>
    );
  }

  const hue = avatarHue(name);
  const showImg = src && !failed;
  const initials = initialsOf(name, px === 16 ? 1 : 2);
  return (
    <span
      ref={ref}
      role="img"
      aria-label={label || undefined}
      title={tip}
      className={cx("sg-avatar", `sg-avatar--${px}`, { "sg-avatar--image": showImg }, className)}
      style={
        initials || showImg ? { "--_bg": `var(--env-${hue}-soft)`, "--_fg": `var(--env-${hue}-text)`, ...style } : style
      }
      data-hue={hue}
      {...rest}
    >
      {showImg ? (
        <img className="sg-avatar__img" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
      ) : initials ? (
        <span className="sg-avatar__initials" aria-hidden="true">
          {initials}
        </span>
      ) : (
        <Icon name="user" size={BOT[px]} />
      )}
    </span>
  );
});

function toItem(p) {
  return typeof p === "string" ? { name: p } : p;
}

export function AvatarStack({ people = [], max = 3, size = 24, ground = "surface", label, className, style, ...rest }) {
  const items = people.map(toItem);
  const limit = Math.max(1, max);
  const shown = items.length > limit ? items.slice(0, limit) : items;
  const hidden = items.slice(shown.length);
  const px = SIZES.includes(size) ? size : 24;
  const names = items.map((p) => (p.kind === "service" ? `service token ${p.name}` : p.name));
  const summary =
    label ||
    (hidden.length
      ? `${names.slice(0, shown.length).join(", ")} and ${hidden.length} more`
      : names.length > 1
        ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
        : names[0] || "");
  return (
    <span
      role="img"
      aria-label={summary}
      className={cx("sg-avatar-stack", `sg-avatar-stack--${px}`, className)}
      style={{ "--_ring": `var(--${ground})`, ...style }}
      {...rest}
    >
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          kind={p.kind}
          size={px}
          className="sg-avatar-stack__item"
          aria-hidden="true"
          role={undefined}
          aria-label={undefined}
        />
      ))}
      {hidden.length > 0 && (
        <span
          className={cx("sg-avatar", `sg-avatar--${px}`, "sg-avatar-stack__item", "sg-avatar-stack__more")}
          title={hidden.map((p) => p.name).join(", ")}
          aria-hidden="true"
        >
          +{hidden.length}
        </span>
      )}
    </span>
  );
}
