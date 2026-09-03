import { after } from "next/server";
import type { DataStore } from "../store/store";
import type { NotificationKind } from "../domain/types";
import { sendMail } from "./send";
import { templates, type Template } from "./templates";

/**
 * Telling one person one thing, exactly once, without ever holding up the
 * request that caused it.
 *
 * Two rules run through everything here.
 *
 * It never throws. The caller is a sale being recorded or a payout being
 * settled — work that must succeed whether or not a mail provider is having a
 * good day. Every failure is caught, written to the notification row, and
 * left for an operator to find.
 *
 * It never sends twice. The dedupe key is claimed in the database before the
 * mail goes out, so a retried server action, a double-clicked button and two
 * instances racing all end up with one email. The key names the event — a
 * redemption id, a payout id, a statement id — never the current time.
 */

interface Recipient {
  id: string;
  email: string;
}

/**
 * Queues a notification and sends it after the response has gone out.
 *
 * `after()` is what keeps this off the critical path: the visitor's request
 * finishes, then the mail is attempted. A slow provider costs nobody a
 * spinner.
 */
export function notify(
  store: DataStore,
  kind: NotificationKind,
  to: Recipient,
  dedupeKey: string,
  template: Template,
): void {
  after(async () => {
    try {
      const claimed = await store.claimNotification({
        recipientId: to.id,
        kind,
        dedupeKey,
        subject: template.subject,
        body: template.text,
      });
      // Already claimed by someone else, or the recipient opted out.
      if (!claimed) return;

      const result = await sendMail({ to: to.email, subject: template.subject, text: template.text });
      await store.markNotificationSent(claimed.id, result.ok ? undefined : result.error);
      if (!result.ok) console.error(`[BOOST] notification ${kind} failed: ${result.error}`);
    } catch (e) {
      // Nothing here is worth breaking a request over.
      console.error(`[BOOST] notification ${kind} threw`, e);
    }
  });
}

export { templates };

/**
 * Where the site lives, for links inside emails.
 *
 * An email outlives the request that sent it, so a link built from a request
 * header can point at a preview deployment forever. SITE_URL is authoritative
 * when set.
 */
export function siteUrlForEmail(fallbackOrigin?: string): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return fallbackOrigin?.replace(/\/$/, "") ?? "https://dropshipping-chi-flax.vercel.app";
}
