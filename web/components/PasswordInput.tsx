"use client";

import { useId, useState } from "react";
import { inputCls } from "./ui";

/**
 * A password field you can look at.
 *
 * People mistype passwords on phones constantly, and the usual answer is to
 * make them try again. The eye is not decoration: it turns a failed login into
 * a glance.
 *
 * The button is a real <button type="button"> so it never submits the form,
 * it announces its own state through aria-pressed, and the label says what it
 * will do rather than what it is. The field keeps its autoComplete value in
 * both states so password managers still recognise it.
 */
export function PasswordInput({
  name = "password",
  label,
  autoComplete = "current-password",
  minLength,
  hint,
  required = true,
}: {
  name?: string;
  label: string;
  autoComplete?: "current-password" | "new-password";
  minLength?: number;
  hint?: string;
  required?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          aria-describedby={hintId}
          dir="ltr"
          // Room for the button on the left in RTL, where it sits
          className={`${inputCls} pe-3 ps-12`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-controls={id}
          aria-label={shown ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
          title={shown ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
          className="absolute inset-y-0 start-0 inline-flex w-11 items-center justify-center rounded-s-lg text-mut transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deal-deep"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs font-light text-mut">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M2.2 12S5.7 5.5 12 5.5 21.8 12 21.8 12 18.3 18.5 12 18.5 2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6.3 0 9.8 6.5 9.8 6.5a17 17 0 0 1-3 3.9M6.2 6.2A17 17 0 0 0 2.2 12S5.7 18.5 12 18.5c2 0 3.7-.65 5.1-1.55" />
      <path d="M10.1 10.1a2.7 2.7 0 0 0 3.8 3.8" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
