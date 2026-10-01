import { useEffect, useRef, useState } from "react";
import { cx, n } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { EnvBadge, EnvDot, envColor } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";

const KINDS = [
  { id: "edited", word: "edited" },
  { id: "added", word: "new" },
  { id: "deleted", word: "deleted" },
];

export function ChangesBar({
  changes,
  env,
  open,
  saving = false,
  error,
  onSave,
  onDiscard,
  onReview,
  onRetry,
  shortcut = true,
  position = "sticky",
  className,
  ...rest
}) {
  const c = changes || {};
  const total = (c.edited || 0) + (c.added || 0) + (c.deleted || 0);
  const visible = open !== undefined ? !!open : total > 0;
  const last = useRef({ c, total });
  if (visible && total > 0) last.current = { c, total };
  const shown = visible ? { c, total } : last.current;
  const [mounted, setMounted] = useState(visible);
  const [phase, setPhase] = useState("in");
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setPhase("in");
      return undefined;
    }
    if (!mounted) return undefined;
    setPhase("out");
    const t = setTimeout(() => setMounted(false), 180);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || !shortcut || saving) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (saveRef.current) saveRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, shortcut, saving]);

  if (!mounted) return null;
  const count = shown.total;
  const status = saving ? "saving" : error ? "error" : "idle";
  const envName = env && (env.name || env);
  const locked = !!env?.protected;
  const errorText = typeof error === "string" ? error : `Could not save. ${n(count, "change")} kept.`;
  const items = KINDS.filter((k) => shown.c[k.id] > 0);

  return (
    <div className={cx("sg-changes-dock", `sg-changes-dock--${position}`, className)} {...rest}>
      <div
        role="region"
        aria-label={envName ? `Unsaved changes in ${envName}` : "Unsaved changes"}
        className="sg-changes-bar"
        data-state={phase}
        data-status={status}
      >
        <div className="sg-changes-bar__summary" aria-live="polite">
          {error && !saving ? (
            <span className="sg-changes-bar__error">
              <Icon name="circle-alert" size={16} />
              <span className="sg-changes-bar__error-text">{errorText}</span>
            </span>
          ) : (
            <>
              <span className="sg-changes-bar__full">
                {items.map((k, i) => (
                  <span key={k.id} className="sg-changes-bar__item">
                    {i > 0 && (
                      <span className="sg-changes-bar__sep" aria-hidden="true">
                        ·
                      </span>
                    )}
                    <span className="sg-changes-bar__tick" data-kind={k.id} aria-hidden="true" />
                    <span className="sg-changes-bar__count">{shown.c[k.id]}</span> {k.word}
                  </span>
                ))}
              </span>
              <span className="sg-changes-bar__short">
                {env && <EnvDot color={envColor(env)} size={8} />}
                {locked && <Icon name="lock" size={12} className="sg-changes-bar__lock" label="Protected" />}
                <span className="sg-changes-bar__count">{count}</span> {count === 1 ? "change" : "changes"}
              </span>
            </>
          )}
        </div>
        {env && (
          <>
            <span className="sg-changes-bar__divider" aria-hidden="true" />
            <EnvBadge env={env} size="sm" className="sg-changes-bar__env" />
          </>
        )}
        <div className="sg-changes-bar__actions">
          {onDiscard && (
            <Button size="sm" variant="ghost" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
          )}
          {onReview && (
            <Button size="sm" variant="secondary" onClick={onReview} disabled={saving}>
              Review
            </Button>
          )}
          {error && !saving ? (
            <Button size="sm" variant="primary" icon="rotate-ccw" onClick={onRetry || onSave}>
              Retry
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              kbd={saving || !shortcut ? undefined : ["mod", "s"]}
              className="sg-changes-bar__save"
              onClick={onSave}
            >
              {saving ? (
                "Saving"
              ) : (
                <>
                  <span className="sg-changes-bar__full">Save {n(count, "change")}</span>
                  <span className="sg-changes-bar__short">Save</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
