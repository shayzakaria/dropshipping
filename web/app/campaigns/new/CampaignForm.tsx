"use client";

import { useActionState, useMemo, useState } from "react";
import { createCampaign, type FormState } from "../../actions";
import { btnPrimary, inputCls } from "@/components/ui";
import { computeSplit } from "@/lib/domain/logic";

const EXAMPLE_ORDER = 300;
const nis = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export function CampaignForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCampaign, {});
  const [buyerDiscountPct, setBuyerDiscountPct] = useState(10);
  const [influencerPct, setInfluencerPct] = useState(7);
  const [platformPct] = useState(3);

  const preview = useMemo(() => {
    try {
      return computeSplit(EXAMPLE_ORDER, { buyerDiscountPct, influencerPct, platformPct });
    } catch {
      return null;
    }
  }, [buyerDiscountPct, influencerPct, platformPct]);
  const totalPct = buyerDiscountPct + influencerPct + platformPct;

  return (
    <form action={formAction} className="space-y-4">
      <input name="title" placeholder="שם הקמפיין (למשל: השקת קולקציית חורף)" className={inputCls} required />
      <textarea
        name="description"
        placeholder="תיאור קצר שמשפיענים יראו (אופציונלי)"
        className={`${inputCls} min-h-20`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-slate-300">הנחה לקונה (%)</span>
          <input
            type="number"
            name="buyerDiscountPct"
            value={buyerDiscountPct}
            onChange={(e) => setBuyerDiscountPct(Number(e.target.value))}
            min={1}
            max={40}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">עמלת משפיען (%)</span>
          <input
            type="number"
            name="influencerPct"
            value={influencerPct}
            onChange={(e) => setInfluencerPct(Number(e.target.value))}
            min={1}
            max={30}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">דמי פלטפורמה (%)</span>
          <input
            type="number"
            name="platformPct"
            value={platformPct}
            readOnly
            className={`${inputCls} mt-1 opacity-60`}
          />
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="font-semibold">
          תצוגה מקדימה — קנייה של {nis(EXAMPLE_ORDER)} · סך הטבה {totalPct}%
        </div>
        {preview ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <div className="text-slate-400">הקונה חוסך</div>
              <div className="font-bold text-emerald-300">{nis(preview.buyerDiscount)}</div>
            </div>
            <div>
              <div className="text-slate-400">המשפיען מקבל</div>
              <div className="font-bold text-indigo-300">{nis(preview.influencerCommission)}</div>
            </div>
            <div>
              <div className="text-slate-400">הפלטפורמה</div>
              <div className="font-bold">{nis(preview.platformFee)}</div>
            </div>
            <div>
              <div className="text-slate-400">נשאר לעסק</div>
              <div className="font-bold">{nis(EXAMPLE_ORDER - preview.businessTotalCost)}</div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-rose-400">האחוזים לא תקינים</p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          בונוסים למשפיענים מצטיינים ממומנים מדמי הפלטפורמה — העלות שלך לא משתנה.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="newCustomersOnly" defaultChecked className="accent-emerald-400" />
        הקופון תקף ללקוחות חדשים בלבד (מומלץ — מונע הנחות ללקוחות שהיו קונים ממילא)
      </label>

      <label className="block text-sm">
        <span className="text-slate-300">תקרת מימושים חודשית (אופציונלי — רשת ביטחון לתקציב)</span>
        <input type="number" name="maxRedemptionsPerMonth" min={1} placeholder="ללא תקרה" className={`${inputCls} mt-1`} />
      </label>

      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "יוצר…" : "יצירת קמפיין"}
      </button>
    </form>
  );
}
