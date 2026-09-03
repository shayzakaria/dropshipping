-- 0017: telling people what happened.
--
-- Nobody was told anything. An influencer did not know they had made a sale,
-- a business did not know someone had joined its campaign, and nobody knew a
-- payout had gone out. A platform whose promise is "your code earns money"
-- was silent at the exact moment it came true.
--
-- The table is not a log of emails, it is the thing that stops the second
-- copy. Every notification carries a dedupe_key that names the event rather
-- than the moment — "sale:<redemption id>", not "sale at 14:32" — so a retry,
-- a re-deploy, or a cron that runs twice cannot mail anyone the same news
-- again. Sent state and errors live here too, so a silent failure is
-- something an operator can find rather than something a user reports.

create type public.notification_kind as enum (
  'sale',                 -- influencer: a code of yours was used
  'commission_released',  -- influencer: money became withdrawable
  'commission_cancelled', -- influencer: an order came back
  'payout_paid',          -- influencer: we sent the transfer
  'influencer_joined',    -- business: someone took a code
  'pool_low',             -- business: codes are running out
  'statement_issued'      -- business: here is this month's bill
);

create type public.notification_status as enum ('pending', 'sent', 'failed');

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  -- Names the event, not the instant. This is the whole anti-duplicate story.
  dedupe_key text not null unique,
  -- What the email said, kept so support can answer "what did you send me"
  subject text not null,
  body text not null,
  status public.notification_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.notifications enable row level security;
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_pending_idx
  on public.notifications (created_at) where status = 'pending';

-- Someone who does not want these can stop them. Money notices are not
-- advertising under תיקון 40, but an off switch costs nothing and being the
-- platform that cannot be turned off is not worth the emails.
alter table public.profiles
  add column if not exists email_opt_out boolean not null default false;
