"use client";

import { useActionState, useState } from "react";
import { addPoolCodes, setCampaignVerified, type FormState } from "@/app/actions";
import { parseCodeListClient } from "@/lib/domain/codes";
import { btnGhost, btnPrimary, inputCls } from "./ui";

/**
 * The codes behind one campaign: how many are left, how to add more, and the
 * one-time confirmation that a code really works at this shop's checkout.
 *
 * Verification gates the campaign rather than merely warning about it. An
 * influencer who publishes a code that fails at checkout pays for it in front
 * of their own audience, and that is not a cost we get to hand them.
 */
export function CampaignCodesPanel({
  campaignId,
  codeSource,
  verified,
  total,
  available,
  sampleCode,
}: {
  campaignId: string;
  codeSource: "pool" | "generated";
  verified: boolean;
  total: number;
  available: number;
  sampleCode?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPoolCodes, {});
  const [raw, setRaw] = useState("");
  const [adding, setAdding] = useState(false);
  const parsed = parseCodeListClient(raw);
  const low = codeSource === "pool" && available <= 5;

  return (
    <div className="mt-3 space-y-2">
      {!verified ? (
        <div className="rounded-lg border-2 border-dashed border-deal-deep/50 bg-mark/25 p-3">
          <p className="text-sm font-bold">הקמפיין עוד לא פורסם למשפיענים</p>
          <p className="mt-1 text-xs leading-relaxed">
            {sampleCode ? (
              <>
                לפני שמשפיען מפרסם קוד לקהל שלו, כדאי לוודא שהוא באמת עובד. קח את{" "}
                <code className="rounded bg-label px-1.5 py-0.5 font-mono font-bold" dir="ltr">
                  {sampleCode}
                </code>{" "}
                ונסה אותו בקופה של החנות שלך.
              </>
            ) : (
              "צריך קודים במאגר לפני שאפשר לבדוק."
            )}
          </p>
          {sampleCode ? (
            <form action={setCampaignVerified.bind(null, campaignId)} className="mt-2">
              <input type="hidden" name="verified" value="yes" />
              <button className={btnPrimary}>בדקתי — הקוד עובד, פרסמו את הקמפיין</button>
            </form>
          ) : null}
        </div>
      ) : null}

      {codeSource === "generated" ? (
        <p className="rounded-lg border border-ink/25 bg-label p-2.5 text-xs leading-relaxed text-mut">
          הקודים מיוצרים על ידי המערכת. זה עובד רק אם החנות שלך מאמתת קודים מולנו
          דרך ה-API.
        </p>
      ) : (
        <div
          className={`rounded-lg border p-2.5 text-xs leading-relaxed ${
            low ? "border-deal-deep/50 bg-mark/25 font-medium text-ink" : "border-ink/25 bg-label text-mut"
          }`}
        >
          <span className="font-mono font-bold tabular-nums">{available}</span> קודים
          פנויים מתוך <span className="font-mono tabular-nums">{total}</span>
          {low ? " — כדאי להוסיף עוד, אחרת משפיענים חדשים לא יוכלו להצטרף." : ""}
          {verified ? (
            <button type="button" onClick={() => setAdding(!adding)} className={`${btnGhost} ms-2 text-xs`}>
              {adding ? "ביטול" : "הוספת קודים"}
            </button>
          ) : null}
        </div>
      )}

      {codeSource === "pool" && (adding || !verified) ? (
        <form action={formAction} className="space-y-1.5">
          <input type="hidden" name="campaignId" value={campaignId} />
          <label className="block text-xs">
            <span className="font-medium">
              {verified ? "קודים נוספים מהחנות שלך" : "הדבקת קודים שיצרת בחנות"}
            </span>
            <textarea
              name="poolCodes"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={3}
              dir="ltr"
              placeholder={"DANA-51\nDANA-52"}
              className={`${inputCls} mt-1 resize-y font-mono text-xs`}
            />
          </label>
          {parsed.length ? (
            <p className="text-xs font-medium" role="status">
              זוהו {parsed.length} קודים.
            </p>
          ) : null}
          {state.error ? (
            <p className="text-xs font-medium text-err" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.notice ? (
            <p className="text-xs font-medium text-ok" role="status">
              {state.notice}
            </p>
          ) : null}
          <button disabled={pending || !parsed.length} className={`${btnGhost} text-xs disabled:opacity-40`}>
            {pending ? "מוסיף…" : "הוספה למאגר"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
