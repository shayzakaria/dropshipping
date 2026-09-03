"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_ACCEPT, MAX_LOGO_BYTES } from "@/lib/domain/images";
import { btnGhost } from "./ui";

/**
 * Picking a logo, with the result visible before the form is submitted.
 *
 * A business that uploads a logo wants to know it picked the right file, and
 * "save and see" is a slow way to find out it picked the wrong one. The
 * preview is a local object URL, so nothing is uploaded until save.
 *
 * The pasted-link field stays, in second place: it is still the fastest route
 * for anyone whose logo already lives on their own site.
 */
export function LogoField({
  currentUrl,
  businessName,
}: {
  currentUrl?: string;
  businessName: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  // Controlled, so that removing the logo empties it too. The field is the
  // single source of truth on save: whatever is in it is what gets stored,
  // unless a file was picked, which wins.
  const [url, setUrl] = useState(currentUrl ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // An object URL holds the file in memory until it is handed back.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(file: File | undefined) {
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      setFileName(null);
      setTooBig(false);
      return;
    }
    setFileName(file.name);
    setTooBig(file.size > MAX_LOGO_BYTES);
    setPreview(URL.createObjectURL(file));
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName(null);
    setTooBig(false);
    if (inputRef.current) inputRef.current.value = "";
    setUrl("");
  }

  const shown = preview ?? (url || null);
  const initials = businessName.trim().slice(0, 2) || "??";

  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-medium">הלוגו</legend>

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-paper"
        >
          {shown ? (
            // Not next/image: the source is a blob: URL before save and a
            // storage URL after, and neither wants the optimiser.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-lg font-bold text-mut">{initials}</span>
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="logoFile" className="block text-sm font-medium">
            העלאת קובץ מהמחשב
          </label>
          <input
            ref={inputRef}
            id="logoFile"
            name="logoFile"
            type="file"
            accept={LOGO_ACCEPT}
            onChange={(e) => pick(e.target.files?.[0])}
            className="block w-full text-sm file:me-3 file:rounded-lg file:border file:border-line file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line/40"
          />
          <p className="text-xs font-light text-mut">
            PNG, JPG או WebP, עד 2MB. ריבוע יוצא הכי טוב.
          </p>
          {tooBig ? (
            <p className="text-sm font-medium text-err" role="alert">
              הקובץ הזה גדול מ-2MB ולא ייקלט. צריך לבחור קובץ קטן יותר.
            </p>
          ) : null}
          {fileName ? (
            <p className="text-xs text-mut" role="status">
              נבחר: <span dir="ltr">{fileName}</span> — עוד לא נשמר.
            </p>
          ) : null}
          {shown ? (
            <button type="button" onClick={clear} className={`${btnGhost} text-sm`}>
              הסרת הלוגו
            </button>
          ) : null}
        </div>
      </div>

      <label className="mt-3 block text-sm">
        <span className="font-light text-mut">או קישור לתמונה קיימת</span>
        <input
          name="logoUrl"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://my-shop.co.il/logo.png"
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          dir="ltr"
        />
      </label>
    </fieldset>
  );
}
