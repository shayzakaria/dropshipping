"use client";

import { useActionState, useState } from "react";
import { issueSettlements, type FormState } from "@/app/actions";
import { btnPrimary, inputCls } from "./ui";

/** Last month, which is what an operator billing on the 1st almost always wants. */
function lastMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function IssueSettlementsForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(issueSettlements, {});
  const [month, setMonth] = useState(lastMonth());

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm font-light leading-relaxed text-mut">
        מחייב כל עסק על מכירות ש<strong className="font-bold text-ink">כבר השתחררו</strong> ועדיין
        לא נכללו בחשבון. מכירה שעוד בתוך חלון הביטול לא מחויבת — היא עשויה לא להיות מכירה.
        הרצה שנייה על אותו חודש לא מחייבת שוב.
      </p>

      <label className="block text-sm">
        <span className="font-medium">חודש החיוב</span>
        <input
          type="month"
          name="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          required
          className={`${inputCls} mt-1 font-mono`}
          dir="ltr"
        />
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

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "מפיק…" : "הפקת חשבונות"}
      </button>
    </form>
  );
}
