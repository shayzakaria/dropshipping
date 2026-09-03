/**
 * Sending one email, or convincingly pretending to.
 *
 * With RESEND_API_KEY set, mail goes out through Resend. Without it, every
 * message is written to the server log instead and reported as sent. That is
 * deliberate: the notification code has to be exercisable — in tests, in local
 * development, and on a deploy where the key has not been added yet — without
 * either silently dropping mail or refusing to run.
 *
 * The one thing this never does is throw. A failing mail provider must not
 * fail the sale that triggered the email, so every caller gets a result
 * object and the decision about what to record stays with the caller.
 */

export interface Mail {
  to: string;
  subject: string;
  /** Plain text. These are short money notices, not a newsletter. */
  text: string;
}

export type SendResult = { ok: true; simulated: boolean } | { ok: false; error: string };

const FROM = process.env.EMAIL_FROM || "BOOST <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  if (!isEmailConfigured()) {
    // Not an error, and not silence either: the whole message is logged so a
    // developer can read exactly what a user would have received.
    console.info(
      `[BOOST] email not configured, would have sent:\n  to: ${mail.to}\n  subject: ${mail.subject}\n  ${mail.text.replace(/\n/g, "\n  ")}`,
    );
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
      // A slow provider must not hold a serverless function open indefinitely.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `resend ${res.status} ${detail.slice(0, 300)}` };
    }
    return { ok: true, simulated: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
