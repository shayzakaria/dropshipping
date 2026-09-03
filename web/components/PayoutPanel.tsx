"use client";

import { useActionState, useState } from "react";
import { requestPayout, savePayoutDetails, type FormState } from "@/app/actions";
import { btnPrimary, btnPrimaryWide, inputCls } from "./ui";
import type { PayoutDetails, PayoutRequest } from "@/lib/domain/types";
import { formatILS } from "@/lib/format";

const BANKS = [
  "בנק הפועלים", "בנק לאומי", "בנק דיסקונט", "מזרחי טפחות", "הבינלאומי",
  "בנק ירושלים", "בנק מרכנתיל", "יובנק", "בנק אגוד", "וואן זירו", "בנק הדואר",
];

const TAX = [
  { value: "exempt", label: "עוסק פטור", hint: "מחזור שנתי מתחת לסף. תוציאו לנו קבלה." },
  { value: "licensed", label: "עוסק מורשה", hint: "תוציאו לנו חשבונית מס." },
  { value: "none", label: "עדיין אין לי תיק", hint: "אפשר להתחיל; לפני התשלום נסביר מה צריך." },
];

/**
 * The money panel: what is waiting, what is ready, and how to get it out.
 *
 * The details form only unfolds when there is something to withdraw. Asking a
 * new influencer for a bank account and an ID number before they have earned
 * a shekel is the fastest way to make them close the tab, and none of it is
 * needed until a transfer is actually about to happen.
 */
export function PayoutPanel({
  available,
  pending,
  isSmallPayout,
  recommendedPayout,
  canWithdraw,
  details,
  requests,
}: {
  available: number;
  pending: number;
  isSmallPayout: boolean;
  recommendedPayout: number;
  canWithdraw: boolean;
  details: PayoutDetails | null;
  requests: PayoutRequest[];
}) {
  const [state, formAction, saving] = useActionState<FormState, FormData>(savePayoutDetails, {});
  const [editing, setEditing] = useState(false);
  const openRequest = requests.find((r) => r.status === "requested");

  if (!canWithdraw && !details && requests.length === 0) {
    return (
      <p className="text-sm font-light leading-relaxed text-mut">
        ברגע שתשתחרר העמלה הראשונה שלך יופיע כאן טופס קצר עם פרטי ההעברה. עד אז
        אין מה למלא — הכסף פשוט מצטבר.
        {pending > 0 ? ` כרגע ${formatILS(pending)} בהמתנה.` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {openRequest ? (
        <p className="rounded-lg border border-ok/40 bg-okbg p-3 text-sm font-medium text-ok" role="status">
          בקשת משיכה על {formatILS(openRequest.amount)} נשלחה ומחכה להעברה. נעדכן אותך
          כאן ברגע שהיא בוצעה.
        </p>
      ) : null}

      {details && !editing ? (
        <div className="rounded-lg border border-ink/25 bg-paper p-3 text-sm">
          <p className="font-semibold">פרטי ההעברה שלך</p>
          <p className="mt-1 text-xs leading-relaxed text-mut">
            {details.legalName} · {details.bankName} · סניף {details.branch} · חשבון{" "}
            <span dir="ltr">••••{details.accountNumber.slice(-4)}</span>
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-xs font-semibold text-deal-deep underline underline-offset-2"
          >
            עדכון הפרטים
          </button>
        </div>
      ) : null}

      {!details || editing ? (
        <form action={formAction} className="space-y-3">
          <p className="text-sm font-light leading-relaxed text-mut">
            לאן להעביר את הכסף. הפרטים האלה נשמרים מוצפנים, לא מוצגים לאף עסק, ומשמשים
            אך ורק להעברה.
          </p>
          <label className="block text-sm">
            <span className="font-medium">שם מלא כפי שמופיע בבנק</span>
            <input name="legalName" defaultValue={details?.legalName ?? ""} required className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">תעודת זהות</span>
            <input name="nationalId" defaultValue={details?.nationalId ?? ""} inputMode="numeric" required className={`${inputCls} mt-1 font-mono`} dir="ltr" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium">בנק</span>
              <select name="bankName" defaultValue={details?.bankName ?? ""} required className={`${inputCls} mt-1`}>
                <option value="">בחרו…</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">סניף</span>
              <input name="branch" defaultValue={details?.branch ?? ""} inputMode="numeric" required className={`${inputCls} mt-1 font-mono`} dir="ltr" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">מספר חשבון</span>
              <input name="accountNumber" defaultValue={details?.accountNumber ?? ""} inputMode="numeric" required className={`${inputCls} mt-1 font-mono`} dir="ltr" />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">מעמד לצורכי מס</legend>
            <div className="mt-1.5 space-y-1.5">
              {TAX.map((t) => (
                <label key={t.value} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink/25 bg-label p-2.5 text-sm transition hover:bg-paper">
                  <input type="radio" name="taxStatus" value={t.value} defaultChecked={details?.taxStatus === t.value} required className="mt-0.5 h-5 w-5 flex-none accent-deal-deep" />
                  <span>
                    <span className="block font-semibold">{t.label}</span>
                    <span className="block text-xs font-light text-mut">{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {state.error ? <p className="text-sm font-medium text-err" role="alert">{state.error}</p> : null}
          {state.notice ? <p className="rounded-lg border border-ok/40 bg-okbg p-3 text-sm font-medium text-ok" role="status">{state.notice}</p> : null}
          <button type="submit" disabled={saving} className={btnPrimaryWide}>
            {saving ? "שומר…" : "שמירת פרטי התשלום"}
          </button>
        </form>
      ) : null}

      {details && !openRequest && canWithdraw ? (
        <form action={requestPayout}>
          <button className={btnPrimary}>בקשת משיכה · {formatILS(available)}</button>
          {/*
            A small balance is a recommendation, never a lock: the money has
            cleared its hold and it is theirs. We say what it costs them and
            let them decide.
          */}
          {isSmallPayout ? (
            <p className="mt-1.5 text-xs leading-relaxed text-mut">
              אפשר למשוך כל סכום, גם עכשיו. ההמלצה שלנו היא לחכות ל־
              {formatILS(recommendedPayout)} בערך — עמלת ההעברה של הבנק נגסת אותו דבר
              בסכום קטן ובסכום גדול, אז בסכומים קטנים היא מרגישה הרבה יותר. ההחלטה שלך.
            </p>
          ) : null}
        </form>
      ) : null}

      {requests.length > 0 ? (
        <div>
          <p className="text-sm font-semibold">היסטוריית משיכות</p>
          <ul className="mt-1.5 divide-y divide-ink/10 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-mono tabular-nums">{formatILS(r.amount)}</span>
                <span className="text-xs text-mut">
                  {r.status === "paid" ? "שולם" : r.status === "rejected" ? `נדחה${r.note ? ` — ${r.note}` : ""}` : "ממתין להעברה"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
