-- 0010: enough of a business to put in a shop window.
--
-- A directory card needs something to show. Until now a business was a name,
-- an owner and a shop link — a card built from that is a name on a beige
-- rectangle, which serves nobody and makes the platform look empty.
--
-- A logo URL rather than an upload, deliberately: file upload brings storage,
-- size limits, image moderation and a whole abuse surface, and none of that
-- earns its place before the directory has any businesses in it. A business
-- that has a shop has a logo on the internet already. When pasting a URL
-- turns out to be the friction that stops people, that is the moment to build
-- uploads — not before.

alter table public.businesses
  add column if not exists description text,
  add column if not exists logo_url text;

comment on column public.businesses.description is
  'One or two lines the business writes about itself, shown on its directory card.';
comment on column public.businesses.logo_url is
  'Absolute http(s) URL to the business logo. Rendered with a fallback when absent or broken.';
