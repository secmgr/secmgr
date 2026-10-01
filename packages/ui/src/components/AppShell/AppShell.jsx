import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { mergeRefs, ShellContext } from "../_lib/layout.js";
import { cx, useControllable, useEscape, useFocusTrap, useIsoLayoutEffect } from "../_lib/util.js";
import { IconButton } from "../IconButton/IconButton.jsx";

const NARROW = 768;

export const AppShell = forwardRef(function AppShell(
  {
    sidebar,
    header,
    children,
    inset = true,
    sidebarCollapsed,
    defaultSidebarCollapsed = false,
    onSidebarCollapsedChange,
    collapsible = true,
    drawerOpen,
    defaultDrawerOpen = false,
    onDrawerOpenChange,
    sidebarLabel = "Sidebar",
    className,
    ...rest
  },
  ref,
) {
  const rootRef = useRef(null);
  const asideRef = useRef(null);
  const asideId = useId();
  const [narrow, setNarrow] = useState(false);
  const [collapsed, setCollapsed] = useControllable(
    sidebarCollapsed,
    defaultSidebarCollapsed,
    onSidebarCollapsedChange,
  );
  const [open, setOpen] = useControllable(drawerOpen, defaultDrawerOpen, onDrawerOpenChange);

  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const check = () => setNarrow(el.offsetWidth > 0 && el.offsetWidth < NARROW);
    check();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wasNarrow = useRef(false);
  useEffect(() => {
    if (wasNarrow.current && !narrow && open) setOpen(false);
    wasNarrow.current = narrow;
  }, [narrow]);

  const drawer = narrow && !!open;
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEscape(drawer, close);
  useFocusTrap(drawer, asideRef);

  useEffect(() => {
    if (asideRef.current) asideRef.current.inert = narrow && !open;
  }, [narrow, open]);

  const isCollapsed = !narrow && !!collapsed;
  const ctx = useMemo(
    () => ({ collapsed: isCollapsed, narrow, drawerOpen: drawer, onNavigate: narrow ? close : null }),
    [isCollapsed, narrow, drawer, close],
  );

  const toggle = narrow ? (
    <IconButton
      icon="menu"
      label="Open navigation"
      size="sm"
      aria-expanded={drawer}
      aria-controls={asideId}
      onClick={() => setOpen(true)}
      className="sg-app-shell__toggle"
    />
  ) : collapsible ? (
    <IconButton
      icon="panel-left"
      label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      size="sm"
      aria-controls={asideId}
      onClick={() => setCollapsed(!collapsed)}
      className="sg-app-shell__toggle"
    />
  ) : null;

  return (
    <div
      ref={mergeRefs(rootRef, ref)}
      className={cx("sg-app-shell", className)}
      data-layout={narrow ? "narrow" : "wide"}
      data-inset={(inset && !narrow) || undefined}
      data-collapsed={isCollapsed || undefined}
      data-drawer={narrow ? (open ? "open" : "closed") : undefined}
      {...rest}
    >
      <ShellContext.Provider value={ctx}>
        <aside
          ref={asideRef}
          id={asideId}
          className="sg-app-shell__sidebar"
          aria-label={sidebarLabel}
          role={drawer ? "dialog" : undefined}
          aria-modal={drawer || undefined}
        >
          {sidebar}
        </aside>
      </ShellContext.Provider>
      {narrow && <div className="sg-app-shell__scrim" aria-hidden="true" onClick={close} />}
      <div className="sg-app-shell__main">
        <div className="sg-app-shell__panel">
          {(header || toggle) && (
            <div className="sg-app-shell__header">
              {toggle}
              {toggle && header && <span className="sg-app-shell__divider" aria-hidden="true" />}
              <div className="sg-app-shell__header-content">{header}</div>
            </div>
          )}
          <main className="sg-app-shell__content">{children}</main>
        </div>
      </div>
    </div>
  );
});
