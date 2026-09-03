import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import { NotificationToggle } from "@/components/NotificationToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "הודעות | BOOST", robots: { index: false, follow: false } };

const KIND_LABELS: Record<string, string> = {
  sale: "מכירה חדשה",
  commission_released: "עמלה זמינה למשיכה",
  commission_cancelled: "עמלה בוטלה",
  payout_paid: "תשלום בוצע",
  influencer_joined: "משפיען הצטרף",
  pool_low: "מאגר קודים מתרוקן",
  statement_issued: "חשבון חודשי",
};

/**
 * The off switch, and the record of what was actually sent.
 *
 * Showing the history is the point as much as the toggle: "לא קיבלתי מייל" is
 * the most common support question about notifications anywhere, and this page
 * answers it without anyone having to ask.
 */
export default async function NotificationSettings() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const store = await getReadyStore();
  const sent = await store.listNotifications(user.id, 25);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-6xl leading-none">הודעות</h1>
      <p className="mt-2 text-sm text-mut">מה נשלח אליך, ואיך להפסיק</p>

      <Card className="mt-6">
        <NotificationToggle optedOut={Boolean(user.emailOptOut)} />
      </Card>

      <SectionTitle>מה נשלח אליך</SectionTitle>
      {sent.length === 0 ? (
        <Card>
          <p className="text-sm text-mut">עוד לא נשלחה אליך אף הודעה.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-ink/10">
            {sent.map((n) => (
              <li key={n.id} className="p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{n.subject}</span>
                  <span className="text-xs text-mut">
                    {KIND_LABELS[n.kind] ?? n.kind} · {formatDate(n.createdAt)}
                    {n.status === "failed" ? " · לא נשלח" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
