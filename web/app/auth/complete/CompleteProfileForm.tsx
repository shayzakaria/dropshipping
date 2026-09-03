"use client";

import { useActionState, useState } from "react";
import { completeOAuthProfile, type FormState } from "../../actions";
import { MegaphoneIcon, StoreIcon } from "@/components/icons";
import { btnPrimaryWide, inputCls } from "@/components/ui";

export function CompleteProfileForm({ suggestedName }: { suggestedName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    completeOAuthProfile,
    {},
  );
  const [role, setRole] = useState<"influencer" | "business">("influencer");

  const roleCls = (active: boolean) =>
    `flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-center text-sm font-semibold transition ${
      active ? "border-deal bg-mark/30 text-ink" : "border-ink/30 bg-label text-mut hover:bg-paper"
    }`;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className={roleCls(role === "influencer")}>
          <input type="radio" name="role" value="influencer" checked={role === "influencer"} onChange={() => setRole("influencer")} className="sr-only" />
          <MegaphoneIcon className="h-4 w-4" />
          אני משפיען/ית
        </label>
        <label className={roleCls(role === "business")}>
          <input type="radio" name="role" value="business" checked={role === "business"} onChange={() => setRole("business")} className="sr-only" />
          <StoreIcon className="h-4 w-4" />
          אני עסק
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">שם מלא</span>
        <input name="name" defaultValue={suggestedName} className={`${inputCls} mt-1`} required />
      </label>
      {role === "business" ? (
        <label className="block text-sm">
          <span className="font-medium">שם העסק</span>
          <input name="businessName" className={`${inputCls} mt-1`} required />
        </label>
      ) : null}
      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnPrimaryWide}>
        {pending ? "רגע…" : "סיום ההרשמה"}
      </button>
    </form>
  );
}
