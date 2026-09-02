-- 0012: operator support tools, and the record of using them.
--
-- An operator who can void someone's commission or disable their code must
-- leave a trail. Without one, an influencer who loses money has no way to
-- learn that it was us and not the business, and we have no way to answer
-- them honestly six weeks later. So every action taken on someone else's
-- behalf is appended here first, and the application never deletes a row.
--
-- Deliberately NOT built: signing in as another user. It is the feature
-- support teams always ask for and the one that makes an audit log a lie —
-- every action would be recorded as the user's own, money could be moved
-- under their name, and no log could tell the difference afterwards.

update public.profiles set is_admin = true where email = 'shayzakariaa@gmail.com';

-- Suspension, for the fraud case. A time and a reason, not a boolean: "when"
-- and "why" are the first two questions anyone asks about a locked account.
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  -- restrict, not cascade: deleting an operator must never erase what they did
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  subject_kind text not null,
  subject_id text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
