"use client";

import { useActionState } from "react";
import { setNotificationPreference, type FormState } from "@/app/actions";
import { btnGhost, btnPrimary } from "./ui";

/**
 * On or off, in one click, with the consequence written next to the button.
 *
 * "Unsubscribe from all" hides which emails someone is giving up. These are
 * money notices, so what they lose is stated: they will stop hearing that a
 * sale happened or that a commission was cancelled.
 */
export function NotificationToggle({ optedOut }: { optedOut: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setNotificationPreference,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="optOut" value={optedOut ? "false" : "true"} />

      {optedOut ? (
        <>
          <p className="text-sm font-bold">הודעות המייל כרגע כבויות.</p>
          <p className="text-sm font-light leading-relaxed text-mut">
            לא נשלח אליך מייל על מכירות, על עמלות שהשתחררו, על ביטולים או על תשלומים.
            הכל ימשיך להופיע בדשבורד — רק בלי מייל.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold">הודעות המייל פעילות.</p>
          <p className="text-sm font-light leading-relaxed text-mut">
            נשלח מייל כשקורה משהו שנוגע לכסף שלך: מכירה חדשה, עמלה שהשתחררה, ביטול,
            או תשלום שיצא. בלי פרסומות ובלי דיוור.
          </p>
        </>
      )}

      {state.notice ? (
        <p className="rounded-lg border border-ok/40 bg-okbg p-3 text-sm font-medium text-ok" role="status">
          {state.notice}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={optedOut ? btnPrimary : btnGhost}>
        {pending ? "שומר…" : optedOut ? "הפעלת ההודעות" : "הפסקת ההודעות"}
      </button>
    </form>
  );
}
