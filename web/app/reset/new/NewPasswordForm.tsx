"use client";

import { useActionState } from "react";
import { setNewPassword, type FormState } from "../../actions";
import { PasswordInput } from "@/components/PasswordInput";
import { btnPrimaryWide } from "@/components/ui";

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setNewPassword, {});

  return (
    <form action={formAction} className="space-y-3">
      <PasswordInput
        name="password"
        label="סיסמה חדשה"
        autoComplete="new-password"
        minLength={8}
        hint="8 תווים לפחות. אפשר ללחוץ על העין כדי לוודא שהקלדתם נכון."
      />
      <PasswordInput name="confirm" label="שוב, לוודא" autoComplete="new-password" minLength={8} />
      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnPrimaryWide}>
        {pending ? "שומר…" : "שמירה וכניסה"}
      </button>
    </form>
  );
}
