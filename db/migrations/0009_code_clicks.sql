-- 0009: how many people a coupon code actually reached.
--
-- Until now an influencer learned nothing until somebody bought. Post a code,
-- then silence — for days, and possibly forever. There was no way to tell "my
-- audience ignored this" from "my audience clicked and the shop lost them",
-- and those two need opposite fixes.
--
-- Stored as a daily count per code, not a row per visitor. That is cheaper,
-- but mainly it is the honest shape: we want to tell an influencer how many
-- people came, and that question does not require knowing who they were. No
-- visitor id, no fingerprint, no address, nothing to correlate across sites
-- and nothing worth stealing. It also means the privacy policy stays true
-- without a paragraph of exceptions.

create table if not exists public.code_clicks (
  code_id uuid not null references public.coupon_codes (id) on delete cascade,
  day date not null,
  clicks integer not null default 0,
  primary key (code_id, day)
);

alter table public.code_clicks enable row level security;

-- One statement, so two concurrent visitors cannot both read 9 and write 10.
create or replace function public.record_code_click(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.code_clicks (code_id, day, clicks)
  values (p_code_id, current_date, 1)
  on conflict (code_id, day) do update set clicks = code_clicks.clicks + 1;
end;
$$;

revoke all on function public.record_code_click(uuid) from public, anon, authenticated;

create index if not exists code_clicks_day_idx on public.code_clicks (code_id, day desc);
