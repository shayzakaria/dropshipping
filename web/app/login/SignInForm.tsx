"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type FormState } from "../actions";
import { PasswordInput } from "@/components/PasswordInput";
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
      <PasswordInput label="סיסמה" autoComplete="current-password" />
      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnPrimaryWide}>
        {pending ? "רגע…" : "כניסה"}
      </button>
      <p className="text-center text-sm">
        <Link href="/reset" className="font-semibold text-deal-deep underline underline-offset-2">
          שכחתי סיסמה
        </Link>
      </p>
    </form>
  );
}
