import { Children, createContext, forwardRef, useContext, useId } from "react";
import { useShell } from "../_lib/layout.js";
import { cx, useControllable } from "../_lib/util.js";
import { EnvDot } from "../EnvBadge/EnvBadge.jsx";
import { Icon } from "../Icon/Icon.jsx";
import { Kbd } from "../Kbd/Kbd.jsx";
import { AppIcon } from "../Logo/Logo.jsx";

const SidebarContext = createContext({ collapsed: false });
const LevelContext = createContext(0);

const ROVING = ".sg-nav-item, .sg-sidebar-section__trigger";

function visible(root) {
  return Array.from(root.querySelectorAll(ROVING)).filter(
    (el) => el.offsetParent !== null && el.getAttribute("aria-disabled") !== "true",
  );
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export const Sidebar = forwardRef(function Sidebar(
  { header, footer, children, collapsed, label = "Main navigation", className, ...rest },
  ref,
) {
  const shell = useShell();
  const isCollapsed = collapsed !== undefined ? !!collapsed : !!shell?.collapsed;
  const onKeyDown = (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    if (!e.target.matches?.(ROVING)) return;
    const list = visible(e.currentTarget);
    if (!list.length) return;
    const i = list.indexOf(e.target);
    let next = null;
    if (e.key === "ArrowDown") next = list[Math.min(list.length - 1, i + 1)];
    if (e.key === "ArrowUp") next = list[Math.max(0, i - 1)];
    if (e.key === "Home") next = list[0];
    if (e.key === "End") next = list[list.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <SidebarContext.Provider value={{ collapsed: isCollapsed }}>
      <div ref={ref} className={cx("sg-sidebar", className)} data-collapsed={isCollapsed || undefined} {...rest}>
        {header && <div className="sg-sidebar__header">{header}</div>}
        <nav className="sg-sidebar__body" aria-label={label} onKeyDown={onKeyDown}>
          {children}
        </nav>
        {footer && <div className="sg-sidebar__footer">{footer}</div>}
      </div>
    </SidebarContext.Provider>
  );
});

export function SidebarHeader({ children, actions, className, ...rest }) {
  return (
    <div className={cx("sg-sidebar-header", className)} {...rest}>
      <div className="sg-sidebar-header__main">{children}</div>
      {actions && <div className="sg-sidebar-header__actions">{actions}</div>}
    </div>
  );
}

export const WorkspaceButton = forwardRef(function WorkspaceButton({ name, tile, className, ...rest }, ref) {
  const { collapsed } = useContext(SidebarContext);
  return (
    <button
      ref={ref}
      type="button"
      className={cx("sg-workspace-button", className)}
      aria-label={collapsed ? `${name}, switch workspace` : undefined}
      title={collapsed ? name : undefined}
      {...rest}
    >
      <span className="sg-workspace-button__tile">{tile || <AppIcon size={20} />}</span>
      <span className="sg-workspace-button__name">{name}</span>
      <Icon name="chevrons-up-down" size={14} className="sg-workspace-button__chevron" />
    </button>
  );
});

export function SidebarSection({
  label,
  children,
  action,
  collapsible = true,
  open,
  defaultOpen = true,
  onOpenChange,
  className,
  ...rest
}) {
  const { collapsed } = useContext(SidebarContext);
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const id = useId();
  const labelId = `${id}-label`;
  const shown = isOpen || collapsed || !collapsible;
  return (
    <div className={cx("sg-sidebar-section", className)} data-state={shown ? "open" : "closed"} {...rest}>
      <div className="sg-sidebar-section__header">
        {collapsible ? (
          <button
            type="button"
            className="sg-sidebar-section__trigger"
            aria-expanded={!!isOpen}
            aria-controls={id}
            onClick={() => setOpen(!isOpen)}
          >
            <span id={labelId} className="sg-sidebar-section__label">
              {label}
            </span>
            <Icon name="chevron-right" size={12} className="sg-sidebar-section__chevron" />
          </button>
        ) : (
          <span id={labelId} className="sg-sidebar-section__trigger sg-sidebar-section__trigger--static">
            <span className="sg-sidebar-section__label">{label}</span>
          </span>
        )}
        {action && <div className="sg-sidebar-section__action">{action}</div>}
      </div>
      <div id={id} className="sg-sidebar-section__items" role="group" aria-labelledby={labelId} hidden={!shown}>
        {children}
      </div>
    </div>
  );
}

export const NavItem = forwardRef(function NavItem(
  {
    icon,
    dot,
    label,
    count,
    countTone = "neutral",
    kbd,
    active = false,
    children,
    open,
    defaultOpen = false,
    onOpenChange,
    trailing,
    href,
    onClick,
    onKeyDown,
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  const { collapsed } = useContext(SidebarContext);
  const level = useContext(LevelContext);
  const shell = useShell();
  const hasChildren = Children.toArray(children).length > 0;
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const groupId = useId();
  const text = typeof label === "string" ? label : undefined;
  const Tag = href && !hasChildren && !disabled ? "a" : "button";

  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (hasChildren && !collapsed) setOpen(!isOpen);
    if (onClick) onClick(e);
    if (!hasChildren && shell && shell.onNavigate) shell.onNavigate();
  };
  const handleKeyDown = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented) return;
    if (hasChildren && !collapsed && e.key === "ArrowRight" && !isOpen) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (hasChildren && !collapsed && e.key === "ArrowLeft" && isOpen) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowLeft" && level > 0) {
      const group = e.currentTarget.closest(".sg-nav-item__children");
      const parent = group?.parentElement?.querySelector(":scope > .sg-nav-item");
      if (parent) {
        e.preventDefault();
        parent.focus();
      }
    }
  };

  return (
    <div className="sg-nav-node" data-level={level || undefined}>
      <Tag
        ref={ref}
        className={cx("sg-nav-item", className)}
        href={Tag === "a" ? href : undefined}
        type={Tag === "button" ? "button" : undefined}
        aria-current={active ? "page" : undefined}
        aria-expanded={hasChildren && !collapsed ? !!isOpen : undefined}
        aria-controls={hasChildren && !collapsed ? groupId : undefined}
        aria-disabled={disabled || undefined}
        aria-label={collapsed && text ? (count != null ? `${text}, ${count}` : text) : undefined}
        title={collapsed ? text : undefined}
        data-active={active || undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {dot ? (
          <span className="sg-nav-item__lead sg-nav-item__lead--dot">
            <EnvDot color={dot} size={8} />
          </span>
        ) : icon ? (
          <span className="sg-nav-item__lead">
            <Icon name={icon} size={16} />
          </span>
        ) : null}
        <span className="sg-nav-item__label">{label}</span>
        {hasChildren && <Icon name="chevron-right" size={12} className="sg-nav-item__caret" />}
        {(kbd || count != null || trailing) && (
          <span className="sg-nav-item__end">
            {kbd && <Kbd keys={kbd} size="sm" className="sg-nav-item__kbd" />}
            {trailing && <span className="sg-nav-item__trailing">{trailing}</span>}
            {count != null && (
              <span className={cx("sg-nav-item__count", countTone !== "neutral" && `sg-nav-item__count--${countTone}`)}>
                {count}
              </span>
            )}
          </span>
        )}
      </Tag>
      {hasChildren && !collapsed && (
        <div id={groupId} className="sg-nav-item__children" role="group" aria-label={text} hidden={!isOpen}>
          <LevelContext.Provider value={level + 1}>{children}</LevelContext.Provider>
        </div>
      )}
    </div>
  );
});

export const SidebarUser = forwardRef(function SidebarUser({ name, detail, avatar, className, ...rest }, ref) {
  const { collapsed } = useContext(SidebarContext);
  return (
    <button
      ref={ref}
      type="button"
      className={cx("sg-sidebar-user", className)}
      aria-label={collapsed ? (detail ? `${name}, ${detail}` : name) : undefined}
      title={collapsed ? name : undefined}
      {...rest}
    >
      {avatar || (
        <span className="sg-sidebar-user__avatar" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <span className="sg-sidebar-user__text">
        <span className="sg-sidebar-user__name">{name}</span>
        {detail && <span className="sg-sidebar-user__detail">{detail}</span>}
      </span>
    </button>
  );
});
