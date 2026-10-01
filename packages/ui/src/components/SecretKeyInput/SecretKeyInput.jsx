import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { looksLikeDotenv, normalizeKey, parsePair, validateKey } from "../_lib/secrets.js";
import { cx, useControllable } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";

export { normalizeKey, validateKey };

function describeChange(raw, next) {
  const dropped = [];
  for (const ch of raw) {
    if (!/[A-Za-z0-9_ .-]/.test(ch) && dropped.indexOf(ch) < 0) dropped.push(ch);
  }
  if (dropped.length) return `Dropped ${dropped.map((c) => `"${c}"`).join(" ")}. Keys use A to Z, 0 to 9 and _.`;
  return `Converted to ${next}`;
}

export const SecretKeyInput = forwardRef(function SecretKeyInput(
  {
    value,
    defaultValue = "",
    onValueChange,
    existingKeys = [],
    env,
    original,
    error,
    showErrors = false,
    onErrorChange,
    onPasteEnv,
    onPastePair,
    invalid = false,
    disabled = false,
    readOnly = false,
    size = "md",
    placeholder = "DATABASE_URL",
    messagePlacement = "inline",
    hintDuration = 2400,
    className,
    style,
    id,
    onBlur,
    ...rest
  },
  ref,
) {
  const [val, setVal] = useControllable(value, defaultValue, onValueChange);
  const text = val == null ? "" : String(val);
  const [touched, setTouched] = useState(false);
  const [hint, setHint] = useState(null);
  const field = useRef(null);
  const pendingCaret = useRef(null);
  const msgId = useId();

  const setRefs = (el) => {
    field.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  useLayoutEffect(() => {
    const c = pendingCaret.current;
    if (c == null || !field.current) return;
    pendingCaret.current = null;
    try {
      field.current.setSelectionRange(c, c);
    } catch (_e) {}
  });

  useEffect(() => {
    if (!hint) return undefined;
    const t = setTimeout(() => setHint(null), hintDuration);
    return () => clearTimeout(t);
  }, [hint, hintDuration]);

  const found = error ? { code: "custom", message: error } : validateKey(text, { existingKeys, env, original });
  const visible = found && (found.code !== "empty" || touched || showErrors) ? found : null;
  const message = visible ? visible.message : null;

  const lastMessage = useRef(undefined);
  useEffect(() => {
    if (lastMessage.current === message) return;
    lastMessage.current = message;
    if (onErrorChange) onErrorChange(message);
  }, [message]);

  const handleChange = (e) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart == null ? raw.length : e.target.selectionStart;
    const next = normalizeKey(raw);
    if (next !== raw) {
      pendingCaret.current = normalizeKey(raw.slice(0, caret)).length;
      setHint({ text: describeChange(raw, next), at: Date.now() });
    }
    setVal(next);
  };

  const handlePaste = (e) => {
    const t = e.clipboardData?.getData("text/plain");
    if (!t) return;
    if (onPasteEnv) {
      const parsed = looksLikeDotenv(t);
      if (parsed) {
        e.preventDefault();
        onPasteEnv(t, parsed);
        return;
      }
    }
    if (onPastePair && t.indexOf("=") > 0) {
      const pair = parsePair(t);
      if (pair) {
        e.preventDefault();
        const k = normalizeKey(pair.key);
        setVal(k);
        if (k !== pair.key) setHint({ text: `Converted to ${k}`, at: Date.now() });
        onPastePair({ key: k, value: pair.value });
      }
    }
  };

  const showHint = !message && hint;
  const bad = invalid || !!message;
  return (
    <div className={cx("sg-secret-key-input", `sg-secret-key-input--${messagePlacement}`, className)} style={style}>
      <div
        className={cx("sg-secret-field", `sg-secret-field--${size}`)}
        data-invalid={bad || undefined}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
      >
        <input
          ref={setRefs}
          id={id}
          type="text"
          className="sg-secret-field__input sg-secret-field__input--key"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          data-1p-ignore="true"
          data-lpignore="true"
          aria-invalid={bad || undefined}
          aria-describedby={message || showHint ? msgId : undefined}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={(e) => {
            setTouched(true);
            if (onBlur) onBlur(e);
          }}
          {...rest}
        />
      </div>
      <div className="sg-secret-key-input__slot" aria-live="polite">
        {message ? (
          <span id={msgId} className="sg-secret-key-input__message" data-tone="danger">
            <Icon name="circle-alert" size={14} />
            <span>{message}</span>
          </span>
        ) : showHint ? (
          <span id={msgId} className="sg-secret-key-input__message" data-tone="hint">
            <Icon name="sparkles" size={14} />
            <span>{hint.text}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
});
