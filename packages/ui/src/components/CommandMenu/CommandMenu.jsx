import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayerProvider,
  OverlayPortal,
  useFocusScope,
  useLayer,
  useLayerZ,
  useOpenState,
  usePresence,
  useStableId,
} from "../_lib/overlay.js";
import { cx } from "../_lib/util.js";
import { Icon } from "../Icon/Icon.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";
import { Spinner } from "../Spinner/Spinner.jsx";

const BOUNDARY = /[\s_\-/.:]/;

export function matchScore(text, query, strict) {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return { score: 1, indices: [] };
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  const at = t.indexOf(q);
  if (at >= 0) {
    const edge = at === 0 || BOUNDARY.test(t[at - 1]);
    const indices = [];
    for (let i = at; i < at + q.length; i++) indices.push(i);
    return { score: 1000 - at + (edge ? 200 : 0) + (at === 0 ? 100 : 0) - t.length * 0.1, indices };
  }
  if (strict) return null;
  const indices = [];
  let pos = 0;
  let gaps = 0;
  let edges = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    let found = -1;
    for (let k = pos; k < t.length; k++) {
      if (t[k] === ch) {
        found = k;
        break;
      }
    }
    if (found < 0) return null;
    if (!indices.length && found > 0 && !BOUNDARY.test(t[found - 1])) return null;
    gaps += found - pos;
    if (found === 0 || BOUNDARY.test(t[found - 1])) edges++;
    indices.push(found);
    pos = found + 1;
  }
  return { score: 500 - gaps * 3 + edges * 25 - t.length * 0.1, indices };
}

function scoreItem(item, q) {
  const label = typeof item.label === "string" ? item.label : item.textValue || "";
  const own = matchScore(label, q);
  if (own) return own;
  const extra = [item.hint, ...(item.keywords || [])].filter((x) => typeof x === "string").join(" ");
  const other = extra ? matchScore(extra, q, true) : null;
  return other ? { score: other.score * 0.5, indices: [] } : null;
}

function Highlight({ text, indices }) {
  if (typeof text !== "string" || !indices || !indices.length) return text;
  const set = new Set(indices);
  const out = [];
  let buf = "";
  let on = false;
  for (let i = 0; i <= text.length; i++) {
    const hit = i < text.length && set.has(i);
    if (i === text.length || hit !== on) {
      if (buf)
        out.push(
          on ? (
            <mark key={i} className="sg-command__match">
              {buf}
            </mark>
          ) : (
            <Fragment key={i}>{buf}</Fragment>
          ),
        );
      buf = "";
      on = hit;
    }
    if (i < text.length) buf += text[i];
  }
  return out;
}

function toGroups(source) {
  if (!source) return [];
  if (source.groups) return source.groups;
  if (source.items) return [{ items: source.items }];
  return [];
}

export function CommandMenu({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Search projects, secrets and actions",
  groups = [],
  recent,
  loading = false,
  emptyHint = "Try a key such as DATABASE_URL, a project such as lumen-api, or an action such as import.",
  defaultQuery = "",
  onQueryChange,
  hotkey = ["mod", "k"],
  initialFocus,
  container,
  label = "Command menu",
  className,
  ...rest
}) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [query, setQueryState] = useState(defaultQuery);
  const [pages, setPages] = useState([]);
  const [active, setActive] = useState(0);
  const layerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const base = useStableId("sg-command");
  const presence = usePresence(open, 140);
  const z = useLayerZ("var(--z-command)");
  const pointer = useRef({ x: -1, y: -1 });

  const setQuery = useCallback(
    (v) => {
      setQueryState(v);
      setActive(0);
      if (onQueryChange) onQueryChange(v);
    },
    [onQueryChange],
  );

  useEffect(() => {
    if (open) {
      setQueryState(defaultQuery);
      setPages([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!hotkey) return undefined;
    const keys = (Array.isArray(hotkey) ? hotkey : [hotkey]).map((k) => String(k).toLowerCase());
    const main = keys.filter((k) => !["mod", "cmd", "ctrl", "shift", "alt"].includes(k))[0];
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const onKey = (e) => {
      if (!main || e.key.toLowerCase() !== main) return;
      const wantMod = keys.includes("mod");
      if (wantMod && !(mac ? e.metaKey : e.ctrlKey)) return;
      if (keys.includes("shift") !== e.shiftKey) return;
      e.preventDefault();
      setOpen(!open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey && String(hotkey), open, setOpen]);

  const page = pages[pages.length - 1];
  const q = query.trim();

  const view = useMemo(() => {
    const srcGroups = page ? toGroups(page) : groups;
    const out = [];
    if (!page && !q && recent?.length)
      out.push({ label: "Recent", items: recent.map((item) => ({ item, match: null })) });
    for (const g of srcGroups) {
      const items = [];
      for (const item of g.items || []) {
        if (!q) {
          items.push({ item, match: null });
          continue;
        }
        const m = scoreItem(item, q);
        if (m) items.push({ item, match: m });
      }
      if (q) items.sort((a, b) => b.match.score - a.match.score);
      if (items.length) out.push({ label: g.label, items, best: q ? items[0].match.score : 0 });
    }
    if (q) out.sort((a, b) => b.best - a.best);
    let n = 0;
    for (const g of out) for (const entry of g.items) entry.index = n++;
    return { groups: out, count: n };
  }, [page, groups, recent, q]);

  const optionId = (i) => `${base}-option-${i}`;
  const activeIndex = view.count ? Math.min(active, view.count - 1) : -1;

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (el?.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, view]);

  const flat = useMemo(() => {
    const list = [];
    for (const g of view.groups) for (const e of g.items) list.push(e.item);
    return list;
  }, [view]);

  const close = useCallback(() => setOpen(false), [setOpen]);
  const pop = useCallback(() => {
    setPages((p) => p.slice(0, -1));
    setQueryState("");
    setActive(0);
  }, []);

  const select = (item) => {
    if (!item || item.disabled) return;
    if (item.page) {
      const next = item.page;
      setPages((p) =>
        p.concat([
          {
            title: next.title || (typeof item.label === "string" ? item.label : ""),
            groups: next.groups,
            items: next.items,
            placeholder: next.placeholder,
          },
        ]),
      );
      setQueryState("");
      setActive(0);
      if (item.onSelect) item.onSelect(item);
      if (inputRef.current) inputRef.current.focus({ preventScroll: true });
      return;
    }
    if (item.onSelect) item.onSelect(item);
    close();
  };

  useLayer(open, {
    contains: (t) => !!layerRef.current?.contains(t),
    onEscape: () => {
      if (pages.length) pop();
      else close();
    },
  });
  useFocusScope(open, panelRef, {
    trap: true,
    initialFocus:
      initialFocus === false ? false : initialFocus && initialFocus.current !== undefined ? initialFocus : inputRef,
  });

  const onKeyDown = (e) => {
    if (e.nativeEvent?.isComposing) return;
    const n = view.count;
    const move = (d) => {
      e.preventDefault();
      if (n) setActive((activeIndex + d + n) % n);
    };
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) return move(1);
    if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) return move(-1);
    if (e.key === "Home" && n) {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End" && n) {
      e.preventDefault();
      setActive(n - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      select(flat[activeIndex]);
      return;
    }
    if (e.key === "Backspace" && !query && pages.length) {
      e.preventDefault();
      pop();
    }
  };

  const onItemMove = (i) => (e) => {
    if (e.clientX === pointer.current.x && e.clientY === pointer.current.y) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (i !== activeIndex) setActive(i);
  };

  const listId = `${base}-list`;
  const hasResults = view.count > 0;

  return (
    <>
      {presence.mounted && (
        <OverlayPortal container={container}>
          <LayerProvider z={z}>
            <div ref={layerRef} className="sg-command-layer" data-state={presence.state} style={{ zIndex: z }}>
              <div className="sg-command-overlay" data-state={presence.state} aria-hidden="true" onClick={close} />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                data-state={presence.state}
                className={cx("sg-command", className)}
                {...rest}
              >
                <div className="sg-command__search">
                  <Icon name="search" size={16} className="sg-command__search-icon" />
                  {pages.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      tabIndex={-1}
                      className="sg-command__chip"
                      onClick={() => {
                        setPages((all) => all.slice(0, i));
                        setQueryState("");
                        setActive(0);
                        if (inputRef.current) inputRef.current.focus({ preventScroll: true });
                      }}
                      aria-label={`Back from ${p.title}`}
                    >
                      {p.title}
                    </button>
                  ))}
                  <input
                    ref={inputRef}
                    className="sg-command__input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={page?.placeholder || placeholder}
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {loading && <Spinner size={16} label="Searching" className="sg-command__spinner" />}
                </div>
                <div
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  aria-label={page ? page.title : label}
                  className="sg-command__list"
                >
                  {view.groups.map((g, gi) => {
                    const headId = `${base}-group-${gi}`;
                    return (
                      <div
                        key={gi}
                        role={g.label ? "group" : "presentation"}
                        aria-labelledby={g.label ? headId : undefined}
                        className="sg-command__group"
                      >
                        {g.label && (
                          <div id={headId} className="sg-command__heading" aria-hidden="true">
                            {g.label}
                          </div>
                        )}
                        {g.items.map(({ item, match, index }) => (
                          <div
                            key={item.id || index}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === activeIndex}
                            aria-disabled={item.disabled || undefined}
                            data-index={index}
                            className={cx("sg-command__item", item.disabled && "sg-command__item--disabled")}
                            onPointerMove={onItemMove(index)}
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => select(item)}
                          >
                            {item.icon != null && (
                              <span className="sg-command__icon" aria-hidden="true">
                                {typeof item.icon === "string" ? <Icon name={item.icon} size={16} /> : item.icon}
                              </span>
                            )}
                            <span className="sg-command__text">
                              <span className={cx("sg-command__label", item.mono && "sg-command__label--mono")}>
                                <Highlight text={item.label} indices={match?.indices} />
                              </span>
                              {item.hint && <span className="sg-command__hint">{item.hint}</span>}
                            </span>
                            {item.kbd && <Kbd keys={item.kbd} size="sm" className="sg-command__kbd" />}
                            {item.page && <Icon name="chevron-right" size={16} className="sg-command__chevron" />}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {!hasResults && (
                    <div className="sg-command__empty" role="presentation">
                      {loading ? (
                        <p className="sg-command__empty-title">
                          <Spinner size={14} label="Searching" /> Searching for "{q}"
                        </p>
                      ) : q ? (
                        <>
                          <p className="sg-command__empty-title">No results for "{q}"</p>
                          {emptyHint && <p className="sg-command__empty-hint">{emptyHint}</p>}
                        </>
                      ) : (
                        <p className="sg-command__empty-title">Nothing here yet</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="sg-command__footer" aria-hidden="true">
                  <span className="sg-command__hint-key">
                    <Kbd keys={["up", "down"]} size="sm" /> to navigate
                  </span>
                  <span className="sg-command__hint-key">
                    <Kbd keys="enter" size="sm" /> to select
                  </span>
                  <span className="sg-command__hint-key">
                    <Kbd keys="esc" size="sm" /> {pages.length ? "to go back" : "to close"}
                  </span>
                </div>
              </div>
            </div>
          </LayerProvider>
        </OverlayPortal>
      )}
      <span className="sg-visually-hidden" role="status" aria-live="polite">
        {open && q
          ? hasResults
            ? `${view.count} ${view.count === 1 ? "result" : "results"}`
            : loading
              ? "Searching"
              : `No results for ${q}`
          : ""}
      </span>
    </>
  );
}
