import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { computePosition } from "../_lib/floating.js";
import { splitReferences } from "../_lib/secrets.js";
import { cx, n, Portal, useControllable } from "../_lib/util.js";
import { CopyButton } from "../CopyButton/CopyButton.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";

function RefHint({ anchor, refKey, resolved, id }) {
  const [node, setNode] = useState(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!anchor || !node) return;
    const p = computePosition(anchor.getBoundingClientRect(), node.getBoundingClientRect(), "top-start", 6);
    if (!pos || p.top !== pos.top || p.left !== pos.left) setPos(p);
  });
  const missing = resolved == null;
  return (
    <Portal>
      <div
        ref={setNode}
        id={id}
        role="tooltip"
        className="sg-secret-value__hint"
        data-missing={missing || undefined}
        data-side={pos ? pos.side : "top"}
        style={{ top: pos ? pos.top : -9999, left: pos ? pos.left : -9999, visibility: pos ? "visible" : "hidden" }}
      >
        <span className="sg-secret-value__hint-key">{refKey}</span>
        {missing ? (
          <span className="sg-secret-value__hint-missing">
            <Icon name="circle-alert" size={14} />
            Not set in this environment
          </span>
        ) : resolved === "" ? (
          <span className="sg-secret-value__hint-empty">Empty</span>
        ) : (
          <span className="sg-secret-value__hint-value">{resolved}</span>
        )}
      </div>
    </Portal>
  );
}

function Tokens({ text, resolve, focusableRefs, onHint, hintId }) {
  const parts = splitReferences(text);
  return parts.map((p, i) => {
    if (p.type !== "ref") return <span key={i}>{p.text}</span>;
    const show = (e) => resolve && onHint({ el: e.currentTarget, key: p.key });
    const hide = () => onHint(null);
    return (
      <span
        key={i}
        className="sg-secret-value__ref"
        data-resolvable={resolve ? "" : undefined}
        tabIndex={resolve && focusableRefs ? 0 : undefined}
        aria-describedby={resolve ? hintId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {p.text}
      </span>
    );
  });
}

export const SecretValue = forwardRef(function SecretValue(
  {
    value = "",
    revealed,
    defaultRevealed,
    onRevealedChange,
    revealTimeout = 10000,
    sensitive = true,
    layout = "truncate",
    resolve,
    revealable = false,
    copyable = false,
    onCopied,
    secretKey,
    className,
    ...rest
  },
  ref,
) {
  const [shown, setShown] = useControllable(
    revealed,
    defaultRevealed !== undefined ? defaultRevealed : !sensitive,
    onRevealedChange,
  );
  const setShownRef = useRef(setShown);
  setShownRef.current = setShown;
  const [cycle, setCycle] = useState(0);
  const [hint, setHint] = useState(null);
  const hintId = useId();
  const text = value == null ? "" : String(value);
  const empty = text === "";
  const timed = !!shown && sensitive && !empty && revealTimeout > 0;

  useEffect(() => {
    if (!timed) return undefined;
    const t = setTimeout(() => setShownRef.current(false), revealTimeout);
    return () => clearTimeout(t);
  }, [timed, revealTimeout, cycle]);

  useEffect(() => {
    if (!shown) setHint(null);
  }, [shown]);

  const toggle = () => {
    if (!shown) setCycle((c) => c + 1);
    setShown(!shown);
  };
  const lines = text.split("\n");
  const multi = lines.length > 1;
  const wrap = layout === "wrap";
  let body;
  if (empty) {
    body = <span className="sg-secret-value__empty">Empty</span>;
  } else if (!shown) {
    body = (
      <span
        className="sg-secret-value__mask"
        role="img"
        aria-label={secretKey ? `${secretKey} is hidden` : "Hidden value"}
      />
    );
  } else {
    const shownText = wrap || !multi ? text : lines[0];
    body = (
      <span className="sg-secret-value__shown" key={`shown-${cycle}`}>
        <span className="sg-secret-value__text">
          <Tokens text={shownText} resolve={resolve} focusableRefs={wrap} onHint={setHint} hintId={hintId} />
        </span>
        {!wrap && multi && <span className="sg-secret-value__more">+{n(lines.length - 1, "line")}</span>}
        {timed && (
          <span className="sg-secret-value__timer" style={{ "--_t": `${revealTimeout}ms` }} aria-hidden="true" />
        )}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      className={cx("sg-secret-value", `sg-secret-value--${wrap ? "wrap" : "truncate"}`, className)}
      data-state={empty ? "empty" : shown ? "revealed" : "masked"}
      {...rest}
    >
      <span className="sg-secret-value__body">{body}</span>
      {(revealable || copyable) && (
        <span className="sg-secret-value__controls">
          {revealable && !empty && (
            <IconButton
              size="xs"
              icon={shown ? "eye-off" : "eye"}
              label={shown ? "Hide value" : "Reveal value"}
              pressed={!!shown}
              onClick={toggle}
            />
          )}
          {copyable && (
            <CopyButton
              size="xs"
              value={text}
              label="Copy value"
              className="sg-secret-value__copy"
              onCopied={(v) => {
                if (onCopied) onCopied(v);
              }}
            />
          )}
        </span>
      )}
      {hint && shown && (
        <RefHint anchor={hint.el} refKey={hint.key} resolved={resolve ? resolve(hint.key) : undefined} id={hintId} />
      )}
    </span>
  );
});
