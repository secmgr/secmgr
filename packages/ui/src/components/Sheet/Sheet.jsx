import { cloneElement, isValidElement, useCallback, useRef } from "react";
import {
  compose,
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
import { IconButton } from "../IconButton/IconButton.jsx";

function pickInitial(root) {
  return root.querySelector("[data-autofocus], [autofocus]") || root;
}

export function Sheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  actions,
  footer,
  modal = true,
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
  const id = useStableId("sg-sheet", idProp);
  const presence = usePresence(open, 220);
  const z = useLayerZ("var(--z-sheet)");

  useLayer(open, {
    contains: (t) =>
      !!((modal ? layerRef.current : panelRef.current) && (modal ? layerRef.current : panelRef.current).contains(t)),
    onEscape: close,
  });
  useScrollLock(open && modal && !container);
  useFocusScope(open, panelRef, {
    trap: modal,
    initialFocus:
      initialFocus === false ? false : initialFocus && initialFocus.current !== undefined ? initialFocus : pickInitial,
  });

  let triggerEl = null;
  if (isValidElement(trigger)) {
    triggerEl = cloneElement(trigger, {
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: compose(trigger.props.onClick, () => setOpen(!open)),
    });
  }

  const titleId = `${id}-title`;
  const descId = `${id}-description`;

  return (
    <>
      {triggerEl}
      {presence.mounted && (
        <OverlayPortal container={container}>
          <LayerProvider z={z}>
            <div
              ref={layerRef}
              className={cx("sg-sheet-layer", !modal && "sg-sheet-layer--peek")}
              data-state={presence.state}
              style={{ zIndex: z }}
            >
              {modal && (
                <div
                  className="sg-sheet-overlay"
                  data-state={presence.state}
                  aria-hidden="true"
                  onClick={closeOnOverlay ? close : undefined}
                />
              )}
              <div
                ref={panelRef}
                id={id}
                role="dialog"
                aria-modal={modal ? "true" : undefined}
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                data-state={presence.state}
                className={cx("sg-sheet", !modal && "sg-sheet--peek", className)}
                {...rest}
              >
                <span className="sg-sheet__grabber" aria-hidden="true" />
                <div className="sg-sheet__header">
                  <div className="sg-sheet__heading">
                    {title && (
                      <h2 id={titleId} className="sg-sheet__title">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id={descId} className="sg-sheet__description">
                        {description}
                      </p>
                    )}
                  </div>
                  <div className="sg-sheet__actions">
                    {actions}
                    {!hideClose && (
                      <IconButton icon="x" label="Close" kbd="esc" size="sm" onClick={close} tooltipSide="bottom" />
                    )}
                  </div>
                </div>
                <div className="sg-sheet__body">{children}</div>
                {footer && <div className="sg-sheet__footer">{footer}</div>}
              </div>
            </div>
          </LayerProvider>
        </OverlayPortal>
      )}
    </>
  );
}
