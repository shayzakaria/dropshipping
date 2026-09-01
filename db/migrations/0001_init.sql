-- BOOST platform — schema as applied to the Supabase project (Shay Personal).
--
-- Access model: every table has RLS enabled with NO policies, so the anon and
-- publishable keys can read and write nothing. All access goes through the
-- Next.js server (lib/store/supabase.ts) using the project's secret key, which
-- bypasses RLS. Sessions are the app's own cookie today, so profiles is a
-- standalone table; when Supabase Auth is adopted, profiles.id becomes a
-- reference to auth.users and policies get written against auth.uid().
--
-- Business rules (money splits, tiers, fraud guards) live in web/lib/domain
-- and are covered by the test suite. They are deliberately NOT duplicated in
-- SQL — the database enforces shape and referential integrity only.

create extension if not exists pgcrypto;

create type public.user_role as enum ('business', 'influencer');
create type public.campaign_status as enum ('active', 'paused');
create type public.code_status as enum ('active', 'disabled');
create type public.redemption_source as enum ('api', 'manual', 'simulator');
create type public.tier_name as enum ('BRONZE', 'SILVER', 'GOLD');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  store_url text,
  -- Secret the business's store sends to /api/redeem to authenticate itself
  api_secret uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null,
  description text,
  buyer_discount_pct numeric(5, 2) not null check (buyer_discount_pct >= 1),
  influencer_pct numeric(5, 2) not null check (influencer_pct >= 1),
  platform_pct numeric(5, 2) not null check (platform_pct >= 1),
  new_customers_only boolean not null default true,
  max_redemptions_per_month integer check (max_redemptions_per_month > 0),
  status public.campaign_status not null default 'active',
  created_at timestamptz not null default now(),
  -- Economic sanity: the total benefit never exceeds half the sale
  check (buyer_discount_pct + influencer_pct + platform_pct <= 50)
);

create table public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  influencer_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  status public.code_status not null default 'active',
  created_at timestamptz not null default now(),
  -- One code per influencer per campaign; the app relies on this to make
  -- "join campaign" idempotent under concurrent requests
  unique (campaign_id, influencer_id)
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.coupon_codes (id),
  campaign_id uuid not null references public.campaigns (id),
  business_id uuid not null references public.businesses (id),
  influencer_id uuid not null references public.profiles (id),
  order_amount numeric(12, 2) not null check (order_amount > 0),
  buyer_discount numeric(12, 2) not null check (buyer_discount >= 0),
  influencer_commission numeric(12, 2) not null check (influencer_commission >= 0),
  platform_fee numeric(12, 2) not null check (platform_fee >= 0),
  tier public.tier_name not null,
  tier_bonus_pct numeric(5, 2) not null default 0,
  -- Buyer identifier reported by the store, stored lowercased
  customer_ref text,
  source public.redemption_source not null,
  created_at timestamptz not null default now()
);

create index redemptions_business_idx on public.redemptions (business_id, created_at desc);
create index redemptions_influencer_idx on public.redemptions (influencer_id, created_at desc);
create index redemptions_campaign_idx on public.redemptions (campaign_id, created_at);
create index redemptions_customer_idx on public.redemptions (business_id, lower(customer_ref));
create index campaigns_business_idx on public.campaigns (business_id);
create index codes_influencer_idx on public.coupon_codes (influencer_id);

-- Deny by default: no policies are defined, so only the secret key gets through
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.campaigns enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.redemptions enable row level security;
