"use client";

import { useActionState } from "react";
import { simulatePurchase, type FormState } from "../actions";
import { btnPrimary, inputCls } from "@/components/ui";

const nis = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
const tierLabel = (t: string) => (t === "GOLD" ? "זהב" : t === "SILVER" ? "כסף" : "ברונזה");

export function SimulatorForm({ demoCode }: { demoCode?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(simulatePurchase, {});

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
          <input name="customerRef" type="email" placeholder="buyer@example.com" className={`${inputCls} mt-1`} dir="ltr" />
        </label>
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
          {pending ? "מחשב…" : "ביצוע קנייה עם הקוד"}
        </button>
      </form>

      {state.error ? (
        <div className="rounded-lg border border-err/40 bg-errbg p-4 text-sm font-medium text-err" role="alert">
          המימוש נדחה: {state.error}
        </div>
      ) : null}

      {state.ok && state.result ? (
        <div className="rounded-lg border border-ok/40 bg-okbg p-4 text-sm">
          <div className="font-bold text-ok">המכירה נרשמה ✓</div>
          <div className="tabular mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <div>
              <div className="font-sans text-mut">סכום קנייה</div>
              <div className="mt-0.5 text-base font-bold">{nis(state.result.orderAmount)}</div>
            </div>
            <div>
              <div className="font-sans text-mut">הנחה לקונה</div>
              <div className="mt-0.5 text-base font-bold">{nis(-state.result.buyerDiscount)}</div>
            </div>
            <div>
              <div className="font-sans text-mut">עמלת המשפיען</div>
              <div className="mt-0.5 text-base font-bold text-deal-deep">{nis(state.result.influencerCommission)}</div>
            </div>
            <div>
              <div className="font-sans text-mut">דמי פלטפורמה</div>
              <div className="mt-0.5 text-base font-bold">{nis(state.result.platformFee)}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-mut">
            מדרגת המשפיען: {tierLabel(state.result.tier)}
            {state.result.tierBonusPct > 0 ? ` (+${state.result.tierBonusPct}% בונוס על חשבון הפלטפורמה)` : ""} ·
            המכירה מופיעה עכשיו בדשבורד של העסק ושל המשפיען.
          </p>
        </div>
      ) : null}
    </div>
  );
}
