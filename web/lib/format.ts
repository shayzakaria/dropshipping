const ils = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatILS(amount: number): string {
  return ils.format(amount);
}

export function formatPct(pct: number): string {
  return `${pct}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
