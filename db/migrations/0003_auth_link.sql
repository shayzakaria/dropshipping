-- Link a platform profile to a Supabase Auth user.
--
-- Deliberately a nullable column rather than making profiles.id the auth id:
-- the demo profiles that predate real sign-up keep working, and a profile
-- without an auth user simply cannot sign in — which is the correct behaviour
-- once demo mode is off.

alter table public.profiles
  add column auth_user_id uuid unique references auth.users (id) on delete cascade;

create index profiles_auth_user_idx on public.profiles (auth_user_id);
