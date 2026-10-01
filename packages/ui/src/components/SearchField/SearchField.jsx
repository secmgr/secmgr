import { forwardRef, useEffect, useRef } from "react";
import { isEditableTarget, setNativeValue, useMergedRef, useValueState } from "../_lib/inputs.js";
import { cx, n } from "../_lib/util.js";
import { Input } from "../Input/Input.jsx";

export const SearchField = forwardRef(function SearchField(
  {
    value,
    defaultValue,
    onValueChange,
    onSearch,
    debounce = 150,
    hotkey = "/",
    count,
    total,
    noun = "result",
    resultLabel,
    placeholder = "Search",
    size = "md",
    loading = false,
    clearLabel = "Clear search",
    onClear,
    onKeyDown,
    className,
    style,
    ...rest
  },
  ref,
) {
  const inner = useRef(null);
  const setRef = useMergedRef(inner, ref);
  const [current, setInner, controlled] = useValueState(value, defaultValue);
  const timer = useRef(null);
  const searchRef = useRef(onSearch);
  searchRef.current = onSearch;

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!hotkey) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key !== hotkey) return;
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      const el = inner.current;
      if (!el || el.disabled || el.offsetParent === null) return;
      e.preventDefault();
      el.focus();
      el.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const schedule = (q) => {
    clearTimeout(timer.current);
    if (!searchRef.current) return;
    if (!debounce) {
      searchRef.current(q);
      return;
    }
    timer.current = setTimeout(() => searchRef.current?.(q), debounce);
  };
  const flush = (q) => {
    clearTimeout(timer.current);
    if (searchRef.current) searchRef.current(q);
  };
  const handleValue = (v) => {
    if (!controlled) setInner(v);
    if (onValueChange) onValueChange(v);
    schedule(v);
  };
  const handleKey = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented) return;
    if (e.key === "Escape") {
      if (current) {
        e.preventDefault();
        e.stopPropagation();
        setNativeValue(inner.current, "");
        flush("");
        if (onClear) onClear();
      } else {
        inner.current.blur();
      }
    } else if (e.key === "Enter") {
      flush(current);
    }
  };

  const hasQuery = current.trim() !== "";
  let summary = null;
  if (hasQuery && resultLabel != null) summary = resultLabel;
  else if (hasQuery && count != null)
    summary = total != null ? `${count.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}` : n(count, noun);
  const spoken =
    hasQuery && count != null
      ? total != null
        ? `${count} of ${n(total, noun)} match`
        : `${n(count, noun)} found`
      : "";

  return (
    <>
      <Input
        ref={setRef}
        type="search"
        size={size}
        icon="search"
        kbd={hotkey || undefined}
        clearable
        clearLabel={clearLabel}
        onClear={() => {
          flush("");
          if (onClear) onClear();
        }}
        loading={loading}
        loadingLabel="Searching"
        placeholder={placeholder}
        value={current}
        onValueChange={handleValue}
        onKeyDown={handleKey}
        suffix={
          summary != null ? (
            <span className="sg-search-field__count" aria-hidden="true">
              {summary}
            </span>
          ) : undefined
        }
        className={cx("sg-search-field", className)}
        style={style}
        autoComplete="off"
        spellCheck={false}
        {...rest}
      />
      <span className="sg-visually-hidden" role="status">
        {spoken}
      </span>
    </>
  );
});
