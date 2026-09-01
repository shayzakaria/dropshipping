"use client";

import { useActionState, useState } from "react";
import { register, type FormState } from "../actions";
import { btnPrimary, inputCls } from "@/components/ui";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(register, {});
  const [role, setRole] = useState<"influencer" | "business">("influencer");

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label
          className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold transition ${
            role === "influencer"
              ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
              : "border-white/15 text-slate-300 hover:bg-white/5"
          }`}
        >
          <input
            type="radio"
            name="role"
            value="influencer"
            checked={role === "influencer"}
            onChange={() => setRole("influencer")}
            className="hidden"
          />
          📣 אני משפיען/ית
        </label>
        <label
          className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold transition ${
            role === "business"
              ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
              : "border-white/15 text-slate-300 hover:bg-white/5"
          }`}
        >
          <input
            type="radio"
            name="role"
            value="business"
            checked={role === "business"}
            onChange={() => setRole("business")}
            className="hidden"
          />
          🏪 אני עסק
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
      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "רגע…" : "הרשמה וכניסה"}
      </button>
    </form>
  );
}
