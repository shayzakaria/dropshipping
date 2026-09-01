"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "../actions";
import { btnPrimaryWide, inputCls } from "@/components/ui";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium">אימייל</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className={`${inputCls} mt-1`}
          dir="ltr"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">סיסמה</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className={`${inputCls} mt-1`}
          dir="ltr"
          required
        />
      </label>
      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnPrimaryWide}>
        {pending ? "רגע…" : "כניסה"}
      </button>
    </form>
  );
}
