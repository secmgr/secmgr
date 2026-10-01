import { cx, formatShortcut } from "../_lib/util.js";

export function Kbd({ keys, children, size = "md", tone = "default", className }) {
  const list = keys ? formatShortcut(Array.isArray(keys) ? keys : [keys]) : null;
  if (list) {
    return (
      <span className={cx("sg-kbd-group", className)}>
        {list.map((k, i) => (
          <kbd key={i} className={cx("sg-kbd", `sg-kbd--${size}`, tone !== "default" && `sg-kbd--${tone}`)}>
            {k}
          </kbd>
        ))}
      </span>
    );
  }
  return (
    <kbd className={cx("sg-kbd", `sg-kbd--${size}`, tone !== "default" && `sg-kbd--${tone}`, className)}>
      {children}
    </kbd>
  );
}
