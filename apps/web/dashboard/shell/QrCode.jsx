import { useMemo } from "react";
import { encode } from "uqr";

export default function QrCode({ value, size = 176, label }) {
  const path = useMemo(() => {
    const { data } = encode(value, { ecc: "M", border: 2 });
    let d = "";
    data.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { d, n: data.length };
  }, [value]);
  return (
    <svg
      className="app-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${path.n} ${path.n}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={path.n} height={path.n} className="app-qr__bg" />
      <path d={path.d} className="app-qr__fg" />
    </svg>
  );
}
