"use client";

import { useActionState } from "react";
import { updateBusinessProfile, type FormState } from "@/app/actions";
import { btnPrimary, inputCls } from "./ui";
import { LogoField } from "./LogoField";
import type { Business } from "@/lib/domain/types";

/**
 * What the business's directory card will say. Shown with the card's own
 * preview beside it, because "one or two lines about the business" is much
 * easier to write when you can see the box it goes in.
 */
export function BusinessProfileForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateBusinessProfile,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium">שם העסק</span>
        <input name="name" defaultValue={business.name} className={`${inputCls} mt-1`} required />
      </label>

      <label className="block text-sm">
        <span className="font-medium">שתי שורות על העסק</span>
        <textarea
          name="description"
          defaultValue={business.description ?? ""}
          maxLength={300}
          rows={3}
          placeholder="מה אתם מוכרים ולמי. זה מה שיופיע בקטלוג."
          className={`${inputCls} mt-1 resize-y`}
        />
        <span className="mt-1 block text-xs font-light text-mut">
          עד 300 תווים. בלי זה הכרטיס שלכם בקטלוג יהיה שם על רקע ריק.
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">כתובת החנות</span>
        <input
          name="storeUrl"
          type="url"
          defaultValue={business.storeUrl ?? ""}
          placeholder="https://my-shop.co.il"
          className={`${inputCls} mt-1`}
          dir="ltr"
        />
        <span className="mt-1 block text-xs font-light text-mut">
          לכאן מגיעים מהקטלוג, ולכאן מוביל גם לינק המעקב של המשפיענים.
        </span>
      </label>

      {/*
        Keyed on the stored logo so a successful save remounts the field with
        the fresh URL: otherwise the "picked, not saved yet" note stays on
        screen after it has, in fact, been saved.
      */}
      <LogoField
        key={business.logoUrl ?? "none"}
        currentUrl={business.logoUrl}
        businessName={business.name}
      />

      {state.error ? (
        <p className="text-sm font-medium text-err" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="rounded-lg border border-ok/40 bg-okbg p-3 text-sm font-medium text-ok" role="status">
          {state.notice}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "שומר…" : "שמירת הפרופיל"}
      </button>
    </form>
  );
}
