"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "./icons";

/**
 * The influencer's sharing kit. Every generated message carries the "פרסומת"
 * disclosure: Israeli consumer-protection guidance treats any incentivised
 * recommendation as advertising, so the platform writes the disclosure rather
 * than leaving each influencer to remember it.
 */
export function ShareCode({
  code,
  campaignTitle,
  businessName,
  discountPct,
  storeUrl,
}: {
  code: string;
  campaignTitle: string;
  businessName: string;
  discountPct: number;
  storeUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // The absolute link needs the browser's origin, which the server does not
  // have. Reading window during render made the server print one thing and
  // the client another — React's hydration error #418 — so the origin is
  // picked up after mount and the first render on both sides agrees.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const trackedLink = origin ? `${origin}/r/${code}` : "";

  // The link replaces the bare shop address: it carries the coupon into the
  // cart, so a reader who never types the code still counts as this
  // influencer's sale, and the click registers either way.
  const message = [
    `${campaignTitle} · ${businessName}`,
    `${discountPct}% הנחה עם הקוד ${code}`,
    trackedLink || storeUrl || "",
    "",
    "פרסומת · אני מקבל/ת עמלה על רכישות דרך הקוד",
  ]
    .filter(Boolean)
    .join("\n");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackedLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Clipboard unavailable — the link is shown in full below
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — the message stays visible below to copy by hand
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-label transition hover:bg-ink/85"
        >
          שיתוף בוואטסאפ
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink/30 bg-label px-3 text-xs font-semibold transition hover:bg-paper"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3 w-3 text-ok" /> הועתק
            </>
          ) : (
            "העתקת הודעה מוכנה"
          )}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink/30 bg-label px-3 text-xs font-semibold transition hover:bg-paper"
        >
          {copiedLink ? (
            <>
              <CheckIcon className="h-3 w-3 text-ok" /> הועתק
            </>
          ) : (
            "העתקת הלינק בלבד"
          )}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-mut">
        הלינק שלכם:{" "}
        <code className="font-mono text-ink" dir="ltr">
          /r/{code}
        </code>{" "}
        — הוא מוביל לחנות עם הקוד כבר מוכן, וסופר כמה אנשים לחצו. הספירה היא
        מספר בלבד: לא נשמר מי נכנס.
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-mut">מה ישותף</summary>
        <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-paper p-2.5 text-[11px] leading-relaxed text-mut">
{message}
        </pre>
      </details>
    </div>
  );
}
