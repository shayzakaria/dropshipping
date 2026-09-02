"use client";

import { useActionState, useMemo, useState } from "react";
import { createCampaign, type FormState } from "../../actions";
import { btnPrimary, inputCls } from "@/components/ui";
import { computeSplit } from "@/lib/domain/logic";
import { formatILS as nis } from "@/lib/format";

const EXAMPLE_ORDER = 300;

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
          <span className="font-medium">הנחה לקונה (%)</span>
          <input
            type="number"
            name="buyerDiscountPct"
            value={buyerDiscountPct}
            onChange={(e) => setBuyerDiscountPct(Number(e.target.value))}
            min={1}
            max={40}
            className={`${inputCls} tabular mt-1 font-mono`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">עמלת משפיען (%)</span>
          <input
            type="number"
            name="influencerPct"
            value={influencerPct}
            onChange={(e) => setInfluencerPct(Number(e.target.value))}
            min={1}
            max={30}
            className={`${inputCls} tabular mt-1 font-mono`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">דמי פלטפורמה (%)</span>
          <input
            type="number"
            name="platformPct"
            value={platformPct}
            readOnly
            aria-describedby="platform-pct-note"
            className={`${inputCls} tabular mt-1 cursor-not-allowed bg-paper font-mono text-mut`}
          />
          <span id="platform-pct-note" className="mt-1 block text-xs font-light text-mut">
            קבוע ולא ניתן לשינוי — מתוכו ממומנים בונוסי המדרגות של המשפיענים.
          </span>
        </label>
      </div>

      <div className="rounded-lg border-2 border-dashed border-ink/30 bg-paper p-4 text-sm">
        <div className="font-bold">
          תצוגה מקדימה — קנייה של {nis(EXAMPLE_ORDER)} · סך הטבה {totalPct}%
        </div>
        {preview ? (
          <div className="tabular mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <div>
              <div className="font-sans text-mut">הקונה חוסך</div>
              <div className="mt-0.5 text-base font-bold">{nis(preview.buyerDiscount)}</div>
            </div>
            <div>
              <div className="font-sans text-mut">המשפיען מקבל</div>
              <div className="mt-0.5 text-base font-bold text-deal-deep">{nis(preview.influencerCommission)}</div>
            </div>
            <div>
              <div className="font-sans text-mut">הפלטפורמה</div>
              <div className="mt-0.5 text-base font-bold">{nis(preview.platformFee)}</div>
            </div>
            <div>
              <div className="font-sans text-mut">נשאר לעסק</div>
              <div className="mt-0.5 text-base font-bold">{nis(EXAMPLE_ORDER - preview.businessTotalCost)}</div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs font-medium text-err">האחוזים לא תקינים</p>
        )}
        <p className="mt-3 text-xs text-mut">
          בונוסים למשפיענים מצטיינים ממומנים מדמי הפלטפורמה — העלות שלך לא משתנה.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 py-1 text-sm">
        <input
          type="checkbox"
          name="newCustomersOnly"
          defaultChecked
          className="mt-0.5 h-6 w-6 flex-none accent-deal-deep"
        />
        הקופון תקף ללקוחות חדשים בלבד (מומלץ — מונע הנחות ללקוחות שהיו קונים ממילא)
      </label>

      <label className="block text-sm">
        <span className="font-medium">תקרת מימושים חודשית (אופציונלי — רשת ביטחון לתקציב)</span>
        <input type="number" name="maxRedemptionsPerMonth" min={1} placeholder="ללא תקרה" className={`${inputCls} tabular mt-1 font-mono`} />
      </label>

      {state.error ? <p className="text-sm font-medium text-err">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "יוצר…" : "יצירת קמפיין"}
      </button>
    </form>
  );
}
