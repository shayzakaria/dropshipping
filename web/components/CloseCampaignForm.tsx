"use client";

import { useState } from "react";
import { setCampaignState } from "@/app/actions";
import { btnGhost } from "./ui";

/**
 * Closing is one-way, so it asks first — inline, on the card, rather than
 * through a browser confirm() that a screen reader announces out of context
 * and that says nothing about what closing actually does.
 */
export function CloseCampaignForm({ campaignId, title }: { campaignId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={btnGhost}
        aria-label={`סגירת הקמפיין ${title}`}
      >
        סגירת קמפיין
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`אישור סגירת הקמפיין ${title}`}
      className="w-full rounded-lg border border-err/40 bg-errbg p-3"
    >
      <p className="text-xs font-medium leading-relaxed text-err">
        לסגור את ״{title}״ לצמיתות? אי אפשר לפתוח אותו מחדש. הקודים יפסיקו לעבוד
        מיד, ועמלות שכבר נצברו ישולמו כרגיל. אם רק רציתם הפסקה — השהיה עדיפה.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <form action={setCampaignState.bind(null, campaignId, "closed")}>
          <button className="inline-flex min-h-11 items-center rounded-lg bg-err px-4 text-sm font-bold text-label transition hover:opacity-90">
            כן, לסגור לצמיתות
          </button>
        </form>
        <button type="button" onClick={() => setConfirming(false)} className={btnGhost}>
          ביטול
        </button>
      </div>
    </div>
  );
}
