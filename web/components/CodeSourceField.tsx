"use client";

import { useState } from "react";
import { parseCodeListClient } from "@/lib/domain/codes";
import { inputCls } from "./ui";

/**
 * Where this campaign's codes come from — the field that decides whether the
 * coupon actually works at the buyer's checkout.
 *
 * The default, and the only option that works with an ordinary shop, is that
 * the business creates the codes in its own shop and pastes them here. We deal
 * one out per influencer. The shop recognises them because the shop made them.
 *
 * The alternative is only honest once the shop asks us whether a code is
 * valid, which is a real integration; until then it is the setting that
 * produces "invalid code" at checkout, so it says so plainly.
 */
export function CodeSourceField() {
  const [source, setSource] = useState<"pool" | "generated">("pool");
  const [raw, setRaw] = useState("");
  const codes = parseCodeListClient(raw);

  return (
    <fieldset className="rounded-lg border-2 border-dashed border-ink/30 bg-paper p-3">
      <legend className="px-1 text-sm font-medium">מאיפה מגיעים הקודים?</legend>

      <div className="grid gap-2 sm:grid-cols-2">
        <Choice
          checked={source === "pool"}
          onChange={() => setSource("pool")}
          title="מהחנות שלי (מומלץ)"
          note="אני מייצר קודים בחנות שלי ומדביק אותם כאן. עובד בכל חנות."
          value="pool"
        />
        <Choice
          checked={source === "generated"}
          onChange={() => setSource("generated")}
          title="שהמערכת תייצר"
          note="רק אם החנות שלך שואלת אותנו אם קוד תקף (חיבור API)."
          value="generated"
        />
      </div>

      {source === "pool" ? (
        <div className="mt-3">
          <label className="block text-sm">
            <span className="font-medium">הדבקת הקודים</span>
            <textarea
              name="poolCodes"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              dir="ltr"
              placeholder={"DANA-01\nDANA-02\nDANA-03"}
              className={`${inputCls} mt-1 resize-y font-mono text-sm`}
            />
          </label>
          <p className="mt-1 text-xs font-light leading-relaxed text-mut">
            קוד אחד בכל שורה (גם פסיקים עובדים). קוד אחד לכל משפיען — אז כדאי
            להתחיל עם 20–50. אפשר להוסיף עוד בכל רגע.
          </p>
          <p className="mt-1.5 text-sm font-medium" role="status">
            {codes.length > 0
              ? `זוהו ${codes.length} קודים.`
              : "עוד לא הודבקו קודים."}
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-deal-deep/40 bg-mark/25 p-3 text-sm leading-relaxed">
          <strong>שים לב:</strong> קוד שהמערכת תייצר לא קיים בחנות שלך, והקונה
          יקבל ״קוד לא תקין״ בקופה — אלא אם החנות שלך מחוברת אלינו ושואלת אותנו
          לגבי כל קוד. אם אינך בטוח, בחר באפשרות הראשונה.
        </p>
      )}

      <input type="hidden" name="codeSource" value={source} />
    </fieldset>
  );
}

function Choice({
  checked,
  onChange,
  title,
  note,
  value,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  note: string;
  value: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${
        checked ? "border-deal bg-mark/30" : "border-ink/25 bg-label hover:bg-paper"
      }`}
    >
      <input
        type="radio"
        name="codeSourceChoice"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-6 w-6 flex-none accent-deal-deep"
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs font-light text-mut">{note}</span>
      </span>
    </label>
  );
}
