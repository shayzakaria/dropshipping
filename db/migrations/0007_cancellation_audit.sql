-- 0007: when and why a commission was voided.
--
-- The influencer's dashboard showed a struck-through row and nothing else.
-- Money they had already seen simply stopped being theirs, with no date and
-- no explanation, and the only party who knew why was the one who benefited
-- from the cancellation. For a platform whose whole proposition to an
-- influencer is "your code is real money", that is the wrong thing to be
-- vague about.

create type public.cancellation_reason as enum ('returned', 'unpaid', 'fraud', 'error');

alter table public.redemptions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason public.cancellation_reason;

comment on column public.redemptions.cancelled_at is
  'When the commission was voided. Null unless status = cancelled.';
comment on column public.redemptions.cancellation_reason is
  'Why it was voided, in terms the influencer is shown.';

-- Nothing has been cancelled yet, so there is no history to backfill: the
-- honest state for a row that was never cancelled is null on both columns.
