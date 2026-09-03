"use client";

import { useState } from "react";
import { settleStatement } from "@/app/actions";
import { inputCls } from "./ui";

/**
 * Closing one statement: collected, or issued by mistake.
 *
 * Cancelling is not a delete — it releases the sales it covered back onto the
 * next statement, so a bill sent in error does not swallow the money it named.
 * It asks for confirmation because it moves real debt between periods.
 */
export function SettleStatementForm({ settlementId }: { settlementId: string }) {
  const settle = settleStatement.bind(null, settlementId);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={settle} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-56 flex-1 text-sm">
        <span className="font-medium">הערה (אסמכתא, או סיבת ביטול)</span>
        <input name="note" className={`${inputCls} mt-1`} placeholder="למשל: העברה 8823 מ-10.9" />
      </label>

      <button
        type="submit"
        name="status"
        value="paid"
        className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85"
      >
        סמן כשולם
      </button>

      {confirming ? (
        <button
          type="submit"
          name="status"
          value="cancelled"
          className="inline-flex min-h-11 items-center rounded-lg border border-err/50 bg-errbg px-4 text-sm font-bold text-err transition hover:bg-errbg/70"
        >
          כן, לבטל את החשבון
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-4 text-sm font-bold text-ink transition hover:bg-paper"
        >
          ביטול החשבון
        </button>
      )}
    </form>
  );
}
