"use client";

import { useActionState, useMemo, useState } from "react";
import { createCampaign, type FormState } from "../../actions";
import { btnPrimary, inputCls } from "@/components/ui";
import { computeSplit } from "@/lib/domain/logic";
import { formatILS as nis } from "@/lib/format";
import { CodeSourceField } from "@/components/CodeSourceField";

const EXAMPLE_ORDER = 300;

export function CampaignForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCampaign, {});
  const [buyerDiscountPct, setBuyerDiscountPct] = useState(10);
  const [influencerPct, setInfluencerPct] = useState(7);
  const [platformPct] = useState(3);
  const [scope, setScope] = useState<"store" | "product">("store");
  /*
   * Every field is controlled, including the plain text ones.
   *
   * React resets an uncontrolled form after a form action resolves — which is
   * right after a successful submit and badly wrong after a rejected one. A
   * business that filled this whole form and got one validation error would
   * find every field blank, including the fields that were fine.
   */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCustomersOnly, setNewCustomersOnly] = useState(true);
  const [maxPerMonth, setMaxPerMonth] = useState("");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");

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
      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="שם הקמפיין (למשל: השקת קולקציית חורף)"
        className={inputCls}
        required
      />
      <textarea
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="תיאור קצר שמשפיענים יראו (אופציונלי)"
        className={`${inputCls} min-h-20`}
      />

      {/*
        What the code covers is the first thing an influencer tells their
        audience, and the first thing a buyer is disappointed by at checkout
        if it was wrong. So it is asked here, not left to be discovered.
      */}
      <fieldset className="rounded-lg border-2 border-dashed border-ink/30 bg-paper p-3">
        <legend className="px-1 text-sm font-medium">על מה הקוד תקף?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${scope === "store" ? "border-deal bg-mark/30" : "border-ink/25 bg-label hover:bg-paper"}`}>
            <input type="radio" name="scope" value="store" checked={scope === "store"} onChange={() => setScope("store")} className="mt-0.5 h-6 w-6 flex-none accent-deal-deep" />
            <span>
              <span className="block font-semibold">כל החנות</span>
              <span className="block text-xs font-light text-mut">כל קנייה עם הקוד מזכה בעמלה.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${scope === "product" ? "border-deal bg-mark/30" : "border-ink/25 bg-label hover:bg-paper"}`}>
            <input type="radio" name="scope" value="product" checked={scope === "product"} onChange={() => setScope("product")} className="mt-0.5 h-6 w-6 flex-none accent-deal-deep" />
            <span>
              <span className="block font-semibold">מוצר ספציפי</span>
              <span className="block text-xs font-light text-mut">הקוד מקדם פריט אחד; החנות אוכפת את זה בקופה.</span>
            </span>
          </label>
        </div>
        {scope === "product" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              name="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="שם המוצר"
              className={inputCls}
              required
            />
            <input
              name="productUrl"
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="קישור למוצר (אופציונלי)"
              className={inputCls}
              dir="ltr"
            />
          </div>
        ) : null}
      </fieldset>

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
            aria-describedby="buyer-pct-note"
            className={`${inputCls} tabular mt-1 font-mono`}
          />
          <span id="buyer-pct-note" className="mt-1 block text-xs font-light text-mut">
            אתם בוחרים, 1% עד 40%. אפשר קמפיין נדיב ואפשר צנוע — ובקמפיין הבא אחרת.
          </span>
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
            aria-describedby="influencer-pct-note"
            className={`${inputCls} tabular mt-1 font-mono`}
          />
          <span id="influencer-pct-note" className="mt-1 block text-xs font-light text-mut">
            גם זה שלכם, 1% עד 30%. ככל שיותר גבוה, כך יותר משפיענים יבחרו לקדם.
          </span>
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

      <CodeSourceField />

      <label className="flex cursor-pointer items-start gap-2.5 py-1 text-sm">
        <input
          type="checkbox"
          name="newCustomersOnly"
          checked={newCustomersOnly}
          onChange={(e) => setNewCustomersOnly(e.target.checked)}
          className="mt-0.5 h-6 w-6 flex-none accent-deal-deep"
        />
        הקופון תקף ללקוחות חדשים בלבד (מומלץ — מונע הנחות ללקוחות שהיו קונים ממילא)
      </label>

      <label className="block text-sm">
        <span className="font-medium">תקרת מימושים חודשית (אופציונלי — רשת ביטחון לתקציב)</span>
        <input
          type="number"
          name="maxRedemptionsPerMonth"
          value={maxPerMonth}
          onChange={(e) => setMaxPerMonth(e.target.value)}
          min={1}
          placeholder="ללא תקרה"
          className={`${inputCls} tabular mt-1 font-mono`}
        />
      </label>

      {state.error ? <p className="text-sm font-medium text-err">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "יוצר…" : "יצירת קמפיין"}
      </button>
    </form>
  );
}
