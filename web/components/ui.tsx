import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`label-card p-5 ${className}`}>{children}</div>;
}

/** שורת נתון בסגנון תווית מנשר אריזה */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="text-[13px] font-medium text-mut">{label}</div>
      <div className="tabular mt-1 font-display text-4xl leading-none">{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-mut">{sub}</div> : null}
    </Card>
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
  "inline-flex items-center justify-center gap-2 rounded-lg bg-deal px-4 py-2 text-sm font-bold text-ink shadow-[0_1px_2px_rgba(34,29,21,0.25),0_4px_10px_rgba(201,58,6,0.25)] transition hover:-rotate-1 hover:bg-[#ff5a17] disabled:opacity-50 disabled:hover:rotate-0";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-ink/30 bg-label px-4 py-2 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(34,29,21,0.08)] transition hover:bg-paper";
export const btnStamp =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-label transition hover:bg-ink/85";
export const inputCls =
  "w-full rounded-lg border border-ink/30 bg-label px-3 py-2 text-sm text-ink placeholder:text-mut/70 focus:border-deal focus:outline-none";
