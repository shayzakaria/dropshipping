"use client";

import { useActionState } from "react";
import { simulatePurchase, type FormState } from "../actions";
import { Barcode } from "@/components/Barcode";
import { CheckIcon } from "@/components/icons";
import { btnPrimaryWide, inputCls } from "@/components/ui";
import { formatILS } from "@/lib/format";

const round2 = (n: number) => Math.round(n * 100) / 100;
const tierLabel = (t: string) => (t === "GOLD" ? "זהב" : t === "SILVER" ? "כסף" : "ברונזה");

export function SimulatorForm({ demoCode }: { demoCode?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(simulatePurchase, {});
  const r = state.result;
  const totalCost = r ? round2(r.buyerDiscount + r.influencerCommission + r.platformFee) : 0;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium">קוד קופון</span>
          <input
            name="code"
            placeholder="XXXX-XXXX"
            defaultValue={demoCode}
            className={`${inputCls} mt-1 font-mono tracking-widest`}
            dir="ltr"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">סכום הקנייה (₪)</span>
          <input type="number" name="orderAmount" min={1} step="0.01" defaultValue={300} className={`${inputCls} tabular mt-1 font-mono`} required />
        </label>
        <label className="block text-sm">
          <span className="font-medium">אימייל הקונה (לבדיקת לקוח חדש והגנה מהונאות)</span>
          <input name="customerRef" type="email" placeholder="buyer@example.com" className={`${inputCls} mt-1`} dir="ltr" required />
          <span className="mt-1 block text-xs font-light text-mut">
            לא נשמר אצלנו — רק טביעת אצבע מוצפנת שלו, לבדיקה אם הקונה כבר קנה בעסק.
          </span>
        </label>
        <button type="submit" disabled={pending} className={btnPrimaryWide}>
          {pending ? "מחשב…" : "ביצוע קנייה עם הקוד"}
        </button>
      </form>

      {state.error ? (
        <div className="rounded-lg border border-err/40 bg-errbg p-4 text-sm font-medium text-err" role="alert">
          המימוש נדחה: {state.error}
        </div>
      ) : null}

      {state.ok && r ? (
        /* המכירה מודפסת כתווית פיצול — בדיוק כמו שההבטחה בעמוד הבית נראית */
        <div className="label-card relative p-0" role="status">
          <div className="tape absolute -top-3 right-8 h-6 w-20 -rotate-2" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/25 px-5 py-3">
            <div className="flex items-center gap-2 font-bold text-ok">
              <CheckIcon className="h-5 w-5" /> המכירה נרשמה
            </div>
            <div className="w-24 text-ink">
              <Barcode seed={r.code} height={20} />
              <div className="mt-0.5 text-center font-mono text-[11px] font-semibold tracking-widest" dir="ltr">
                {r.code}
              </div>
            </div>
          </div>
          <dl className="tabular px-5 py-4 text-sm">
            <div className="flex items-baseline justify-between py-1.5">
              <dt className="text-mut">סכום הקנייה</dt>
              <dd className="font-mono font-semibold" dir="ltr">{formatILS(r.orderAmount)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-1.5">
              <dt>הנחה לקונה</dt>
              <dd className="font-mono font-semibold" dir="ltr">{formatILS(-r.buyerDiscount)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-1.5">
              <dt>עמלת המשפיען</dt>
              <dd className="font-mono font-bold text-deal-deep" dir="ltr">{formatILS(r.influencerCommission)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-1.5">
              <dt>דמי פלטפורמה</dt>
              <dd className="font-mono font-semibold" dir="ltr">{formatILS(r.platformFee)}</dd>
            </div>
          </dl>
          <div className="perforation mx-5" aria-hidden="true" />
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
            <span className="font-bold">העסק שילם {formatILS(totalCost)}</span>
            <span className="text-sm text-mut">רק כי המכירה קרתה</span>
          </div>
          <p className="border-t border-dashed border-ink/25 px-5 py-3 text-xs text-mut">
            מדרגת המשפיען: {tierLabel(r.tier)}
            {r.tierBonusPct > 0 ? ` (+${r.tierBonusPct}% בונוס על חשבון הפלטפורמה)` : ""} · המכירה מופיעה
            עכשיו בדשבורד של העסק ושל המשפיען.
          </p>
        </div>
      ) : null}
    </div>
  );
}
