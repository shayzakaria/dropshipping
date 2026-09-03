import type { DataStore } from "../store/store";
import type { Redemption, Settlement } from "../domain/types";
import { cancellationReasonLabel } from "../domain/logic";
import { notify, siteUrlForEmail, templates } from "./notify";

/**
 * Every notification the product sends, in one file.
 *
 * The alternative — a notify() call at each call site — means the next person
 * to add a way of recording a sale adds a way of recording a sale silently.
 * Each function here is the single answer to "who gets told when X happens",
 * and each takes only what it needs so a caller cannot get the recipient
 * wrong.
 *
 * All of them are fire-and-forget: notify() defers to after(), catches
 * everything, and dedupes on a key naming the event.
 */

/** A code was used. The influencer's moment — lead with the number. */
export async function notifySale(store: DataStore, r: Redemption): Promise<void> {
  const [influencer, business] = await Promise.all([
    store.getUser(r.influencerId),
    store.getBusiness(r.businessId),
  ]);
  if (!influencer || !business) return;

  notify(store, "sale", influencer, `sale:${r.id}`,
    templates.sale({
      name: influencer.name,
      amount: r.influencerCommission,
      businessName: business.name,
      siteUrl: siteUrlForEmail(),
    }),
  );
}

/** An order came back. Bad news, said as plainly as the good kind. */
export async function notifyCommissionCancelled(store: DataStore, r: Redemption): Promise<void> {
  const [influencer, business] = await Promise.all([
    store.getUser(r.influencerId),
    store.getBusiness(r.businessId),
  ]);
  if (!influencer || !business) return;

  notify(store, "commission_cancelled", influencer, `cancelled:${r.id}`,
    templates.commission_cancelled({
      name: influencer.name,
      amount: r.influencerCommission,
      businessName: business.name,
      reason: cancellationReasonLabel(r.cancellationReason),
      siteUrl: siteUrlForEmail(),
    }),
  );
}

/** The transfer went out. */
export async function notifyPayoutPaid(
  store: DataStore,
  payout: { id: string; influencerId: string; amount: number; note?: string },
): Promise<void> {
  const influencer = await store.getUser(payout.influencerId);
  if (!influencer) return;

  notify(store, "payout_paid", influencer, `payout:${payout.id}`,
    templates.payout_paid({
      name: influencer.name,
      amount: payout.amount,
      note: payout.note,
      siteUrl: siteUrlForEmail(),
    }),
  );
}

/**
 * Somebody took a code — and, if the pool is nearly dry, a second warning.
 *
 * The low-stock key carries the pool's total as well as what is left, so
 * topping the pool up re-arms the warning instead of silencing it forever.
 */
export async function notifyInfluencerJoined(
  store: DataStore,
  input: { businessId: string; influencerId: string; campaignId: string; campaignTitle: string },
): Promise<void> {
  const [business, influencer, pool] = await Promise.all([
    store.getBusiness(input.businessId),
    store.getUser(input.influencerId),
    store.poolStatus(input.campaignId),
  ]);
  if (!business || !influencer) return;
  const owner = await store.getUser(business.ownerId);
  if (!owner) return;

  notify(store, "influencer_joined", owner, `joined:${input.campaignId}:${input.influencerId}`,
    templates.influencer_joined({
      businessName: business.name,
      influencerName: influencer.name,
      campaignTitle: input.campaignTitle,
      codesLeft: pool.available,
      siteUrl: siteUrlForEmail(),
    }),
  );

  // Warned twice on the way down, not once per join.
  if (pool.available === 5 || pool.available === 1) {
    notify(store, "pool_low", owner, `pool_low:${input.campaignId}:${pool.total}:${pool.available}`,
      templates.pool_low({
        campaignTitle: input.campaignTitle,
        codesLeft: pool.available,
        siteUrl: siteUrlForEmail(),
      }),
    );
  }
}

/** This month's bill. */
export async function notifyStatementIssued(store: DataStore, s: Settlement): Promise<void> {
  const business = await store.getBusiness(s.businessId);
  if (!business) return;
  const owner = await store.getUser(business.ownerId);
  if (!owner) return;

  notify(store, "statement_issued", owner, `statement:${s.id}`,
    templates.statement_issued({
      businessName: business.name,
      total: s.total,
      commissions: s.commissions,
      platformFees: s.platformFees,
      period: s.periodStart.slice(0, 7),
      salesCount: s.salesCount,
      siteUrl: siteUrlForEmail(),
    }),
  );
}

/**
 * The one notification with no event behind it: money becomes withdrawable
 * because time passed, so something has to come looking. Driven by the cron
 * route, which is the only caller.
 */
export async function notifyReleases(store: DataStore): Promise<number> {
  const due = await store.findNewlyReleased();
  let queued = 0;
  for (const row of due) {
    const influencer = await store.getUser(row.influencerId);
    if (!influencer) continue;
    notify(store, "commission_released", influencer, `released:${row.influencerId}:${row.upTo.slice(0, 10)}`,
      templates.commission_released({
        name: influencer.name,
        amount: row.amount,
        count: row.count,
        siteUrl: siteUrlForEmail(),
      }),
    );
    queued++;
  }
  return queued;
}
