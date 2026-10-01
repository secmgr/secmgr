import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import {
  compose,
  firstFocusable,
  LayerProvider,
  OverlayPortal,
  useFocusScope,
  useLayer,
  useLayerZ,
  useOpenState,
  usePresence,
  useScrollLock,
  useStableId,
} from "../_lib/overlay.js";
import { cx } from "../_lib/util.js";
import { Button } from "../Button/Button.jsx";
import { IconButton } from "../IconButton/IconButton.jsx";

function pickInitial(root) {
  const auto = root.querySelector("[data-autofocus], [autofocus]");
  if (auto) return auto;
  const body = root.querySelector(".sg-dialog__body");
  const foot = root.querySelector(".sg-dialog__footer");
  return (body && firstFocusable(body)) || (foot && firstFocusable(foot)) || root;
}

export function Dialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  size = "md",
  footer,
  closeOnOverlay = true,
  hideClose = false,
  initialFocus,
  container,
  className,
  children,
  id: idProp,
  ...rest
}) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const layerRef = useRef(null);
  const panelRef = useRef(null);
  const id = useStableId("sg-dialog", idProp);
  const presence = usePresence(open, 160);
  const z = useLayerZ("var(--z-dialog)");

  useLayer(open, { contains: (t) => !!layerRef.current?.contains(t), onEscape: close });
  useScrollLock(open && !container);
  useFocusScope(open, panelRef, {
    trap: true,
    initialFocus:
      initialFocus === false ? false : initialFocus && initialFocus.current !== undefined ? initialFocus : pickInitial,
  });

  let triggerEl = null;
  if (isValidElement(trigger)) {
    triggerEl = cloneElement(trigger, {
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: compose(trigger.props.onClick, () => setOpen(true)),
    });
  }

  const titleId = `${id}-title`;
  const descId = `${id}-description`;
  const hasBody = children != null && children !== false;

  return (
    <>
      {triggerEl}
      {presence.mounted && (
        <OverlayPortal container={container}>
          <LayerProvider z={z}>
            <div ref={layerRef} className="sg-dialog-layer" data-state={presence.state} style={{ zIndex: z }}>
              <div
                className="sg-dialog-overlay"
                data-state={presence.state}
                aria-hidden="true"
                onClick={closeOnOverlay ? close : undefined}
              />
              <div
                ref={panelRef}
                id={id}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                data-state={presence.state}
                className={cx("sg-dialog", `sg-dialog--${size}`, className)}
                {...rest}
              >
                {(title || !hideClose) && (
                  <div className={cx("sg-dialog__header", !hasBody && "sg-dialog__header--alone")}>
                    <div className="sg-dialog__heading">
                      {title && (
                        <h2 id={titleId} className="sg-dialog__title">
                          {title}
                        </h2>
                      )}
                      {description && (
                        <p id={descId} className="sg-dialog__description">
                          {description}
                        </p>
                      )}
                    </div>
                    {!hideClose && (
                      <IconButton
                        icon="x"
                        label="Close"
                        kbd="esc"
                        size="sm"
                        className="sg-dialog__close"
                        onClick={close}
                      />
                    )}
                  </div>
                )}
                {hasBody && <div className="sg-dialog__body">{children}</div>}
                {footer && <div className="sg-dialog__footer">{footer}</div>}
              </div>
            </div>
          </LayerProvider>
        </OverlayPortal>
      )}
    </>
  );
}

export function ConfirmDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  requireText,
  loading: loadingProp,
  onConfirm,
  onCancel,
  size = "sm",
  children,
  ...rest
}) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const loading = !!loadingProp || busy;
  const ready = !requireText || typed === requireText;
  const inputId = useStableId("sg-confirm-input");
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const requestOpen = useCallback(
    (v) => {
      if (!v && loading) return;
      if (!v && onCancel) onCancel();
      setOpen(v);
    },
    [loading, onCancel, setOpen],
  );

  const confirm = () => {
    if (!ready || loading) return;
    const result = onConfirm ? onConfirm() : undefined;
    if (result && typeof result.then === "function") {
      setBusy(true);
      result.then(
        () => {
          if (alive.current) {
            setBusy(false);
            setOpen(false);
          }
        },
        () => {
          if (alive.current) setBusy(false);
        },
      );
      return;
    }
    if (loadingProp === undefined) setOpen(false);
  };

  const focusTarget = requireText ? "input" : tone === "danger" ? "cancel" : "confirm";
  const footer = (
    <>
      <Button
        variant="secondary"
        onClick={() => requestOpen(false)}
        disabled={loading}
        data-autofocus={focusTarget === "cancel" || undefined}
      >
        {cancelLabel}
      </Button>
      <Button
        variant={tone === "danger" ? "danger" : "primary"}
        onClick={confirm}
        disabled={!ready}
        loading={loading}
        data-autofocus={focusTarget === "confirm" || undefined}
      >
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={requestOpen}
      trigger={trigger}
      title={title}
      description={description}
      size={size}
      footer={footer}
      role="alertdialog"
      closeOnOverlay={!requireText}
      {...rest}
    >
      {children || requireText ? (
        <div className="sg-confirm">
          {children}
          {requireText && (
            <div className="sg-confirm__field">
              <label htmlFor={inputId} className="sg-confirm__label">
                Type <code className="sg-confirm__code">{requireText}</code> to confirm
              </label>
              <input
                id={inputId}
                className="sg-confirm__input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirm();
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={loading}
                data-autofocus=""
                data-match={ready && typed ? "" : undefined}
              />
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
