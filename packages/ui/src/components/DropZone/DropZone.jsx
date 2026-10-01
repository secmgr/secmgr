import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { envName } from "../_lib/compare.js";
import { cx, Portal } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { EnvBadge } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

const MB = 1024 * 1024;
const TEXT_NAME = /(^|[./])env($|[.])|\.(txt|env|ini|conf|properties|toml|ya?ml|json|sh)$/i;
const TEXT_TYPE = /^text\/|json|yaml|toml|x-sh|x-env|javascript/;

function formatSize(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 2 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function checkEnvFile(file, maxSize = MB) {
  if (!file) return { ok: false, reason: "type", message: "Only text files up to 1 MB" };
  const texty =
    (file.type && TEXT_TYPE.test(file.type)) ||
    (!file.type && TEXT_NAME.test(file.name || "")) ||
    TEXT_NAME.test(file.name || "");
  if (!texty) return { ok: false, reason: "type", message: `${file.name || "This file"} is not a text file.` };
  if (file.size > maxSize)
    return { ok: false, reason: "size", message: `${file.name || "This file"} is ${formatSize(file.size)}.` };
  return { ok: true };
}

function hasFiles(e) {
  const t = e.dataTransfer?.types;
  return !!t && Array.prototype.indexOf.call(t, "Files") >= 0;
}

function dragLooksWrong(e) {
  const items = e.dataTransfer?.items;
  if (!items?.length) return false;
  if (items.length > 1) return true;
  const type = items[0].type || "";
  return !!type && !TEXT_TYPE.test(type);
}

function readText(file) {
  if (file.text) return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsText(file);
  });
}

export const DropZone = forwardRef(function DropZone(
  {
    variant = "inline",
    env,
    onFile,
    onText,
    onReject,
    maxSize = MB,
    state: forced,
    fixed = true,
    open: forcedOpen,
    pasteAnywhere = false,
    disabled = false,
    loading = false,
    loadingLabel,
    rejectMessage,
    className,
    ...rest
  },
  ref,
) {
  const [dragState, setDragState] = useState("idle");
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [focused, setFocused] = useState(false);
  const depth = useRef(0);
  const clearTimer = useRef(null);
  const zoneRef = useRef(null);
  const inputRef = useRef(null);
  const target = envName(env);

  const setRefs = (el) => {
    zoneRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const flashReject = useCallback((message) => {
    setDetail(message);
    setDragState("reject");
    setVisible(true);
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      setDragState("idle");
      setVisible(false);
      setDetail(null);
    }, 2400);
  }, []);

  const accept = useCallback(
    (files) => {
      const list = Array.from(files || []);
      if (list.length !== 1) {
        const res = { ok: false, reason: "multiple", message: "Drop one file at a time." };
        flashReject(res.message);
        if (onReject) onReject(list[0] || null, res.reason);
        return;
      }
      const file = list[0];
      const res = checkEnvFile(file, maxSize);
      if (!res.ok) {
        flashReject(res.message);
        if (onReject) onReject(file, res.reason);
        return;
      }
      setDragState("idle");
      setVisible(false);
      readText(file).then((text) => {
        if (onFile) onFile(file, text);
      });
    },
    [maxSize, onFile, onReject, flashReject],
  );

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  useEffect(() => {
    if (variant !== "overlay" || disabled || forced) return undefined;
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      clearTimeout(clearTimer.current);
      setDetail(null);
      setVisible(true);
      setDragState(dragLooksWrong(e) ? "reject" : "drag-over");
    };
    const over = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) {
        setVisible(false);
        setDragState("idle");
      }
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      accept(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [variant, disabled, forced, accept]);

  useEffect(() => {
    if (!pasteAnywhere || disabled || !onText) return undefined;
    const onPaste = (e) => {
      const t = e.target;
      if (t?.closest?.("input, textarea, [contenteditable='true']")) return;
      const text = e.clipboardData?.getData("text/plain");
      if (text && /^\s*(export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/m.test(text)) {
        e.preventDefault();
        onText(text);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteAnywhere, disabled, onText]);

  const inlineHandlers =
    variant === "inline" && !disabled && !forced
      ? {
          onDragEnter: (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            depth.current += 1;
            clearTimeout(clearTimer.current);
            setDetail(null);
            setDragState(dragLooksWrong(e) ? "reject" : "drag-over");
          },
          onDragOver: (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          },
          onDragLeave: (e) => {
            if (!hasFiles(e)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setDragState("idle");
          },
          onDrop: (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.stopPropagation();
            depth.current = 0;
            accept(e.dataTransfer.files);
          },
          onPaste: (e) => {
            const text = e.clipboardData?.getData("text/plain");
            if (text && onText) {
              e.preventDefault();
              onText(text);
            }
          },
        }
      : {};

  const state = forced || dragState;
  const rejectText = rejectMessage || "Only text files up to 1 MB";

  if (variant === "overlay") {
    const show = forcedOpen !== undefined ? forcedOpen : forced ? true : visible;
    if (!show) return null;
    const body = (
      <div
        ref={setRefs}
        className={cx("sg-drop-zone", "sg-drop-zone--overlay", !fixed && "sg-drop-zone--contained", className)}
        data-state={state}
        role="presentation"
        {...rest}
      >
        <div className="sg-drop-zone__scrim" aria-hidden="true" />
        <div className="sg-drop-zone__frame">
          <div className="sg-drop-zone__content" role="status" aria-live="assertive">
            <span className="sg-drop-zone__tile" aria-hidden="true">
              <Icon name={state === "reject" ? "file-x" : "file-text"} size={24} />
            </span>
            {state === "reject" ? (
              <>
                <span className="sg-drop-zone__title">{rejectText}</span>
                <span className="sg-drop-zone__sub">
                  {detail || "Drop a .env, .txt or .json file of 1 MB or less."}
                </span>
              </>
            ) : (
              <>
                <span className="sg-drop-zone__title">
                  <span>Drop .env to import into</span>
                  {target ? <EnvBadge env={env} /> : <span>this environment</span>}
                </span>
                <span className="sg-drop-zone__sub">We parse it first. Nothing is saved until you review.</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
    return fixed ? <Portal>{body}</Portal> : body;
  }

  return (
    <div
      ref={setRefs}
      className={cx("sg-drop-zone", "sg-drop-zone--inline", className)}
      data-state={disabled ? "disabled" : loading ? "loading" : state}
      tabIndex={disabled ? undefined : 0}
      role="group"
      aria-label={
        target
          ? `Import a .env into ${target}: drop a file, paste its contents, or choose a file`
          : "Import a .env: drop a file, paste its contents, or choose a file"
      }
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      onFocus={(e) => {
        if (e.target === e.currentTarget) setFocused(true);
      }}
      onBlur={(e) => {
        if (e.target === e.currentTarget) setFocused(false);
      }}
      {...inlineHandlers}
      {...rest}
    >
      <span className="sg-drop-zone__icon" aria-hidden="true">
        {loading ? (
          <Spinner size={20} label="Reading file" />
        ) : (
          <Icon name={state === "reject" ? "file-x" : state === "drag-over" ? "file-up" : "file-text"} size={20} />
        )}
      </span>
      <span className="sg-drop-zone__text" role="status" aria-live="polite">
        {loading ? (
          loadingLabel || "Reading file"
        ) : state === "reject" ? (
          rejectText
        ) : state === "drag-over" ? (
          target ? (
            `Drop to import into ${target}`
          ) : (
            "Drop to import"
          )
        ) : focused ? (
          <span className="sg-drop-zone__paste">
            Press <Kbd keys={["mod", "v"]} size="sm" /> to paste a .env
          </span>
        ) : (
          "Drag a .env file here, or paste its contents"
        )}
      </span>
      <span className="sg-drop-zone__hint">
        {state === "reject" && detail ? detail : "Text files up to 1 MB. Nothing is saved until you review."}
      </span>
      <Button
        size="sm"
        icon="upload"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        className="sg-drop-zone__choose"
      >
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".env,.txt,.json,.yaml,.yml,text/plain"
        className="sg-visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
});
