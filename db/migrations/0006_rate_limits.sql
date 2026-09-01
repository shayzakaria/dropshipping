-- 0006: a shared counter, so the money endpoints can be throttled.
--
-- /api/redeem is public and it creates commissions a business owes. The two
-- things worth stopping are volume from a leaked api_secret, and anyone
-- hammering the endpoint before a secret has been checked at all.
--
-- Serverless instances share no memory, so the counter has to live here. A
-- fixed window is coarse — a caller can spend a whole window's budget at the
-- boundary and again immediately after — but it costs one round trip and no
-- new infrastructure, and coarse throttling now beats none.

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- One atomic statement, so concurrent instances cannot both read 9 and write 10.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;

  -- Opening a new window is the cheap moment to take out the rubbish, and it
  -- keeps the table bounded without a scheduled job.
  if v_hits = 1 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_hits;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
