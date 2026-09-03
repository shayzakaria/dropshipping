"use client";

import { useActionState, useState } from "react";
import { reportManualSale, type FormState } from "@/app/actions";
import { btnPrimary, inputCls } from "./ui";

/**
 * Reporting a sale that no checkout told us about.
 *
 * For shops that close orders over WhatsApp, on the phone, or across a
 * counter — which is most small Israeli businesses, and every business that
 * has not wired the API yet. Without this they cannot use the platform at all.
 *
 * Folded shut by default: the API is the route that should feel normal, and a
 * form that types money in by hand should take one deliberate click to reach.
 */
export function ManualSaleForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(reportManualSale, {});
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [orderId, setOrderId] = useState("");

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
          רישום מכירה ידני
        </button>
        <p className="mt-2 text-xs font-light leading-relaxed text-mut">
          למכירה שנסגרה בוואטסאפ, בטלפון או בחנות — כל עוד החנות לא מחוברת ל-API.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm font-light leading-relaxed text-mut">
        מה שנרשם כאן הוא <strong className="font-bold text-ink">חוב אמיתי</strong> לעמלת
        משפיען, בדיוק כמו מכירה שהגיעה מהקופה. אותו חלון ביטול של 14 יום, ואותה
        אפשרות לבטל אם ההזמנה חוזרת.
      </p>

      <label className="block text-sm">
        <span className="font-medium">הקוד שהקונה מסר</span>
        <input
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          dir="ltr"
          placeholder="DEMO-07"
          className={`${inputCls} mt-1 font-mono`}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">סכום ההזמנה לפני ההנחה (₪)</span>
        <input
          name="orderAmount"
          type="number"
          min={1}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className={`${inputCls} tabular mt-1 font-mono`}
        />
        <span className="mt-1 block text-xs font-light text-mut">
          המחיר המלא, לפני שהורדתם את ההנחה. החלוקה מחושבת ממנו.
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">מזהה הקונה (אימייל או טלפון)</span>
        <input
          name="customerRef"
          value={customerRef}
          onChange={(e) => setCustomerRef(e.target.value)}
          dir="ltr"
          className={`${inputCls} mt-1`}
        />
        <span className="mt-1 block text-xs font-light text-mut">
          חובה בקמפיין ללקוחות חדשים בלבד. לא נשמר אצלנו — רק טביעת אצבע שלו.
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">מספר הזמנה אצלכם (אופציונלי)</span>
        <input
          name="externalOrderId"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          dir="ltr"
          className={`${inputCls} mt-1 font-mono`}
        />
        <span className="mt-1 block text-xs font-light text-mut">
          מונע רישום כפול: אותו מספר הזמנה לא ייספר פעמיים.
        </span>
      </label>

      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="rounded-lg border border-ok/40 bg-okbg p-3 text-sm font-medium text-ok" role="status">
          {state.notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "רושם…" : "רישום המכירה"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-4 text-sm font-semibold transition hover:bg-paper"
        >
          סגירה
        </button>
      </div>
    </form>
  );
}
