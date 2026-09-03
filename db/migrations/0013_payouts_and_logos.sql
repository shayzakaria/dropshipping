-- 0013: getting the money out, and logos as files.
--
-- Payout details are asked for at the moment they are needed and not before.
-- Signing up as an influencer stays a name and an email; a bank account is
-- only relevant once there is something to send to it, and demanding one up
-- front is the classic way to lose people at the door.
--
-- These are the most sensitive rows in the database. They are readable only by
-- the service key (RLS on, no policies), never shown to a business, and never
-- leave the payouts screen. Before this scales past a handful of influencers
-- it should move to a payment provider so we stop holding bank details at all
-- — noted in docs/payouts.md rather than left as a surprise.

create table if not exists public.payout_details (
  influencer_id uuid primary key references public.profiles (id) on delete cascade,
  -- as written on the bank account, which is not always the display name
  legal_name text not null,
  national_id text not null,
  bank_name text not null,
  branch text not null,
  account_number text not null,
  -- decides whether they invoice us, and how we report the payment
  tax_status text not null check (tax_status in ('exempt', 'licensed', 'none')),
  updated_at timestamptz not null default now()
);
alter table public.payout_details enable row level security;

create type public.payout_status as enum ('requested', 'paid', 'rejected');

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.profiles (id) on delete cascade,
  -- the amount as it stood when asked for, so a later sale or cancellation
  -- cannot quietly change what was agreed
  amount numeric(12, 2) not null check (amount > 0),
  status public.payout_status not null default 'requested',
  note text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table public.payout_requests enable row level security;
create index if not exists payout_requests_influencer_idx
  on public.payout_requests (influencer_id, created_at desc);

-- Logos become files we host, so a business can upload instead of finding a
-- URL. The bucket is public-read: these are logos meant to be seen, and a
-- signed URL per render would be cost for nothing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];
