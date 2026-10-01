import { cx } from "../_lib/util.js";
import { ICONS } from "./icons.generated.js";

const warned = new Set();

export function Icon({ name, size = 16, strokeWidth = 1.75, filled = false, label, className, style, ...rest }) {
  const body = ICONS[name];
  if (!body) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[secmgr] Icon "${name}" is not in the icon set. Add it to an icons.txt file and rebuild.`);
    }
    return (
      <span
        className={cx("sg-icon", "sg-icon--missing", className)}
        style={{ width: size, height: size, ...style }}
        aria-hidden="true"
      />
    );
  }
  return (
    <svg
      className={cx("sg-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      style={style}
      dangerouslySetInnerHTML={{ __html: body }}
      {...rest}
    />
  );
}

export function hasIcon(name) {
  return Object.hasOwn(ICONS, name);
}

export const iconNames = Object.keys(ICONS);

export function iconMarkup(name, size = 16, strokeWidth = 1.75) {
  const body = ICONS[name];
  if (!body) return "";
  return `<svg class="sg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
