import { createContext, useContext, useState } from "react";
import { useIsoLayoutEffect } from "./util.js";

export const ShellContext = createContext(null);

export function useShell() {
  return useContext(ShellContext);
}

export function useElementWidth(ref) {
  const [width, setWidth] = useState(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.offsetWidth);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return width;
}

export function mergeRefs(...refs) {
  return (el) => {
    for (const r of refs) {
      if (typeof r === "function") r(el);
      else if (r) r.current = el;
    }
  };
}

export function safeId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, "");
}
