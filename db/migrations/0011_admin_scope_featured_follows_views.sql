-- 0011: the operator's seat, and three product facts that were missing.

-- ---------------------------------------------------------------------------
-- Admin. A flag, set by SQL and nothing else.
--
-- Deriving admin from an email address would be a hole, because email
-- confirmation is off for the pilot: anyone can register any address,
-- including the operator's, and would inherit the whole system. So no form,
-- no action and no environment variable can grant this. Only a person with
-- database access can, on purpose, per account.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;
comment on column public.profiles.is_admin is
  'Operator access. Set only via SQL; no application path can write it.';

-- ---------------------------------------------------------------------------
-- What a coupon actually covers. The store enforces it at checkout; we only
-- record it so the influencer knows what they are promoting and does not
-- tell their audience the code works on the whole shop when it covers one
-- vase.
-- ---------------------------------------------------------------------------
create type public.campaign_scope as enum ('store', 'product');
alter table public.campaigns
  add column if not exists scope public.campaign_scope not null default 'store',
  add column if not exists product_name text,
  add column if not exists product_url text;

-- ---------------------------------------------------------------------------
-- Featured placement in the directory. A timestamp, not a boolean, so a paid
-- slot expires on its own instead of depending on someone remembering to
-- switch it off. Set from the admin dashboard; billing is manual until a
-- payment provider is chosen.
-- ---------------------------------------------------------------------------
alter table public.businesses add column if not exists featured_until timestamptz;
create index if not exists businesses_featured_idx on public.businesses (featured_until desc nulls last);

-- ---------------------------------------------------------------------------
-- An influencer following a business. The relationship lives here; the deal
-- still lives on the campaign, so a business that opens a leaner campaign
-- later cannot silently move its followers onto worse terms — they see the
-- new percentages and join, or do not.
-- ---------------------------------------------------------------------------
create table if not exists public.business_follows (
  influencer_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (influencer_id, business_id)
);
alter table public.business_follows enable row level security;
create index if not exists business_follows_business_idx on public.business_follows (business_id);

-- ---------------------------------------------------------------------------
-- Page views, counted the same way clicks are: per path per day, no visitor.
-- This is what lets the operator see traffic without a cookie, a pixel or a
-- third party, and without the privacy policy growing an exceptions clause.
-- ---------------------------------------------------------------------------
create table if not exists public.page_views (
  path text not null,
  day date not null,
  views integer not null default 0,
  primary key (path, day)
);
alter table public.page_views enable row level security;

create or replace function public.record_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.page_views (path, day, views)
  values (p_path, current_date, 1)
  on conflict (path, day) do update set views = page_views.views + 1;
end;
$$;
revoke all on function public.record_page_view(text) from public, anon, authenticated;
