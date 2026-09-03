-- 0015: codes the shop already knows about.
--
-- The flaw this fixes: until now the platform invented a code (8DPH-H2CS)
-- that existed nowhere in the business's shop. An influencer published it,
-- a buyer typed it at checkout, and got "invalid code" — with the influencer
-- taking the blame in front of their own audience. It only ever worked if the
-- business happened to create the identical code by hand.
--
-- A campaign now declares where its codes come from:
--   'pool'      — the business bulk-created codes in its own shop and pasted
--                 them here. Each influencer is handed one. It works because
--                 the shop made it. No integration with any platform needed.
--   'generated' — the platform invents them, as before. Only correct when the
--                 shop validates codes by calling us (a real integration).
--
-- Default is 'pool', because "works everywhere" should be what you get by
-- not thinking about it.

create type public.code_source as enum ('pool', 'generated');

alter table public.campaigns
  add column if not exists code_source public.code_source not null default 'pool',
  -- A campaign is not offered to influencers until a real code has been tried
  -- at a real checkout. Nobody publishes an untested code to their followers.
  add column if not exists verified_at timestamptz;

-- Existing campaigns keep the old behaviour: their influencers already hold
-- generated codes, and rewriting that would change codes already published.
update public.campaigns set code_source = 'generated' where created_at < now();

create table if not exists public.campaign_code_pool (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  code text not null,
  -- null until an influencer joins and takes it
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, code)
);
alter table public.campaign_code_pool enable row level security;

-- The hot query is "give me one unclaimed code for this campaign", so the
-- index is on exactly that and skips the claimed rows entirely.
create index if not exists campaign_code_pool_unclaimed_idx
  on public.campaign_code_pool (campaign_id)
  where claimed_by is null;

/*
 * Hands out one code, atomically.
 *
 * Two influencers joining the same campaign in the same instant must not get
 * the same code. `for update skip locked` lets each transaction take a
 * different row instead of queueing behind the same one, which is the whole
 * reason this is a function and not a select followed by an update.
 */
create or replace function public.claim_pool_code(p_campaign_id uuid, p_influencer_id uuid)
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  select code into v_code
    from public.campaign_code_pool
   where campaign_id = p_campaign_id and claimed_by is null
   order by created_at
   for update skip locked
   limit 1;

  if v_code is null then
    return null;
  end if;

  update public.campaign_code_pool
     set claimed_by = p_influencer_id, claimed_at = now()
   where campaign_id = p_campaign_id and code = v_code;

  return v_code;
end;
$$;
