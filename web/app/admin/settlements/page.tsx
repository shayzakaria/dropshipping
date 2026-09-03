import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatILS } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import type { Business, Settlement } from "@/lib/domain/types";
import { IssueSettlementsForm } from "@/components/IssueSettlementsForm";
import { SettleStatementForm } from "@/components/SettleStatementForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "גבייה מעסקים | BOOST", robots: { index: false, follow: false } };

/**
 * The collection queue: who has been billed, who has paid, and who has not.
 *
 * This is the other half of the payouts page. Money cannot go out to
 * influencers until it has come in from businesses, so an operator standing
 * on the payouts screen needs to be able to answer "has this been collected"
 * from somewhere — and this is that somewhere.
 */
export default async function AdminSettlementsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const store = await getReadyStore();
  const all = await store.listSettlements();
  const businesses = await store.listBusinessesByIds([...new Set(all.map((s) => s.businessId))]);
  const byId = new Map(businesses.map((b) => [b.id, b]));

  const open = all.filter((s) => s.status === "issued");
  const closed = all.filter((s) => s.status !== "issued").slice(0, 40);
  const owed = open.reduce((sum, s) => sum + s.total, 0);
  const owedToInfluencers = open.reduce((sum, s) => sum + s.commissions, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">גבייה מעסקים</h1>
          <p className="mt-2 text-sm text-mut">חשבונות חודשיים: מי חויב, מי שילם, וממי צריך לגבות</p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-deal-deep underline underline-offset-2">
          ← לניהול מערכת
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-mut">ממתין לגבייה</p>
          <p className="mt-1 font-sans text-5xl font-semibold leading-none">{formatILS(owed)}</p>
          <p className="mt-2 text-xs text-mut">
            {open.length} {open.length === 1 ? "חשבון פתוח" : "חשבונות פתוחים"}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-mut">מתוכו מיועד למשפיענים</p>
          <p className="mt-1 font-sans text-5xl font-semibold leading-none">{formatILS(owedToInfluencers)}</p>
          <p className="mt-2 text-xs leading-relaxed text-mut">
            הכסף הזה אינו שלנו. עד שייגבה, אי אפשר לשלם ממנו משיכות.
          </p>
        </Card>
      </div>

      <SectionTitle>הפקת חשבונות</SectionTitle>
      <Card>
        <IssueSettlementsForm />
      </Card>

      <SectionTitle>חשבונות פתוחים</SectionTitle>
      {open.length === 0 ? (
        <Card>
          <p className="text-sm text-mut">אין חשבונות פתוחים.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {open.map((s) => (
            <OpenStatement key={s.id} settlement={s} business={byId.get(s.businessId)} />
          ))}
        </ul>
      )}

      <SectionTitle>היסטוריה</SectionTitle>
      {closed.length === 0 ? (
        <Card>
          <p className="text-sm text-mut">עוד לא נסגר אף חשבון.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">חשבונות שנסגרו</caption>
            <thead className="border-b border-line text-xs font-medium text-mut">
              <tr>
                <th scope="col" className="p-3 text-start">עסק</th>
                <th scope="col" className="p-3 text-start">תקופה</th>
                <th scope="col" className="p-3 text-start">סכום</th>
                <th scope="col" className="p-3 text-start">מצב</th>
                <th scope="col" className="p-3 text-start">מתי</th>
                <th scope="col" className="p-3 text-start">הערה</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((s) => (
                <tr key={s.id} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="p-3 text-start font-medium">
                    {byId.get(s.businessId)?.name ?? "—"}
                  </th>
                  <td className="p-3 text-mut">{s.periodStart.slice(0, 7)}</td>
                  <td className="p-3 font-mono tabular-nums">{formatILS(s.total)}</td>
                  <td className="p-3">
                    <Badge tone={s.status === "paid" ? "success" : "default"}>
                      {s.status === "paid" ? "שולם" : "בוטל"}
                    </Badge>
                  </td>
                  <td className="p-3 text-mut">{s.paidAt ? formatDate(s.paidAt) : "—"}</td>
                  <td className="p-3 text-mut">{s.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function OpenStatement({ settlement, business }: { settlement: Settlement; business?: Business }) {
  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-3xl leading-none">{business?.name ?? "עסק לא ידוע"}</h2>
          <p className="font-sans text-3xl font-semibold leading-none">{formatILS(settlement.total)}</p>
        </div>
        <p className="mt-1 text-xs text-mut">
          {settlement.periodStart.slice(0, 7)} · {settlement.salesCount} מכירות · הופק ב-
          {formatDate(settlement.issuedAt)}
        </p>

        <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl border border-line bg-paper p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-mut">עמלות למשפיענים</dt>
            <dd className="font-mono font-medium tabular-nums">{formatILS(settlement.commissions)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-mut">דמי פלטפורמה</dt>
            <dd className="font-mono font-medium tabular-nums">{formatILS(settlement.platformFees)}</dd>
          </div>
        </dl>

        <SettleStatementForm settlementId={settlement.id} />
      </Card>
    </li>
  );
}
