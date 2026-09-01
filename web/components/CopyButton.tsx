"use client";

import { useState } from "react";
import { CheckIcon } from "./icons";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable (e.g. http) — ignore
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-ink/30 bg-label px-2 py-1 text-xs font-semibold text-ink transition hover:bg-paper"
    >
      {copied ? (
        <>
          <CheckIcon className="h-3 w-3 text-ok" /> הועתק
        </>
      ) : (
        "העתקה"
      )}
    </button>
  );
}
