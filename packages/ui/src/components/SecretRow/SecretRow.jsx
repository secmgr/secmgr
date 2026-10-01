import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { firstName, formatWhen, groupSecrets, isTextField, validateKey } from "../_lib/secrets.js";
import { copyText, cx, n, useControllable } from "../_lib/util.js";
import { Badge } from "../Badge/Badge.jsx";
import { Button } from "../Button/Button.jsx";
import { Checkbox } from "../Checkbox/Checkbox.jsx";
import { CopyButton } from "../CopyButton/CopyButton.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";
import { SecretInput } from "../SecretInput/SecretInput.jsx";
import { SecretKeyInput } from "../SecretKeyInput/SecretKeyInput.jsx";
import { SecretValue } from "../SecretValue/SecretValue.jsx";
import { Tooltip } from "../Tooltip/Tooltip.jsx";

const TableContext = createContext(null);

function rowIdOf(secret) {
  return secret.id != null ? String(secret.id) : String(secret.key);
}

function StatusBadge({ status }) {
  if (status === "added")
    return (
      <Badge tone="success" variant="outline" className="sg-secret-row__status">
        New
      </Badge>
    );
  if (status === "modified")
    return (
      <Badge tone="warning" variant="outline" className="sg-secret-row__status">
        Edited
      </Badge>
    );
  if (status === "deleted") return <span className="sg-visually-hidden">Deleted, not saved yet</span>;
  return null;
}

function rotationTitle(r) {
  if (r && typeof r === "object" && r.age != null)
    return `Last rotated ${r.age} days ago. Rotate every ${r.every || 90} days.`;
  return "Rotation is due.";
}

export const SecretRow = forwardRef(function SecretRow(
  {
    secret,
    env,
    selectable = true,
    selected,
    defaultSelected = false,
    onSelectedChange,
    editing,
    defaultEditing = false,
    onEdit,
    onSave,
    onCancel,
    onUndo,
    revealed,
    defaultRevealed,
    onReveal,
    revealTimeout = 10000,
    onOpen,
    onCopy,
    onHistory,
    onMore,
    menu,
    avatar,
    badges,
    existingKeys,
    keys,
    resolve,
    density,
    now,
    readOnly,
    locked,
    className,
    onKeyDown,
    onClick,
    onFocus,
    ...rest
  },
  ref,
) {
  const ctx = useContext(TableContext);
  const noEdit = !!(readOnly ?? ctx?.readOnly);
  const noValue = !!(locked ?? ctx?.locked);
  const s = secret || { key: "", value: "" };
  const id = rowIdOf(s);
  const status = s.status || "unchanged";
  const deleted = status === "deleted";
  const dens = density || ctx?.density || "comfortable";
  const compact = dens === "compact";
  const envName = env || ctx?.env;
  const allKeys = existingKeys || ctx?.existingKeys || [];
  const refKeys = (keys || ctx?.keys || allKeys).filter((k) => k !== s.key);
  const resolveFn = resolve || ctx?.resolve;

  const [isSelected, setSelected] = useControllable(selected, defaultSelected, onSelectedChange);
  const [shown, setShown] = useControllable(
    revealed,
    defaultRevealed !== undefined ? defaultRevealed : s.sensitive === false,
    onReveal ? (v) => onReveal(v, s) : undefined,
  );
  const [editState, setEditState] = useState(defaultEditing);
  const isEditing = !deleted && (editing !== undefined ? !!editing : editState);
  const [draft, setDraft] = useState({ key: s.key || "", value: s.value || "" });
  const [draftShown, setDraftShown] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [copied, setCopied] = useState(false);

  const rowRef = useRef(null);
  const keyRef = useRef(null);
  const valueRef = useRef(null);
  const wasEditing = useRef(isEditing && !!s.key);

  const setRowRef = (el) => {
    rowRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  useLayoutEffect(() => {
    if (isEditing && !wasEditing.current) {
      setDraft({ key: s.key || "", value: s.value || "" });
      setDraftShown(!!shown || !s.key);
      setShowErrors(false);
    }
  }, [isEditing]);

  useEffect(() => {
    const row = rowRef.current;
    if (isEditing && !wasEditing.current) {
      const target = !s.key ? keyRef.current : valueRef.current;
      if (target) {
        if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
        target.focus({ preventScroll: true });
        try {
          const l = target.value.length;
          target.setSelectionRange(l, l);
        } catch (_e) {}
      }
    } else if (!isEditing && wasEditing.current && row) {
      const a = document.activeElement;
      if (!a || a === document.body || row.contains(a)) row.focus({ preventScroll: true });
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const keyCellRef = useRef(null);
  const [tight, setTight] = useState(false);
  const missingSig = s.missingIn ? s.missingIn.join(",") : "";
  useLayoutEffect(() => {
    const cell = keyCellRef.current;
    if (!cell || isEditing) return undefined;
    const measure = () => {
      const text = cell.querySelector(".sg-secret-row__key-text");
      const wrap = cell.querySelector(".sg-secret-row__badges");
      const kids = wrap ? Array.from(wrap.children).filter((k) => k.offsetParent !== null) : [];
      if (!text || !kids.length) {
        setTight(false);
        return;
      }
      let need = text.scrollWidth + 8;
      kids.forEach((b, i) => {
        const l = b.querySelector(".sg-badge__label");
        need += b.offsetWidth + (l ? l.scrollWidth - l.offsetWidth + (l.offsetWidth ? 0 : 4) : 0) + (i ? 4 : 0);
      });
      setTight(need > cell.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(cell);
    return () => ro.disconnect();
  }, [isEditing, s.key, status, missingSig, !!s.rotationDue, !!s.note, badges]);

  const inTable = !!ctx;
  const active = inTable ? ctx.activeId == null || ctx.activeId === id : true;
  const innerTab = inTable && !active ? -1 : 0;

  const startEdit = () => {
    if (deleted || noEdit) return;
    if (editing === undefined) setEditState(true);
    if (onEdit) onEdit(s);
  };
  const cancel = () => {
    if (editing === undefined) setEditState(false);
    if (onCancel) onCancel(s);
  };
  const save = () => {
    const err = validateKey(draft.key, { existingKeys: allKeys, env: envName, original: s.key });
    if (err) {
      setShowErrors(true);
      if (keyRef.current) keyRef.current.focus();
      return;
    }
    if (s.key && draft.key === s.key && draft.value === (s.value || "")) {
      cancel();
      return;
    }
    if (editing === undefined) setEditState(false);
    if (onSave) onSave({ key: draft.key, value: draft.value }, s);
  };
  const toggleReveal = () => {
    if (!deleted && !noValue && s.value) setShown(!shown);
  };
  const copy = async () => {
    if (deleted || noValue) return;
    const prev = document.activeElement;
    const ok = await copyText(s.value || "");
    if (prev && prev !== document.activeElement && prev.isConnected && prev.focus) prev.focus({ preventScroll: true });
    if (ok) {
      setCopied(true);
      if (onCopy) onCopy(s);
    }
  };

  const handleKeyDown = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented || !e.currentTarget.contains(e.target)) return;
    const t = e.target;
    const onRow = t === e.currentTarget;
    if (isEditing) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (t.tagName === "INPUT" && isTextField(t)))) {
        e.preventDefault();
        save();
      }
      return;
    }
    if (isTextField(t) || e.altKey) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mod) {
      if (k === "c" && !String(window.getSelection?.())) {
        e.preventDefault();
        copy();
      }
      return;
    }
    if (e.shiftKey) return;
    if (k === "e" || (k === "Enter" && onRow)) {
      if (!deleted) {
        e.preventDefault();
        startEdit();
      }
      return;
    }
    if (k === "r") {
      e.preventDefault();
      toggleReveal();
      return;
    }
    if (k === "c") {
      e.preventDefault();
      copy();
      return;
    }
    if (selectable && (k === "x" || (k === " " && onRow))) {
      e.preventDefault();
      setSelected(!isSelected);
      return;
    }
    if (k === "u" && deleted && onUndo) {
      e.preventDefault();
      onUndo(s);
      return;
    }
    if (k === "Escape" && !onRow && rowRef.current) {
      e.preventDefault();
      rowRef.current.focus();
    }
  };

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || isEditing || !e.currentTarget.contains(e.target)) return;
    if (e.target.closest?.("button, a, input, textarea, label, [role='menu'], [data-sg-no-open]")) return;
    if (String(window.getSelection?.())) return;
    if (rowRef.current && document.activeElement !== rowRef.current) rowRef.current.focus({ preventScroll: true });
    if (onOpen) onOpen(s);
  };

  const handleFocus = (e) => {
    if (onFocus) onFocus(e);
    if (!e.currentTarget.contains(e.target)) return;
    if (ctx && ctx.activeId !== id) ctx.setActiveId(id);
  };

  const missing = s.missingIn?.length ? s.missingIn : null;
  const who = firstName(s.updatedBy);
  const when = formatWhen(s.updatedAt, now);
  const whoFull = typeof s.updatedBy === "string" ? s.updatedBy : s.updatedBy?.name;
  const updated = [who, when].filter(Boolean).join(" · ");

  return (
    <div
      ref={setRowRef}
      role="row"
      className={cx("sg-secret-row", `sg-secret-row--${dens}`, className)}
      data-sg-row=""
      data-row-id={id}
      data-status={status}
      data-editing={isEditing || undefined}
      data-revealed={shown || undefined}
      data-copied={copied || undefined}
      aria-selected={selectable ? !!isSelected : undefined}
      tabIndex={active ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onFocus={handleFocus}
      {...rest}
    >
      <div role="gridcell" className="sg-secret-row__cell sg-secret-row__select">
        {selectable && (
          <Checkbox
            checked={!!isSelected}
            onCheckedChange={setSelected}
            aria-label={`Select ${s.key || "new secret"}`}
            tabIndex={innerTab}
            disabled={isEditing}
          />
        )}
      </div>
      <div role="gridcell" className="sg-secret-row__cell sg-secret-row__key" ref={keyCellRef}>
        {isEditing ? (
          <SecretKeyInput
            ref={keyRef}
            size={compact ? "sm" : "md"}
            value={draft.key}
            onValueChange={(k) => setDraft((d) => ({ ...d, key: k }))}
            existingKeys={allKeys}
            env={envName}
            original={s.key}
            showErrors={showErrors}
            messagePlacement="floating"
            onPastePair={(p) => setDraft({ key: p.key, value: p.value })}
            aria-label="Key"
          />
        ) : (
          <>
            <span className="sg-secret-row__key-text" title={s.key}>
              {s.key}
            </span>
            <span className="sg-secret-row__badges" data-tight={tight || undefined}>
              <StatusBadge status={status} />
              {s.rotationDue && !deleted && (
                <Tooltip content={rotationTitle(s.rotationDue)} side="top">
                  <span className="sg-secret-row__badge">
                    <Badge tone="warning" icon="history">
                      Rotation due
                    </Badge>
                  </span>
                </Tooltip>
              )}
              {missing && !deleted && (
                <Tooltip
                  content={`Not set in ${missing.join(", ")}. Add it there to keep environments in sync.`}
                  side="top"
                >
                  <span className="sg-secret-row__badge">
                    <Badge tone="danger" icon="circle-alert">
                      {missing.length === 1
                        ? `Missing in ${missing[0]}`
                        : `Missing in ${n(missing.length, "environment")}`}
                    </Badge>
                  </span>
                </Tooltip>
              )}
              {!deleted && badges}
              {s.note && (
                <Tooltip content={s.note} side="top">
                  <span className="sg-secret-row__note">
                    <Icon name="sticky-note" size={14} label={`Note: ${s.note}`} />
                  </span>
                </Tooltip>
              )}
            </span>
          </>
        )}
      </div>
      <div
        role="gridcell"
        className="sg-secret-row__cell sg-secret-row__value"
        onDoubleClick={(e) => {
          if (!isEditing && e.currentTarget.contains(e.target)) startEdit();
        }}
      >
        {isEditing ? (
          <SecretInput
            ref={valueRef}
            size={compact ? "sm" : "md"}
            value={draft.value}
            onValueChange={(v) => setDraft((d) => ({ ...d, value: v }))}
            revealed={draftShown}
            onRevealedChange={setDraftShown}
            keys={refKeys}
            aria-label={`Value of ${draft.key || "new secret"}`}
          />
        ) : (
          <SecretValue
            value={noValue ? "" : s.value}
            revealed={!noValue && !!shown}
            onRevealedChange={setShown}
            revealTimeout={revealTimeout}
            sensitive={s.sensitive !== false}
            resolve={resolveFn}
            secretKey={s.key}
          />
        )}
      </div>
      {!isEditing && (
        <div
          role="gridcell"
          className="sg-secret-row__cell sg-secret-row__meta"
          title={whoFull && s.updatedAt ? `Updated by ${whoFull}` : undefined}
        >
          {avatar && <span className="sg-secret-row__avatar">{avatar}</span>}
          <span className="sg-secret-row__updated">{updated}</span>
        </div>
      )}
      <div role="gridcell" className="sg-secret-row__cell sg-secret-row__actions">
        {isEditing ? (
          <>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              Save
            </Button>
          </>
        ) : deleted ? (
          <Button size="sm" variant="ghost" icon="undo-2" onClick={() => onUndo?.(s)} tabIndex={innerTab}>
            Undo
          </Button>
        ) : (
          <>
            {!noValue && (
              <IconButton
                size="xs"
                className={cx(
                  "sg-secret-row__action sg-secret-row__action--reveal",
                  shown && s.sensitive !== false && "sg-secret-row__action--sticky",
                )}
                icon={shown ? "eye-off" : "eye"}
                label={shown ? "Hide value" : "Reveal value"}
                pressed={!!shown}
                disabled={!s.value}
                onClick={toggleReveal}
                tabIndex={innerTab}
              />
            )}
            {!noValue && (
              <CopyButton
                size="xs"
                className="sg-secret-row__action sg-secret-row__action--copy"
                value={s.value || ""}
                label="Copy value"
                copied={copied}
                onCopied={() => {
                  if (onCopy) onCopy(s);
                }}
                tabIndex={innerTab}
              />
            )}
            {onHistory && (
              <IconButton
                size="xs"
                className="sg-secret-row__action sg-secret-row__action--history"
                icon="history"
                label="Show history"
                onClick={() => onHistory(s)}
                tabIndex={innerTab}
              />
            )}
            {menu ? (
              <span className="sg-secret-row__action sg-secret-row__action--more sg-secret-row__menu">{menu}</span>
            ) : onMore ? (
              <IconButton
                size="xs"
                className="sg-secret-row__action sg-secret-row__action--more"
                icon="more-horizontal"
                label="More actions"
                onClick={(e) => onMore(s, e)}
                tabIndex={innerTab}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
});

export function SecretTableHeader({
  selectable = true,
  checked = false,
  indeterminate = false,
  onCheckedChange,
  selectedCount = 0,
  actions,
  onClearSelection,
  count,
  density = "comfortable",
  className,
  ...rest
}) {
  const bulk = selectedCount > 0;
  return (
    <div
      role="row"
      className={cx(
        "sg-secret-row",
        "sg-secret-header",
        `sg-secret-row--${density}`,
        bulk && "sg-secret-header--bulk",
        className,
      )}
      {...rest}
    >
      <div role="columnheader" className="sg-secret-row__cell sg-secret-row__select">
        {selectable && (
          <Checkbox
            checked={checked}
            indeterminate={indeterminate}
            onCheckedChange={onCheckedChange}
            aria-label={checked ? "Deselect all secrets" : "Select all secrets"}
          />
        )}
      </div>
      {bulk ? (
        <div role="columnheader" className="sg-secret-row__cell sg-secret-header__bulk">
          <span className="sg-secret-header__selected">{n(selectedCount, "secret")} selected</span>
          <span className="sg-secret-header__actions">
            {actions}
            {onClearSelection && (
              <Button size="sm" variant="ghost" onClick={onClearSelection}>
                Clear
              </Button>
            )}
          </span>
        </div>
      ) : (
        <>
          <div role="columnheader" className="sg-secret-row__cell sg-secret-header__label sg-secret-row__key">
            Key{count != null && <span className="sg-secret-header__count">{count}</span>}
          </div>
          <div role="columnheader" className="sg-secret-row__cell sg-secret-header__label sg-secret-row__value">
            Value
          </div>
          <div role="columnheader" className="sg-secret-row__cell sg-secret-header__label sg-secret-row__meta">
            Updated
          </div>
          <div role="columnheader" className="sg-secret-row__cell sg-secret-row__actions">
            <span className="sg-visually-hidden">Actions</span>
          </div>
        </>
      )}
    </div>
  );
}

function GroupRow({ group, collapsed, onToggle, active, onFocus }) {
  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    } else if (e.key === "ArrowLeft" && !collapsed) {
      e.preventDefault();
      onToggle();
    } else if (e.key === "ArrowRight" && collapsed) {
      e.preventDefault();
      onToggle();
    }
  };
  return (
    <div
      role="row"
      className="sg-secret-group"
      data-sg-row=""
      data-row-id={`group:${group.id}`}
      data-other={group.other || undefined}
      aria-expanded={!collapsed}
      tabIndex={active ? 0 : -1}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <div role="gridcell" className="sg-secret-group__cell" aria-colspan={5}>
        <Icon name="chevron-right" size={14} className="sg-secret-group__chevron" />
        <span className="sg-secret-group__label">{group.label}</span>
        <span className="sg-secret-group__count">{group.items.length}</span>
      </div>
    </div>
  );
}

export const SecretTable = forwardRef(function SecretTable(
  {
    secrets = [],
    children,
    env,
    density = "comfortable",
    groups = false,
    minGroupSize = 2,
    selectable = true,
    selected,
    defaultSelected = [],
    onSelectedChange,
    editingId,
    defaultEditingId = null,
    onEditingIdChange,
    collapsedGroups,
    defaultCollapsedGroups = [],
    onCollapsedGroupsChange,
    onSave,
    onCancel,
    onUndo,
    onOpen,
    onReveal,
    onCopy,
    onHistory,
    onMore,
    renderMenu,
    renderAvatar,
    renderBadges,
    resolve,
    revealTimeout = 10000,
    now,
    readOnly = false,
    locked = false,
    header = true,
    bulkActions,
    empty,
    footer,
    className,
    "aria-label": ariaLabel,
    ...rest
  },
  ref,
) {
  const [sel, setSel] = useControllable(selected, defaultSelected, onSelectedChange);
  const [editId, setEditId] = useControllable(editingId, defaultEditingId, onEditingIdChange);
  const [collapsed, setCollapsed] = useControllable(collapsedGroups, defaultCollapsedGroups, onCollapsedGroupsChange);
  const [activeId, setActiveId] = useState(null);
  const bodyRef = useRef(null);

  const selSet = useMemo(() => new Set(sel || []), [sel]);
  const live = secrets.filter((s) => s.status !== "deleted");
  const existingKeys = useMemo(() => live.map((s) => s.key).filter(Boolean), [secrets]);
  const valueMap = useMemo(() => {
    const m = new Map();
    for (const s of live) if (s.key) m.set(s.key, s.value == null ? "" : s.value);
    return m;
  }, [secrets]);
  const resolveFn = useCallback(resolve || ((k) => (valueMap.has(k) ? valueMap.get(k) : undefined)), [
    resolve,
    valueMap,
  ]);

  const grouped = useMemo(() => {
    if (!groups) return null;
    return groupSecrets(secrets, typeof groups === "function" ? { by: groups, minSize: 1 } : { minSize: minGroupSize });
  }, [secrets, groups, minGroupSize]);

  const collapsedSet = new Set(collapsed || []);
  const order = [];
  if (grouped) {
    for (const g of grouped) {
      order.push({ type: "group", id: `group:${g.id}`, group: g });
      if (!collapsedSet.has(g.id)) for (const s of g.items) order.push({ type: "row", id: rowIdOf(s), secret: s });
    }
  } else {
    for (const s of secrets) order.push({ type: "row", id: rowIdOf(s), secret: s });
  }
  const effectiveActive = !order.length || order.some((o) => o.id === activeId) ? activeId : order[0].id;

  const ctx = useMemo(
    () => ({
      activeId: effectiveActive,
      setActiveId,
      density,
      env,
      readOnly,
      locked,
      existingKeys,
      keys: existingKeys,
      resolve: resolveFn,
    }),
    [effectiveActive, density, env, readOnly, locked, existingKeys, resolveFn],
  );

  const selectableIds = live.map(rowIdOf);
  const selectedCount = selectableIds.filter((i) => selSet.has(i)).length;
  const all = selectableIds.length > 0 && selectedCount === selectableIds.length;
  const some = selectedCount > 0 && !all;

  const toggleOne = (id, on) => {
    const next = new Set(selSet);
    if (on) next.add(id);
    else next.delete(id);
    setSel(Array.from(next));
  };
  const toggleGroup = (gid) => {
    const next = new Set(collapsedSet);
    if (next.has(gid)) next.delete(gid);
    else next.add(gid);
    setCollapsed(Array.from(next));
  };

  const handleKeyDown = (e) => {
    if (e.defaultPrevented || isTextField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!e.currentTarget.contains(e.target)) return;
    const k = e.key;
    const move = k === "ArrowDown" || k === "j" ? 1 : k === "ArrowUp" || k === "k" ? -1 : 0;
    if (!move && k !== "Home" && k !== "End") return;
    const body = bodyRef.current;
    if (!body) return;
    const rows = Array.from(body.querySelectorAll("[data-sg-row]"));
    if (!rows.length) return;
    const cur = e.target.closest ? e.target.closest("[data-sg-row]") : null;
    const i = rows.indexOf(cur);
    const next =
      k === "Home" ? 0 : k === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, (i < 0 ? 0 : i) + move));
    e.preventDefault();
    rows[next].focus();
    rows[next].scrollIntoView({ block: "nearest" });
  };

  const bulkNode =
    typeof bulkActions === "function" ? bulkActions(secrets.filter((s) => selSet.has(rowIdOf(s)))) : bulkActions;

  const renderRow = (s) => {
    const id = rowIdOf(s);
    return (
      <SecretRow
        key={id}
        secret={s}
        selectable={selectable}
        selected={selSet.has(id)}
        onSelectedChange={(on) => toggleOne(id, on)}
        editing={editId === id}
        onEdit={() => setEditId(id)}
        onSave={(next) => {
          if (onSave) onSave(s, next);
          setEditId(null);
        }}
        onCancel={() => {
          if (onCancel) onCancel(s);
          setEditId(null);
        }}
        onUndo={onUndo ? () => onUndo(s) : undefined}
        onOpen={onOpen ? () => onOpen(s) : undefined}
        onReveal={onReveal ? (r) => onReveal(s, r) : undefined}
        onCopy={onCopy ? () => onCopy(s) : undefined}
        onHistory={onHistory ? () => onHistory(s) : undefined}
        onMore={onMore ? (_x, e) => onMore(s, e) : undefined}
        menu={renderMenu ? renderMenu(s) : undefined}
        avatar={renderAvatar ? renderAvatar(s) : undefined}
        badges={renderBadges ? renderBadges(s) : undefined}
        revealTimeout={revealTimeout}
        now={now}
      />
    );
  };

  return (
    <TableContext.Provider value={ctx}>
      <div
        ref={ref}
        role="grid"
        aria-label={ariaLabel || (env ? `Secrets in ${env}` : "Secrets")}
        aria-multiselectable={selectable || undefined}
        className={cx("sg-secret-table", `sg-secret-table--${density}`, className)}
        {...rest}
      >
        {header && (
          <div role="rowgroup" className="sg-secret-table__head">
            <SecretTableHeader
              selectable={selectable}
              density={density}
              checked={all}
              indeterminate={some}
              onCheckedChange={(on) => setSel(on ? selectableIds : [])}
              selectedCount={selectedCount}
              actions={bulkNode}
              onClearSelection={() => setSel([])}
              count={secrets.length ? live.length : undefined}
            />
          </div>
        )}
        <div role="rowgroup" className="sg-secret-table__body" ref={bodyRef} onKeyDown={handleKeyDown}>
          {order.map((o) =>
            o.type === "group" ? (
              <GroupRow
                key={o.id}
                group={o.group}
                collapsed={collapsedSet.has(o.group.id)}
                onToggle={() => toggleGroup(o.group.id)}
                active={effectiveActive === o.id}
                onFocus={() => setActiveId(o.id)}
              />
            ) : (
              renderRow(o.secret)
            ),
          )}
          {children}
          {!secrets.length && !children && empty && (
            <div role="row" className="sg-secret-table__empty">
              <div role="gridcell" aria-colspan={5}>
                {empty}
              </div>
            </div>
          )}
        </div>
        {footer && <div className="sg-secret-table__footer">{footer}</div>}
      </div>
    </TableContext.Provider>
  );
});
