import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return <div className={`label-card ${pad ? "p-5" : ""} ${className}`}>{children}</div>;
}

export interface StatItem {
  label: string;
  value: ReactNode;
  sub?: string;
  /** הנתון המרכזי — מקבל מדבקת מחיר כתומה */
  accent?: boolean;
}

/**
 * רצועת נתונים כמנשר אריזה אחד: תווית רחבה עם קווי ניקוב בין הערכים,
 * והנתון המרכזי מודגש כמדבקת מחיר — במקום גריד כרטיסים שווים.
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  const cellBorders = [
    "",
    "border-s border-dashed border-ink/25",
    "border-t lg:border-t-0 lg:border-s border-dashed border-ink/25",
    "border-s border-t lg:border-t-0 border-dashed border-ink/25",
  ];
  return (
    <div className="label-card grid grid-cols-2 overflow-hidden p-0 lg:grid-cols-4">
      {items.map((it, i) => (
        <div key={it.label} className={`p-4 ${cellBorders[i] ?? cellBorders[1]}`}>
          <div className="text-[13px] font-medium text-mut">{it.label}</div>
          <div className="tabular mt-1.5 font-display leading-none">
            {it.accent ? (
              <span className="inline-block -rotate-2 rounded-md bg-deal px-2.5 py-1 text-4xl text-ink shadow-[0_1px_2px_rgba(34,29,21,0.25)]">
                {it.value}
              </span>
            ) : (
              <span className="text-4xl">{it.value}</span>
            )}
          </div>
          {it.sub ? <div className="mt-1.5 text-xs text-mut">{it.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 flex items-center gap-3 font-display text-3xl leading-none">
      {children}
      <span className="perforation mt-1 h-0 grow" aria-hidden="true" />
    </h2>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const tones = {
    default: "border-ink/25 bg-label text-ink",
    success: "border-ok/40 bg-okbg text-ok",
    warning: "border-deal-deep/40 bg-mark/30 text-deal-deep",
  } as const;
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const btnPrimary =
  "inline-flex -rotate-1 items-center justify-center gap-2 rounded-lg bg-deal px-4 py-2 text-sm font-bold text-ink shadow-[0_1px_2px_rgba(34,29,21,0.25),0_4px_10px_rgba(201,58,6,0.25)] transition hover:rotate-0 hover:bg-[#ff5a17] disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-ink/30 bg-label px-4 py-2 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(34,29,21,0.08)] transition hover:bg-paper";
export const btnStamp =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-label transition hover:bg-ink/85";
export const inputCls =
  "w-full rounded-lg border border-ink/30 bg-label px-3 py-2 text-sm text-ink placeholder:text-mut focus:border-deal focus:outline-none";
