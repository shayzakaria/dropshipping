import { Card } from "./ui";
import { formatDate, formatILS } from "@/lib/format";
import type { Settlement } from "@/lib/domain/types";

/**
 * What this business owes, split into what has been billed and what has not.
 *
 * A business that pays nothing up front still needs to know what is coming,
 * and finding out for the first time when an invoice arrives is the fastest
 * way to lose one. The unbilled figure is the honest answer to "what is this
 * costing me right now".
 */
export function BusinessBalance({
  settlements,
  unbilled,
}: {
  settlements: Settlement[];
  unbilled: { commissions: number; platformFees: number; count: number };
}) {
  const open = settlements.filter((s) => s.status === "issued");
  const openTotal = open.reduce((sum, s) => sum + s.total, 0);
  const paid = settlements.filter((s) => s.status === "paid");
  const unbilledTotal = unbilled.commissions + unbilled.platformFees;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className={open.length ? "border-deal-deep/50 bg-mark/20" : ""}>
          <p className="text-sm font-medium text-mut">לתשלום עכשיו</p>
          <p className="mt-1 font-sans text-4xl font-semibold leading-none">{formatILS(openTotal)}</p>
          <p className="mt-2 text-xs leading-relaxed text-mut">
            {open.length
              ? `${open.length} חשבונות שהופקו וטרם שולמו.`
              : "אין חשבון פתוח. שילמתם הכל."}
          </p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-mut">נצבר לחשבון הבא</p>
          <p className="mt-1 font-sans text-4xl font-semibold leading-none">{formatILS(unbilledTotal)}</p>
          <p className="mt-2 text-xs leading-relaxed text-mut">
            {unbilled.count} מכירות שהשתחררו ועדיין לא חויבו.{" "}
            {formatILS(unbilled.commissions)} עמלות + {formatILS(unbilled.platformFees)} דמי פלטפורמה.
          </p>
        </Card>
      </div>

      {open.length ? (
        <Card>
          <p className="text-sm font-semibold">חשבונות פתוחים</p>
          <ul className="mt-2 divide-y divide-ink/10 text-sm">
            {open.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{s.periodStart.slice(0, 7)}</span>
                  <span className="block text-xs text-mut">
                    {s.salesCount} מכירות · {formatILS(s.commissions)} עמלות +{" "}
                    {formatILS(s.platformFees)} דמי פלטפורמה
                  </span>
                </span>
                <span className="font-mono font-bold tabular-nums">{formatILS(s.total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-light leading-relaxed text-mut">
            נשלח אליכם חשבון עם פרטי ההעברה. מתוך הסכום הזה אנחנו משלמים למשפיענים שלכם.
          </p>
        </Card>
      ) : null}

      {paid.length ? (
        <details className="rounded-xl border border-line bg-label p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            היסטוריית תשלומים ({paid.length})
          </summary>
          <ul className="mt-2 divide-y divide-ink/10 text-sm">
            {paid.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-2 py-2">
                <span className="text-mut">
                  {s.periodStart.slice(0, 7)}
                  {s.paidAt ? ` · שולם ב-${formatDate(s.paidAt)}` : ""}
                </span>
                <span className="font-mono tabular-nums">{formatILS(s.total)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
