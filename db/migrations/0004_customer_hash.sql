-- 0004: stop storing buyer identities.
--
-- customer_ref held a third party's email address (or phone) in the clear,
-- for two questions that are pure equality checks: "is this the influencer's
-- own address?" and "has this buyer bought from this business before?". A
-- peppered SHA-256 answers both, so the column becomes a fingerprint and the
-- raw values are dropped. See web/lib/domain/privacy.ts.
--
-- The existing values cannot be converted in SQL — the pepper is an
-- application secret and never reaches the database — so the seeded pilot
-- rows lose their buyer fingerprint. That only affects the new-customer check
-- for those demo buyers, and it is the right trade: the alternative is
-- teaching Postgres the secret.

alter table public.redemptions rename column customer_ref to customer_hash;
update public.redemptions set customer_hash = null;

drop index if exists redemptions_customer_idx;
create index redemptions_customer_idx on public.redemptions (business_id, customer_hash);

comment on column public.redemptions.customer_hash is
  'Peppered SHA-256 of the buyer identifier the store reported. Never the value itself.';
