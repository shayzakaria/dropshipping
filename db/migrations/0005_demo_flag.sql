-- 0005: say which records are examples.
--
-- The deployed site is public and /campaigns needs no account, so the seeded
-- world — one invented business, two invented influencers, fifteen invented
-- sales — was on show to anyone with the link, presented exactly like real
-- activity. For a marketplace courting its first businesses, that is the one
-- lie that matters: it claims traction that does not exist.
--
-- The flag lives on the record rather than on the environment, so an example
-- stays labelled even after real customers are sitting next to it in the same
-- table. Campaigns, codes and redemptions inherit it from their business.

alter table public.profiles add column if not exists is_demo boolean not null default false;
alter table public.businesses add column if not exists is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'Seeded example account, not a real person. Every screen that shows one must say so.';
comment on column public.businesses.is_demo is
  'Seeded example business, not a real customer. Every screen that shows one must say so.';

-- Flag what is already in there: everything seeded before real sign-ups began.
update public.profiles set is_demo = true where email like '%@demo.co.il';
update public.businesses b set is_demo = true
  from public.profiles p
 where p.id = b.owner_id and p.is_demo;
