import { useCallback, useEffect, useState } from "react";
import { useIsoLayoutEffect } from "./util.js";

const PAD = 8;

export function computePosition(anchorRect, floatRect, placement = "bottom-start", offset = 6) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let [side, align = "center"] = placement.split("-");
  const fits = {
    bottom: anchorRect.bottom + offset + floatRect.height <= vh - PAD,
    top: anchorRect.top - offset - floatRect.height >= PAD,
    right: anchorRect.right + offset + floatRect.width <= vw - PAD,
    left: anchorRect.left - offset - floatRect.width >= PAD,
  };
  const opposite = { bottom: "top", top: "bottom", left: "right", right: "left" };
  if (!fits[side] && fits[opposite[side]]) side = opposite[side];
  let top = 0;
  let left = 0;
  if (side === "bottom" || side === "top") {
    top = side === "bottom" ? anchorRect.bottom + offset : anchorRect.top - offset - floatRect.height;
    if (align === "start") left = anchorRect.left;
    else if (align === "end") left = anchorRect.right - floatRect.width;
    else left = anchorRect.left + anchorRect.width / 2 - floatRect.width / 2;
  } else {
    left = side === "right" ? anchorRect.right + offset : anchorRect.left - offset - floatRect.width;
    if (align === "start") top = anchorRect.top;
    else if (align === "end") top = anchorRect.bottom - floatRect.height;
    else top = anchorRect.top + anchorRect.height / 2 - floatRect.height / 2;
  }
  left = Math.min(Math.max(PAD, left), Math.max(PAD, vw - floatRect.width - PAD));
  top = Math.min(Math.max(PAD, top), Math.max(PAD, vh - floatRect.height - PAD));
  return { top: Math.round(top), left: Math.round(left), side, align };
}

export function useFloating({
  open,
  anchorRef,
  floatingRef,
  placement = "bottom-start",
  offset = 6,
  matchWidth = false,
}) {
  const [pos, setPos] = useState({ top: -9999, left: -9999, side: placement.split("-")[0], ready: false });
  const update = useCallback(() => {
    const a = anchorRef.current;
    const f = floatingRef.current;
    if (!a || !f) return;
    const ar = a.getBoundingClientRect();
    if (matchWidth) f.style.minWidth = `${Math.round(ar.width)}px`;
    const fr = f.getBoundingClientRect();
    const p = computePosition(ar, fr, placement, offset);
    setPos({ ...p, ready: true });
  }, [anchorRef, floatingRef, placement, offset, matchWidth]);
  useIsoLayoutEffect(() => {
    if (!open) {
      setPos((p) => ({ ...p, ready: false }));
      return undefined;
    }
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);
  useEffect(() => {
    if (!open || !floatingRef.current || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(floatingRef.current);
    return () => ro.disconnect();
  }, [open, update]);
  const style = { position: "fixed", top: pos.top, left: pos.left, visibility: pos.ready ? "visible" : "hidden" };
  return { style, side: pos.side, update };
}
