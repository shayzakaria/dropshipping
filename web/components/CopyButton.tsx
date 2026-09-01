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
      className="rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10"
    >
      {copied ? "הועתק ✓" : "העתק"}
    </button>
  );
}
