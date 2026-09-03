import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, SectionTitle, inputCls } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatILS } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import type { PayoutDetails, PayoutRequest, User } from "@/lib/domain/types";
import { settlePayout } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תשלומים | BOOST", robots: { index: false, follow: false } };

const TAX_LABELS: Record<PayoutDetails["taxStatus"], string> = {
  exempt: "עוסק פטור — צריך חשבונית",
  licensed: "עוסק מורשה — צריך חשבונית מס",
  none: "לא עוסק — תשלום בניכוי מס במקור",
};

/**
 * The payout queue: who asked for money, how much, and where to send it.
 *
 * The transfer itself happens in a bank, not here. This page exists so the
 * person making it has the details in one place and marks the result, which
 * is what closes the request and updates what the influencer sees.
 *
 * Bank details are shown only on requests that are still open. Once a payout
 * is settled there is no reason to keep displaying an account number, and a
 * screen that stops showing it is one fewer place to leak it from.
 */
export default async function AdminPayoutsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const store = await getReadyStore();
  const all = await store.listAllPayoutRequests();
  const open = all.filter((r) => r.status === "requested");
  const settled = all.filter((r) => r.status !== "requested").slice(0, 30);

  const ids = [...new Set(all.map((r) => r.influencerId))];
  const [users, details] = await Promise.all([
    ids.length ? store.listUsersByIds(ids) : Promise.resolve([]),
    Promise.all(open.map((r) => store.getPayoutDetails(r.influencerId))),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const detailsById = new Map(
    open.map((r, i) => [r.influencerId, details[i]]).filter(([, d]) => d) as [
      string,
      PayoutDetails,
    ][],
  );

  const owed = open.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">תשלומים</h1>
          <p className="mt-2 text-sm text-mut">בקשות משיכה של משפיענים, וההעברות שכבר בוצעו</p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-deal-deep underline underline-offset-2">
          ← לניהול מערכת
        </Link>
      </div>

      <Card className="mt-6">
        <p className="text-sm font-medium text-mut">ממתין להעברה</p>
        <p className="mt-1 font-sans text-5xl font-semibold leading-none">{formatILS(owed)}</p>
        <p className="mt-2 text-xs text-mut">
          {open.length} {open.length === 1 ? "בקשה פתוחה" : "בקשות פתוחות"}
        </p>
      </Card>

      <SectionTitle>בקשות פתוחות</SectionTitle>
      {open.length === 0 ? (
        <Card>
          <p className="text-sm text-mut">אין בקשות ממתינות. כשמשפיען יבקש משיכה היא תופיע כאן.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {open.map((req) => (
            <OpenRequest
              key={req.id}
              req={req}
              user={byId.get(req.influencerId)}
              details={detailsById.get(req.influencerId)}
            />
          ))}
        </ul>
      )}

      <SectionTitle>היסטוריה</SectionTitle>
      {settled.length === 0 ? (
        <Card>
          <p className="text-sm text-mut">עוד לא בוצעו תשלומים.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">בקשות משיכה שטופלו</caption>
            <thead className="border-b border-line text-start text-xs font-medium text-mut">
              <tr>
                <th scope="col" className="p-3 text-start">משפיען</th>
                <th scope="col" className="p-3 text-start">סכום</th>
                <th scope="col" className="p-3 text-start">תוצאה</th>
                <th scope="col" className="p-3 text-start">מתי</th>
                <th scope="col" className="p-3 text-start">הערה</th>
              </tr>
            </thead>
            <tbody>
              {settled.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="p-3 text-start font-medium">
                    {byId.get(r.influencerId)?.name ?? "—"}
                  </th>
                  <td className="p-3">{formatILS(r.amount)}</td>
                  <td className="p-3">
                    <Badge tone={r.status === "paid" ? "success" : "warning"}>
                      {r.status === "paid" ? "שולם" : "נדחה"}
                    </Badge>
                  </td>
                  <td className="p-3 text-mut">{r.settledAt ? formatDate(r.settledAt) : "—"}</td>
                  <td className="p-3 text-mut">{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function OpenRequest({
  req,
  user,
  details,
}: {
  req: PayoutRequest;
  user?: User;
  details?: PayoutDetails;
}) {
  const settle = settlePayout.bind(null, req.id);

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-3xl leading-none">{user?.name ?? "משפיען לא ידוע"}</h2>
          <p className="font-sans text-3xl font-semibold leading-none">{formatILS(req.amount)}</p>
        </div>
        <p className="mt-1 text-xs text-mut">
          נתבקש ב-{formatDate(req.createdAt)}
          {user?.email ? <> · <span dir="ltr">{user.email}</span></> : null}
        </p>

        {details ? (
          <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl border border-line bg-paper p-3 text-sm sm:grid-cols-2">
            <Detail label="שם בעל החשבון" value={details.legalName} />
            <Detail label="ת.ז. / ח.פ." value={details.nationalId} ltr />
            <Detail label="בנק" value={details.bankName} />
            <Detail label="סניף" value={details.branch} ltr />
            <Detail label="מספר חשבון" value={details.accountNumber} ltr />
            <Detail label="מעמד לצורכי מס" value={TAX_LABELS[details.taxStatus]} />
          </dl>
        ) : (
          <p className="mt-3 rounded-xl border border-deal-deep/40 bg-mark/25 p-3 text-sm font-medium">
            אין פרטי חשבון שמורים למשפיען הזה. צריך לפנות אליו לפני שאפשר להעביר.
          </p>
        )}

        <form action={settle} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1 text-sm">
            <span className="font-medium">הערה (אסמכתא, או סיבת דחייה)</span>
            <input name="note" className={`${inputCls} mt-1`} placeholder="למשל: העברה 4417 מ-3.9" />
          </label>
          <button
            type="submit"
            name="status"
            value="paid"
            disabled={!details}
            className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            סמן כשולם
          </button>
          <button
            type="submit"
            name="status"
            value="rejected"
            className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-4 text-sm font-bold text-ink transition hover:bg-paper"
          >
            דחייה
          </button>
        </form>
        <p className="mt-2 text-xs font-light text-mut">
          ההעברה עצמה מתבצעת בבנק. הסימון כאן סוגר את הבקשה ומעדכן את מה שהמשפיען רואה.
        </p>
      </Card>
    </li>
  );
}

function Detail({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-mut">{label}</dt>
      <dd className="font-medium" dir={ltr ? "ltr" : undefined} style={ltr ? { textAlign: "start" } : undefined}>
        {value}
      </dd>
    </div>
  );
}
