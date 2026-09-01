"use client";

import { useActionState, useState } from "react";
import { register, type FormState } from "../actions";
import { MegaphoneIcon, StoreIcon } from "@/components/icons";
import { btnPrimary, inputCls } from "@/components/ui";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(register, {});
  const [role, setRole] = useState<"influencer" | "business">("influencer");

  const roleCls = (active: boolean) =>
    `flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-center text-sm font-semibold transition ${
      active
        ? "border-deal bg-mark/30 text-ink"
        : "border-ink/30 bg-label text-mut hover:bg-paper"
    }`;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className={roleCls(role === "influencer")}>
          <input
            type="radio"
            name="role"
            value="influencer"
            checked={role === "influencer"}
            onChange={() => setRole("influencer")}
            className="hidden"
          />
          <MegaphoneIcon className="h-4 w-4" />
          אני משפיען/ית
        </label>
        <label className={roleCls(role === "business")}>
          <input
            type="radio"
            name="role"
            value="business"
            checked={role === "business"}
            onChange={() => setRole("business")}
            className="hidden"
          />
          <StoreIcon className="h-4 w-4" />
          אני עסק
        </label>
      </div>
      <input name="name" placeholder="שם מלא" className={inputCls} required />
      <input name="email" type="email" placeholder="אימייל" className={inputCls} required dir="ltr" />
      {role === "business" && (
        <>
          <input name="businessName" placeholder="שם העסק" className={inputCls} />
          <input name="storeUrl" placeholder="כתובת החנות (אופציונלי)" className={inputCls} dir="ltr" />
        </>
      )}
      {state.error ? <p className="text-sm font-medium text-err">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "רגע…" : "הרשמה וכניסה"}
      </button>
    </form>
  );
}
