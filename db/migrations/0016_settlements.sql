-- 0016: what each business owes, and whether it has paid.
--
-- Model A settles monthly: the buyer pays the business, and once a month we
-- bill the business for the commissions it owes its influencers plus our own
-- fee, collect it, and pay the influencers from what we collected. Until now
-- nothing in the system said how much that was, so there was no way to invoice
-- anyone and no way to know who was behind.
--
-- A statement is frozen when it is issued, for the same reason a payout
-- request freezes its amount: a cancellation next week must not quietly change
-- a number a business has already been asked to pay and may already have paid.
-- The redemptions it covered are stamped with its id, so the statement can
-- always be re-derived from the rows it was built from.

create type public.settlement_status as enum ('issued', 'paid', 'cancelled');

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- the window billed, inclusive of start and exclusive of end
  period_start date not null,
  period_end date not null,
  -- what the business owes its influencers
  commissions numeric(12, 2) not null default 0,
  -- what the business owes us
  platform_fees numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  sales_count integer not null default 0,
  status public.settlement_status not null default 'issued',
  note text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  -- one statement per business per period; re-running the issue never
  -- produces a second bill for the same window
  unique (business_id, period_start)
);
alter table public.settlements enable row level security;
create index if not exists settlements_status_idx on public.settlements (status, period_start desc);

-- Which statement covered this sale. Null means not yet billed.
alter table public.redemptions
  add column if not exists settlement_id uuid references public.settlements (id) on delete set null;

-- The query behind every statement: this business's released, uncancelled,
-- not-yet-billed sales.
create index if not exists redemptions_unsettled_idx
  on public.redemptions (business_id, hold_until)
  where settlement_id is null and status <> 'cancelled';
