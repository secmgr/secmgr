import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import { generateSecretValue } from "../_lib/secrets.js";
import { cx, Portal, useControllable } from "../_lib/util.js";
import { IconButton } from "../IconButton/IconButton.jsx";

export { generateSecretValue };

let measureCtx = null;
function charWidth(el) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  const cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return measureCtx.measureText("M").width;
}

function rankKeys(keys, q) {
  const list = [];
  for (const k of keys) {
    const name = typeof k === "string" ? k : k?.key;
    if (!name) continue;
    const at = name.indexOf(q);
    if (at < 0) continue;
    list.push({ name, score: at === 0 ? 0 : 1 });
  }
  list.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return list.slice(0, 7).map((x) => x.name);
}

export const SecretInput = forwardRef(function SecretInput(
  {
    value,
    defaultValue = "",
    onValueChange,
    revealed,
    defaultRevealed = false,
    onRevealedChange,
    multiline,
    defaultMultiline = false,
    onMultilineChange,
    keys = [],
    invalid = false,
    disabled = false,
    readOnly = false,
    size = "md",
    placeholder = "Value",
    maxRows = 8,
    className,
    style,
    id,
    onKeyDown,
    onBlur,
    ...rest
  },
  ref,
) {
  const [val, setVal] = useControllable(value, defaultValue, onValueChange);
  const [shown, setShown] = useControllable(revealed, defaultRevealed, onRevealedChange);
  const [mlPref, setMlPref] = useControllable(multiline, defaultMultiline, onMultilineChange);
  const text = val == null ? "" : String(val);
  const hasBreaks = text.indexOf("\n") >= 0;
  const multi = !!mlPref || hasBreaks;
  const [suggest, setSuggest] = useState(null);
  const field = useRef(null);
  const pendingSel = useRef(null);
  const listId = useId();
  const inert = disabled || readOnly;

  const setRefs = (el) => {
    field.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  useLayoutEffect(() => {
    const el = field.current;
    if (!el || !multi) return;
    el.style.height = "auto";
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || 20;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const max = lh * maxRows + pad;
    const min = lh * 3 + pad;
    el.style.height = `${Math.max(min, Math.min(max, el.scrollHeight))}px`;
  }, [text, multi, maxRows]);

  useLayoutEffect(() => {
    const sel = pendingSel.current;
    const el = field.current;
    if (!sel || !el) return;
    pendingSel.current = null;
    el.focus({ preventScroll: true });
    try {
      el.setSelectionRange(sel[0], sel[1]);
    } catch (_e) {}
  });

  const keyList = keys;

  const updateSuggest = (el) => {
    if (!el || !keyList.length || inert) {
      if (suggest) setSuggest(null);
      return;
    }
    const caret = el.selectionStart;
    if (caret == null || caret !== el.selectionEnd) {
      if (suggest) setSuggest(null);
      return;
    }
    const before = el.value.slice(0, caret);
    const m = /\$\{([A-Za-z0-9_]*)$/.exec(before);
    if (!m) {
      if (suggest) setSuggest(null);
      return;
    }
    const q = m[1].toUpperCase();
    const items = rankKeys(keyList, q);
    if (!items.length) {
      if (suggest) setSuggest(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const cw = charWidth(el);
    const lineStart = before.lastIndexOf("\n") + 1;
    const col = m.index - lineStart;
    const row = lineStart ? before.slice(0, lineStart).split("\n").length - 1 : 0;
    const lh = parseFloat(cs.lineHeight) || 20;
    const left = rect.left + parseFloat(cs.paddingLeft) + col * cw - el.scrollLeft - 8;
    const top = multi ? rect.top + parseFloat(cs.paddingTop) + (row + 1) * lh - el.scrollTop + 6 : rect.bottom + 6;
    const prevIndex = suggest && suggest.q === q ? suggest.index : 0;
    setSuggest({ q, start: m.index, caret, items, index: Math.min(prevIndex, items.length - 1), left, top });
  };

  const insert = (name) => {
    const el = field.current;
    if (!el || !suggest) return;
    const after = text.slice(suggest.caret);
    const closing = after[0] === "}" ? "" : "}";
    const next = `${text.slice(0, suggest.start)}\${${name}${closing}${after}`;
    const caret = suggest.start + name.length + 3;
    setVal(next);
    setSuggest(null);
    pendingSel.current = [caret, caret];
  };

  const handleKeyDown = (e) => {
    if (suggest) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setSuggest((s) => ({ ...s, index: (s.index + d + s.items.length) % s.items.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        insert(suggest.items[suggest.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSuggest(null);
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const toggleMulti = () => {
    const el = field.current;
    pendingSel.current = el ? [el.selectionStart || 0, el.selectionEnd || 0] : null;
    setMlPref(!multi);
  };

  const Field = multi ? "textarea" : "input";
  const active = suggest ? `${listId}-opt-${suggest.index}` : undefined;
  const fieldProps = {
    ref: setRefs,
    id,
    className: cx("sg-secret-field__input", { "sg-secret-field__input--masked": !shown }),
    value: text,
    placeholder,
    disabled,
    readOnly,
    spellCheck: false,
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    "data-1p-ignore": "true",
    "data-lpignore": "true",
    "aria-invalid": invalid || undefined,
    "aria-autocomplete": keyList.length ? "list" : undefined,
    "aria-expanded": keyList.length ? !!suggest : undefined,
    "aria-controls": suggest ? listId : undefined,
    "aria-activedescendant": active,
    onChange: (e) => {
      setVal(e.target.value);
    },
    onSelect: (e) => updateSuggest(e.currentTarget),
    onKeyDown: handleKeyDown,
    onBlur: (e) => {
      setSuggest(null);
      if (onBlur) onBlur(e);
    },
    ...rest,
  };
  if (multi) {
    fieldProps.rows = 3;
    fieldProps.wrap = "off";
  } else fieldProps.type = "text";

  return (
    <div
      className={cx(
        "sg-secret-field",
        "sg-secret-input",
        `sg-secret-field--${size}`,
        { "sg-secret-field--multiline": multi },
        className,
      )}
      style={style}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <Field {...fieldProps} />
      <div className="sg-secret-field__tools">
        <IconButton
          size="xs"
          icon="wrap-text"
          label={multi ? "Single line" : "Multiline value"}
          title={hasBreaks ? "Remove the line breaks to use a single line" : multi ? "Single line" : "Multiline value"}
          pressed={multi}
          disabled={disabled || hasBreaks}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleMulti}
          tabIndex={-1}
        />
        <IconButton
          size="xs"
          icon={shown ? "eye-off" : "eye"}
          label={shown ? "Hide value" : "Reveal value"}
          pressed={!!shown}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShown(!shown)}
          tabIndex={-1}
        />
      </div>
      {suggest && (
        <Portal>
          <div
            id={listId}
            role="listbox"
            aria-label="Reference a key"
            className="sg-secret-input__suggest"
            style={{ top: suggest.top, left: Math.max(8, Math.min(suggest.left, window.innerWidth - 248)) }}
          >
            <div className="sg-secret-input__suggest-head">Reference a key</div>
            {suggest.items.map((name, i) => (
              <div
                key={name}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === suggest.index}
                className="sg-secret-input__option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(name);
                }}
                onMouseEnter={() => setSuggest((s) => ({ ...s, index: i }))}
              >
                <span className="sg-secret-input__option-brace">{"${"}</span>
                <span className="sg-secret-input__option-key">{name}</span>
                <span className="sg-secret-input__option-brace">{"}"}</span>
              </div>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
});
