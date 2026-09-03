"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "../actions";
import { btnPrimaryWide, inputCls } from "@/components/ui";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestPasswordReset,
    {},
  );

  // Once the mail is on its way the form is done; leaving it up invites
  // people to send themselves four more and hit the rate limit.
  if (state.notice) {
    return (
      <p className="rounded-lg border border-ok/40 bg-okbg p-3 text-sm font-medium text-ok" role="status">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium">האימייל שאיתו נרשמת</span>
        <input name="email" type="email" autoComplete="email" required dir="ltr" className={`${inputCls} mt-1`} />
      </label>
      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnPrimaryWide}>
        {pending ? "שולח…" : "שליחת קישור"}
      </button>
    </form>
  );
}
