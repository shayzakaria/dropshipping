-- BOOST platform — initial schema, ready to apply to Supabase when we connect
-- a real database. Mirrors web/lib/domain (keep the two in sync when logic
-- changes). Tables assume Supabase Auth: profiles.id references auth.users.

create extension if not exists pgcrypto;

create type public.user_role as enum ('business', 'influencer');
create type public.campaign_status as enum ('active', 'paused');
create type public.code_status as enum ('active', 'disabled');
create type public.redemption_source as enum ('api', 'manual', 'simulator');
create type public.tier_name as enum ('BRONZE', 'SILVER', 'GOLD');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
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
  -- Secret used by the business's store to authenticate /api/redeem calls
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
  -- Economic sanity: total benefit never above half the sale
  check (buyer_discount_pct + influencer_pct + platform_pct <= 50)
);

create table public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  influencer_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  status public.code_status not null default 'active',
  created_at timestamptz not null default now(),
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
  customer_ref text,
  source public.redemption_source not null,
  created_at timestamptz not null default now()
);

create index redemptions_business_idx on public.redemptions (business_id, created_at desc);
create index redemptions_influencer_idx on public.redemptions (influencer_id, created_at desc);
create index redemptions_campaign_idx on public.redemptions (campaign_id, created_at);
create index redemptions_customer_idx on public.redemptions (business_id, lower(customer_ref));

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.campaigns enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.redemptions enable row level security;

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "insert own profile" on public.profiles
  for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "owner manages business" on public.businesses
  for all using (owner_id = auth.uid());

create policy "owner manages campaigns" on public.campaigns
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );
create policy "anyone signed-in browses active campaigns" on public.campaigns
  for select using (status = 'active' and auth.uid() is not null);

create policy "influencer reads own codes" on public.coupon_codes
  for select using (influencer_id = auth.uid());
create policy "business reads its campaign codes" on public.coupon_codes
  for select using (
    campaign_id in (
      select c.id from public.campaigns c
      join public.businesses b on b.id = c.business_id
      where b.owner_id = auth.uid()
    )
  );

create policy "influencer reads own redemptions" on public.redemptions
  for select using (influencer_id = auth.uid());
create policy "business reads its redemptions" on public.redemptions
  for select using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RPC: join_campaign — influencer joins and gets a unique readable code.
-- security definer so the insert bypasses RLS after our own checks.
-- ---------------------------------------------------------------------------
create or replace function public.join_campaign(p_campaign_id uuid)
returns public.coupon_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.coupon_codes;
  v_code text;
  v_row public.coupon_codes;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.campaigns where id = p_campaign_id and status = 'active'
  ) then
    raise exception 'CAMPAIGN_INACTIVE';
  end if;

  select * into v_existing from public.coupon_codes
  where campaign_id = p_campaign_id and influencer_id = auth.uid();
  if found then
    return v_existing;
  end if;

  loop
    -- Unambiguous alphabet: no 0/O, 1/I/L (matches web/lib/domain/logic.ts)
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (random() * 30)::int + 1, 1), '')
      into v_code from generate_series(1, 8);
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
    exit when not exists (select 1 from public.coupon_codes where code = v_code);
  end loop;

  insert into public.coupon_codes (campaign_id, influencer_id, code)
  values (p_campaign_id, auth.uid(), v_code)
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: redeem_code — the transactional heart of the platform. Mirrors
-- web/lib/domain/service.ts (validation order and tier math must stay in sync).
-- Called by the store integration with the business api_secret; security
-- definer because the caller is not a signed-in platform user.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_code(
  p_code text,
  p_order_amount numeric,
  p_api_secret uuid,
  p_customer_ref text default null
)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.coupon_codes;
  v_campaign public.campaigns;
  v_business public.businesses;
  v_customer text := nullif(lower(trim(p_customer_ref)), '');
  v_month_start timestamptz := date_trunc('month', now());
  v_monthly_sales int;
  v_bonus numeric := 0;
  v_tier public.tier_name := 'BRONZE';
  v_total numeric;
  v_discount numeric;
  v_commission numeric;
  v_fee numeric;
  v_row public.redemptions;
begin
  select * into v_code from public.coupon_codes
  where code = upper(trim(p_code)) and status = 'active';
  if not found then raise exception 'CODE_NOT_FOUND'; end if;

  select * into v_campaign from public.campaigns
  where id = v_code.campaign_id and status = 'active';
  if not found then raise exception 'CAMPAIGN_INACTIVE'; end if;

  select * into v_business from public.businesses where id = v_campaign.business_id;
  if v_business.api_secret is distinct from p_api_secret then
    raise exception 'BAD_SECRET';
  end if;

  if p_order_amount is null or p_order_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Fraud guard: influencers cannot redeem their own code
  if v_customer is not null and v_customer = (
    select email from public.profiles where id = v_code.influencer_id
  ) then
    raise exception 'SELF_REDEMPTION';
  end if;

  -- Cannibalization guard: new customers only (when the store reports a ref)
  if v_campaign.new_customers_only and v_customer is not null and exists (
    select 1 from public.redemptions
    where business_id = v_campaign.business_id and lower(customer_ref) = v_customer
  ) then
    raise exception 'NOT_NEW_CUSTOMER';
  end if;

  if v_campaign.max_redemptions_per_month is not null then
    if (
      select count(*) from public.redemptions
      where campaign_id = v_campaign.id and created_at >= v_month_start
    ) >= v_campaign.max_redemptions_per_month then
      raise exception 'MONTHLY_CAP_REACHED';
    end if;
  end if;

  -- Tier from this month's sales BEFORE this sale; bonus funded by platform
  select count(*) into v_monthly_sales from public.redemptions
  where influencer_id = v_code.influencer_id and created_at >= v_month_start;
  if v_monthly_sales >= 30 then
    v_tier := 'GOLD'; v_bonus := 2;
  elsif v_monthly_sales >= 10 then
    v_tier := 'SILVER'; v_bonus := 1;
  end if;
  v_bonus := least(v_bonus, v_campaign.platform_pct);

  v_total := round(p_order_amount * (v_campaign.buyer_discount_pct + v_campaign.influencer_pct + v_campaign.platform_pct) / 100, 2);
  v_discount := round(p_order_amount * v_campaign.buyer_discount_pct / 100, 2);
  v_commission := round(p_order_amount * (v_campaign.influencer_pct + v_bonus) / 100, 2);
  v_fee := round(v_total - v_discount - v_commission, 2);

  insert into public.redemptions (
    code_id, campaign_id, business_id, influencer_id,
    order_amount, buyer_discount, influencer_commission, platform_fee,
    tier, tier_bonus_pct, customer_ref, source
  ) values (
    v_code.id, v_campaign.id, v_campaign.business_id, v_code.influencer_id,
    p_order_amount, v_discount, v_commission, v_fee,
    v_tier, v_bonus, v_customer, 'api'
  ) returning * into v_row;
  return v_row;
end;
$$;
