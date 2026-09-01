/**
 * ברקוד דקורטיבי דטרמיניסטי — אותו קוד תמיד מצייר את אותם פסים,
 * גם בשרת וגם בלקוח (אין hydration mismatch).
 */
export function Barcode({
  seed,
  height = 26,
  className,
}: {
  seed: string;
  height?: number;
  className?: string;
}) {
  const bars: { x: number; w: number }[] = [];
  let h = 7;
  let x = 0;
  for (let i = 0; i < 28; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length)) % 211;
    const w = (h % 3) + 1;
    bars.push({ x, w });
    x += w + ((h >> 3) % 2) + 1;
  }
  return (
    <svg
      viewBox={`0 0 ${x} ${height}`}
      height={height}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ width: "100%" }}
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}
