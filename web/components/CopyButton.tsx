"use client";

import { useState } from "react";

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
      className="rounded-md border border-ink/30 bg-label px-2 py-1 text-xs font-semibold text-ink transition hover:bg-paper"
    >
      {copied ? "הועתק ✓" : "העתקה"}
    </button>
  );
}
