-- LunchMatch schema — run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

-- profiles ↔ groups reference each other; create profiles first without the
-- group FK, add it after groups exists.
-- Accounts are created by an administrator (see /admin/users); no self-signup
-- of arbitrary users is expected in production.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  full_name text not null default '',
  email text not null unique,
  team text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  account_status text not null default 'active' check (account_status in ('active','disabled')),
  must_change_password boolean not null default false,
  profile_completed boolean not null default false,
  dietary_restrictions text[] not null default '{}',
  allergies text not null default '',
  avatar_url text,
  display_name text not null,
  avatar_emoji text not null default '🙂',
  group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_group_fk foreign key (group_id) references groups(id) on delete set null;

create table daily_lunch_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  session_date date not null default (now()::date),
  status text not null default 'collecting' check (status in ('collecting','voting','closed')),
  meeting_point text not null default 'Office entrance',
  winner_recommendation_id uuid,
  difficult_coworker_id uuid references profiles(id),
  difficult_coworker_reason text,
  closed_at timestamptz
);
create unique index one_open_session_per_group on daily_lunch_sessions(group_id) where status <> 'closed';

create table lunch_preferences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_lunch_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  attendance text not null default 'yes' check (attendance in ('yes','maybe','no')),
  available_from time not null default '12:00',
  available_to time not null default '13:00',
  max_budget numeric(6,2) not null default 15,
  categories text[] not null default '{}',
  dietary text[] not null default '{}',
  allergies text not null default '',
  transport text not null default 'walk' check (transport in ('walk','car','delivery')),
  max_walking_minutes int not null default 10,
  comment text not null default '',
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_lunch_sessions(id) on delete cascade,
  restaurant_id text not null,
  restaurant_name text not null,
  rank int not null check (rank between 1 and 3),
  score int not null,
  score_breakdown jsonb not null default '[]',
  ai_why text, ai_slogan text, ai_source text check (ai_source in ('ai','fallback')),
  unique (session_id, rank)
);
alter table daily_lunch_sessions
  add constraint dls_winner_fk foreign key (winner_recommendation_id) references recommendations(id);

create table votes (
  session_id uuid not null references daily_lunch_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  primary key (session_id, user_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- current_group_id() is SECURITY DEFINER so policies never subquery `profiles`
-- under RLS — a policy on profiles that selects from profiles (directly, or
-- transitively via another table's policy) is the classic Supabase
-- infinite-recursion error. This helper sidesteps the whole class.
create or replace function current_group_id()
returns uuid language sql security definer stable set search_path = public as
$$ select group_id from profiles where id = auth.uid() $$;

-- Admin check used by RLS and (via the API) by /admin routes. SECURITY DEFINER
-- for the same no-recursion reason as current_group_id().
create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as
$$ select exists (
     select 1 from profiles
     where id = auth.uid() and role = 'admin' and account_status = 'active'
   ) $$;

alter table profiles enable row level security;
alter table groups enable row level security;
alter table daily_lunch_sessions enable row level security;
alter table lunch_preferences enable row level security;
alter table recommendations enable row level security;
alter table votes enable row level security;

create policy profiles_self on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_groupmates on profiles for select to authenticated
  using (group_id is not null and group_id = current_group_id());
-- Admins manage every profile (user creation itself goes through the
-- service-role API route, which bypasses RLS; these cover reads + updates
-- from the admin UI session).
create policy profiles_admin_select on profiles for select to authenticated
  using (is_admin());
create policy profiles_admin_update on profiles for update to authenticated
  using (is_admin()) with check (is_admin());

create policy groups_member on groups for select to authenticated
  using (id = current_group_id());

create policy sessions_member on daily_lunch_sessions for select to authenticated
  using (group_id = current_group_id());
create policy sessions_write on daily_lunch_sessions for insert to authenticated
  with check (group_id = current_group_id());
create policy sessions_update on daily_lunch_sessions for update to authenticated
  using (group_id = current_group_id());

create policy prefs_select on lunch_preferences for select to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id = current_group_id()));
create policy prefs_write on lunch_preferences for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from daily_lunch_sessions where id = session_id and status = 'collecting'));
create policy prefs_update on lunch_preferences for update to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from daily_lunch_sessions where id = session_id and status = 'collecting'));

create policy recs_select on recommendations for select to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id = current_group_id()));
-- recommendations are written by server routes via the session-holder's own
-- transition action; inserts happen through the RPC below or authenticated
-- inserts scoped to the user's group session.
create policy recs_write on recommendations for insert to authenticated
  with check (session_id in (select id from daily_lunch_sessions where group_id = current_group_id()));
create policy recs_update on recommendations for update to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id = current_group_id()));

create policy votes_select on votes for select to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id = current_group_id()));
create policy votes_upsert on votes for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from daily_lunch_sessions where id = session_id and status = 'voting'));
create policy votes_change on votes for update to authenticated
  using (user_id = auth.uid());

-- ── Invite-code join without leaking other groups' rows to the client. ──────
create or replace function join_group_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select id into v_group from groups where invite_code = upper(trim(p_code));
  if v_group is null then raise exception 'invalid_code'; end if;
  update profiles set group_id = v_group where id = auth.uid();
  insert into daily_lunch_sessions(group_id)
    select v_group where not exists (
      select 1 from daily_lunch_sessions where group_id = v_group and status <> 'closed');
  return v_group;
end; $$;

create or replace function create_group(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  for i in 1..8 loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from groups where invite_code = v_code);
  end loop;
  insert into groups(name, invite_code, created_by) values (p_name, v_code, auth.uid()) returning id into v_id;
  update profiles set group_id = v_id where id = auth.uid();
  insert into daily_lunch_sessions(group_id) values (v_id);
  return v_id;
end; $$;

-- profile auto-creation on signup. Admin-created accounts pass username /
-- full_name / team / role / must_change_password in user_metadata; anything
-- missing falls back to the email local part.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username text := coalesce(new.raw_user_meta_data->>'username',
                              lower(split_part(new.email,'@',1)));
begin
  insert into profiles(id, username, full_name, email, team, role,
                       account_status, must_change_password, display_name)
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'team', ''),
    case when new.raw_user_meta_data->>'role' = 'admin' then 'admin' else 'user' end,
    'active',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), v_username)
  );
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── Bootstrapping the first administrator ──────────────────────────────────
-- Create the first account via the Supabase dashboard (or signup), then run:
--   update profiles set role = 'admin' where email = 'you@company.com';
-- Every further account should be created from /admin/users.
