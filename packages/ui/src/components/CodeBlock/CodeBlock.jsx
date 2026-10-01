import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { copyText, cx, useControllable } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { Tabs } from "../Tabs/Tabs.jsx";
import { copyValue, highlight } from "./highlight.js";

export const CodeBlock = forwardRef(function CodeBlock(
  {
    code,
    tabs,
    language = "shell",
    title,
    copy = true,
    prompt = true,
    lineNumbers = false,
    highlightLines,
    wrap = false,
    tab,
    defaultTab,
    onTabChange,
    maxHeight,
    onCopy,
    className,
    ...rest
  },
  ref,
) {
  const [active, setActive] = useControllable(
    tab,
    defaultTab !== undefined ? defaultTab : tabs?.[0]?.label,
    onTabChange,
  );
  const current = tabs ? tabs.find((t) => t.label === active) || tabs[0] : null;
  const text = current ? current.code : code || "";
  const lang = current?.language || language;
  const lines = useMemo(() => highlight(text, lang, prompt), [text, lang, prompt]);
  const marked = useMemo(() => new Set(highlightLines || []), [highlightLines]);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    setCopied(false);
  }, [text]);

  const doCopy = async () => {
    const value = copyValue(text, lang);
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    if (onCopy) onCopy(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  const hasHeader = !!(tabs || title);
  const copyButton = copy ? (
    <IconButton
      icon={copied ? "check" : "copy"}
      label={copied ? "Copied" : tabs ? `Copy ${current.label}${lang === "shell" ? " command" : ""}` : "Copy code"}
      size="xs"
      onClick={doCopy}
      data-copied={copied || undefined}
      className="sg-code__copy"
    />
  ) : null;
  const digits = String(lines.length).length;

  return (
    <div
      ref={ref}
      className={cx(
        "sg-code",
        wrap && "sg-code--wrap",
        !hasHeader && "sg-code--bare",
        lines.length === 1 && "sg-code--single",
        className,
      )}
      style={{ "--_gutter": `${digits}ch` }}
      {...rest}
    >
      {hasHeader && (
        <div className="sg-code__header">
          {tabs ? (
            <Tabs
              size="sm"
              label={title || "Code examples"}
              items={tabs.map((t) => ({ value: t.label, label: t.label }))}
              value={current.label}
              onValueChange={setActive}
              className="sg-code__tabs"
            />
          ) : (
            <div className="sg-code__title">
              <Icon name="file-text" size={14} />
              <span className="sg-code__title-text">{title}</span>
            </div>
          )}
          {copyButton}
        </div>
      )}
      <div className="sg-code__scroll" style={{ maxHeight }}>
        <pre className="sg-code__pre" data-language={lang}>
          <code className="sg-code__code">
            {lines.map((ln, i) => (
              <span key={i} className="sg-code__line" data-highlighted={marked.has(i + 1) || undefined}>
                {lineNumbers && (
                  <span className="sg-code__num" aria-hidden="true">
                    {i + 1}
                  </span>
                )}
                <span className="sg-code__content">
                  {ln.prompt && (
                    <span className="sg-code__prompt" aria-hidden="true">
                      ${" "}
                    </span>
                  )}
                  {ln.tokens.length
                    ? ln.tokens.map((t, j) => (
                        <span key={j} className={`sg-code__t-${t[0]}`}>
                          {t[1]}
                        </span>
                      ))
                    : "​"}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
      {!hasHeader && copyButton}
      <span className="sg-visually-hidden" role="status">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
});
