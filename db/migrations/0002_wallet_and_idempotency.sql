-- Commission wallet + idempotent order recording.
--
-- Why: a checkout webhook retries, and without an order id every retry paid a
-- second commission. And commission used to be payable the instant a sale was
-- recorded, even though an Israeli distance-selling buyer has 14 days to
-- cancel — so a returned order could still cost the business a payout.

create type public.redemption_status as enum ('held', 'cancelled', 'paid');

alter table public.redemptions
  add column external_order_id text,
  add column status public.redemption_status not null default 'held',
  add column hold_until timestamptz;

-- Backfill the sales that predate the hold, using the same 14-day window
update public.redemptions
   set hold_until = created_at + interval '14 days'
 where hold_until is null;

alter table public.redemptions alter column hold_until set not null;

-- One redemption per store order. Partial, so sales without an order id
-- (manual entry, simulator) are unaffected.
create unique index redemptions_external_order_idx
  on public.redemptions (business_id, external_order_id)
  where external_order_id is not null;

-- The influencer wallet reads by state and release time
create index redemptions_wallet_idx
  on public.redemptions (influencer_id, status, hold_until);
