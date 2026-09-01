"use client";

import { useActionState } from "react";
import { simulatePurchase, type FormState } from "../actions";
import { btnPrimary, inputCls } from "@/components/ui";

const nis = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export function SimulatorForm({ demoCode }: { demoCode?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(simulatePurchase, {});

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-300">קוד קופון</span>
          <input
            name="code"
            placeholder="XXXX-XXXX"
            defaultValue={demoCode}
            className={`${inputCls} mt-1 tracking-widest`}
            dir="ltr"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">סכום הקנייה (₪)</span>
          <input type="number" name="orderAmount" min={1} step="0.01" defaultValue={300} className={`${inputCls} mt-1`} required />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">אימייל הקונה (לבדיקת לקוח חדש והגנה מהונאות)</span>
          <input name="customerRef" type="email" placeholder="buyer@example.com" className={`${inputCls} mt-1`} dir="ltr" />
        </label>
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
          {pending ? "מחשב…" : "בצע קנייה עם הקוד"}
        </button>
      </form>

      {state.error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-300">
          ❌ המימוש נדחה: {state.error}
        </div>
      ) : null}

      {state.ok && state.result ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm">
          <div className="font-bold text-emerald-300">✓ המכירה נרשמה!</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <div className="text-slate-400">סכום קנייה</div>
              <div className="text-base font-bold">{nis(state.result.orderAmount)}</div>
            </div>
            <div>
              <div className="text-slate-400">הנחה לקונה</div>
              <div className="text-base font-bold text-emerald-300">-{nis(state.result.buyerDiscount)}</div>
            </div>
            <div>
              <div className="text-slate-400">עמלת המשפיען</div>
              <div className="text-base font-bold text-indigo-300">{nis(state.result.influencerCommission)}</div>
            </div>
            <div>
              <div className="text-slate-400">דמי פלטפורמה</div>
              <div className="text-base font-bold">{nis(state.result.platformFee)}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            מדרגת המשפיען: {state.result.tier}
            {state.result.tierBonusPct > 0 ? ` (+${state.result.tierBonusPct}% בונוס על חשבון הפלטפורמה)` : ""} ·
            המכירה מופיעה עכשיו בדשבורד של העסק ושל המשפיען.
          </p>
        </div>
      ) : null}
    </div>
  );
}
