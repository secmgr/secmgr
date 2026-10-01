import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MASK, parseDotenv } from "../_lib/secrets.js";
import { cx, n, Portal, useControllable } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";

export { parseDotenv };

const LINE = 22;
const PAD = 12;

function maskTokens(tokens, kind) {
  if (kind === "continuation") return [];
  const out = [];
  let masked = false;
  for (const t of tokens) {
    if (t.t === "value" || t.t === "ref" || t.t === "quote" || t.t === "error") {
      if (!masked) {
        out.push({ t: "mask", s: MASK });
        masked = true;
      }
      continue;
    }
    out.push(t);
  }
  return out;
}

function Line({ line, hidden }) {
  const tokens = hidden ? maskTokens(line.tokens, line.kind) : line.tokens;
  const level = line.issue ? line.issue.level : undefined;
  return (
    <div className="sg-env-editor__line" data-level={level} data-kind={line.kind}>
      {tokens.map((t, i) => (
        <span key={i} className={`sg-env-editor__t sg-env-editor__t--${t.t}`}>
          {t.s}
        </span>
      ))}
      {"\n"}
    </div>
  );
}

function IssueCard({ issue, x, y }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
    const top = y + r.height + 8 > window.innerHeight ? y - r.height - LINE - 4 : y + 4;
    if (!pos || pos.left !== left || pos.top !== top) setPos({ left, top });
  });
  return (
    <Portal>
      <div
        ref={ref}
        role="tooltip"
        className="sg-env-editor__issue"
        data-level={issue.level}
        style={{ left: pos ? pos.left : -9999, top: pos ? pos.top : -9999, visibility: pos ? "visible" : "hidden" }}
      >
        <Icon name={issue.level === "error" ? "circle-alert" : "triangle-alert"} size={14} />
        <span>
          <span className="sg-env-editor__issue-line">Line {issue.line}</span>
          {issue.message}
        </span>
      </div>
    </Portal>
  );
}

export const EnvEditor = forwardRef(function EnvEditor(
  {
    value,
    defaultValue = "",
    onValueChange,
    valuesHidden,
    defaultValuesHidden = false,
    onValuesHiddenChange,
    readOnly = false,
    env,
    placeholder = "# Paste a .env file or type KEY=value",
    minLines = 8,
    maxHeight = 480,
    onParsed,
    "aria-label": ariaLabel,
    className,
    style,
    ...rest
  },
  ref,
) {
  const [text, setText] = useControllable(value, defaultValue, onValueChange);
  const [hidden, setHidden] = useControllable(valuesHidden, defaultValuesHidden, onValuesHiddenChange);
  const src = text == null ? "" : String(text);
  const parsed = useMemo(() => parseDotenv(src), [src]);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(null);
  const taRef = useRef(null);
  const bodyRef = useRef(null);
  const scrollRef = useRef(null);

  const setTa = (el) => {
    taRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  useEffect(() => {
    if (onParsed) onParsed(parsed);
  }, [parsed]);

  const errors = parsed.lines.filter((l) => l.issue && l.issue.level === "error").length;
  const warnings = parsed.lines.filter((l) => l.issue && l.issue.level === "warning").length;
  const issues = errors + warnings;

  const syncCaret = () => {
    const el = taRef.current;
    if (!el) return;
    const pos = el.selectionStart || 0;
    const before = el.value.slice(0, pos);
    const line = before.split("\n").length;
    const col = pos - before.lastIndexOf("\n");
    setCaret((c) => (c.line === line && c.col === col ? c : { line, col }));
  };

  const goToLine = (ln) => {
    const el = taRef.current;
    const lines = src.split(/\r?\n/);
    let pos = 0;
    for (let i = 0; i < ln - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    if (el) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(pos, pos);
    }
    setCaret({ line: ln, col: 1 });
    const sc = scrollRef.current;
    if (sc) {
      const y = PAD + (ln - 1) * LINE;
      if (y < sc.scrollTop || y + LINE > sc.scrollTop + sc.clientHeight)
        sc.scrollTop = Math.max(0, y - sc.clientHeight / 3);
      sc.scrollLeft = 0;
    }
  };

  const nextIssue = () => {
    const list = parsed.lines.filter((l) => l.issue).map((l) => l.n);
    if (!list.length) return;
    const after = list.find((l) => l > caret.line) || list[0];
    goToLine(after);
  };

  const lineAt = (clientY) => {
    const body = bodyRef.current;
    if (!body) return null;
    const idx = Math.floor((clientY - body.getBoundingClientRect().top - PAD) / LINE);
    return idx >= 0 && idx < parsed.lines.length ? parsed.lines[idx] : null;
  };

  const onHoverMove = (e) => {
    const line = lineAt(e.clientY);
    if (!line?.issue) {
      if (hover) setHover(null);
      return;
    }
    const body = bodyRef.current.getBoundingClientRect();
    const y = body.top + PAD + line.n * LINE;
    if (!hover || hover.line !== line.n)
      setHover({ line: line.n, level: line.issue.level, message: line.issue.message, x: e.clientX - 12, y });
  };

  const bodyMin = Math.max(minLines, 1) * LINE + PAD * 2;
  const envName = env && (env.name || env);
  const label = ariaLabel || (envName ? `Raw .env for ${envName}` : "Raw .env");

  return (
    <div
      className={cx("sg-env-editor", className)}
      style={style}
      data-hidden={hidden || undefined}
      data-focused={focused || undefined}
      data-readonly={readOnly || undefined}
      {...rest}
    >
      {hidden && (
        <div className="sg-env-editor__banner">
          <Icon name="eye-off" size={14} />
          <span className="sg-env-editor__banner-text">Values are hidden. The editor is read only.</span>
          <Button size="sm" icon="eye" onClick={() => setHidden(false)}>
            Reveal values to edit
          </Button>
        </div>
      )}
      <div className="sg-env-editor__scroll" ref={scrollRef} style={{ maxHeight }}>
        <div className="sg-env-editor__body" ref={bodyRef} style={{ minHeight: bodyMin }}>
          {focused && !hidden && (
            <div
              className="sg-env-editor__current"
              style={{ transform: `translateY(${(caret.line - 1) * LINE}px)` }}
              aria-hidden="true"
            />
          )}
          <div
            className="sg-env-editor__gutter"
            aria-hidden="true"
            onMouseMove={onHoverMove}
            onMouseLeave={() => setHover(null)}
          >
            {parsed.lines.map((l) => (
              <div
                key={l.n}
                className="sg-env-editor__ln"
                data-level={l.issue ? l.issue.level : undefined}
                data-current={focused && !hidden && l.n === caret.line ? "" : undefined}
              >
                {l.n}
              </div>
            ))}
          </div>
          <div className="sg-env-editor__code" onMouseMove={onHoverMove} onMouseLeave={() => setHover(null)}>
            {!hidden && (
              <textarea
                ref={setTa}
                className="sg-env-editor__input"
                value={src}
                placeholder={placeholder}
                readOnly={readOnly}
                wrap="off"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                data-1p-ignore="true"
                data-lpignore="true"
                aria-label={label}
                aria-invalid={errors > 0 || undefined}
                onChange={(e) => {
                  setText(e.target.value);
                }}
                onSelect={syncCaret}
                onKeyUp={syncCaret}
                onClick={syncCaret}
                onFocus={() => {
                  setFocused(true);
                  syncCaret();
                }}
                onBlur={() => setFocused(false)}
              />
            )}
            <pre
              className="sg-env-editor__pre"
              aria-hidden={hidden ? undefined : "true"}
              aria-label={hidden ? `${label}, values hidden` : undefined}
            >
              {parsed.lines.map((l) => (
                <Line key={l.n} line={l} hidden={hidden} />
              ))}
            </pre>
          </div>
        </div>
      </div>
      <div className="sg-env-editor__status">
        <span className="sg-env-editor__stat">{n(parsed.keys, "key")}</span>
        <span className="sg-env-editor__dot" aria-hidden="true">
          ·
        </span>
        {issues ? (
          <button
            type="button"
            className="sg-env-editor__issues"
            data-level={errors ? "error" : "warning"}
            onClick={nextIssue}
            title="Go to the next issue"
          >
            <Icon name={errors ? "circle-alert" : "triangle-alert"} size={14} />
            {n(issues, "issue")}
          </button>
        ) : (
          <span className="sg-env-editor__stat sg-env-editor__ok">
            <Icon name="check" size={14} />
            No issues
          </span>
        )}
        {!hidden && (
          <>
            <span className="sg-env-editor__dot" aria-hidden="true">
              ·
            </span>
            <span className="sg-env-editor__stat">
              Ln {caret.line}, Col {caret.col}
            </span>
          </>
        )}
        <span className="sg-env-editor__grow" />
        {readOnly && !hidden && <span className="sg-env-editor__stat">Read only</span>}
        {hidden && <span className="sg-env-editor__stat">Values hidden</span>}
        <span className="sg-env-editor__stat sg-env-editor__format">Parsed as dotenv</span>
        {!hidden && (
          <IconButton
            size="xs"
            icon="eye-off"
            label="Hide values"
            onClick={() => {
              setHidden(true);
              setHover(null);
            }}
          />
        )}
      </div>
      {hover && <IssueCard issue={hover} x={hover.x} y={hover.y} />}
    </div>
  );
});
