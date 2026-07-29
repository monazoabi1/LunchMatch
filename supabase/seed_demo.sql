-- Demo seed — run at Hour 7 to pre-populate a realistic group for rehearsal
-- and as fallback ladder L2 (a second group already sitting in 'voting').
--
-- PREREQUISITE: create the 3 demo accounts FIRST (email confirmation off):
--   demo1@lunchmatch.dev / demo2@lunchmatch.dev / demo3@lunchmatch.dev
-- via the app's signup page or the Supabase Auth dashboard. The signup trigger
-- creates their profiles; this script only wires groups/sessions/prefs.

do $$
declare
  u1 uuid; u2 uuid; u3 uuid;
  g1 uuid; g2 uuid;
  s1 uuid; s2 uuid;
  r1 uuid; r2 uuid; r3 uuid;
begin
  select id into u1 from auth.users where email = 'demo1@lunchmatch.dev';
  select id into u2 from auth.users where email = 'demo2@lunchmatch.dev';
  select id into u3 from auth.users where email = 'demo3@lunchmatch.dev';
  if u1 is null or u2 is null or u3 is null then
    raise exception 'Create demo1/demo2/demo3@lunchmatch.dev accounts first (see header comment)';
  end if;

  -- ── Group 1: TACO42 — fresh, in 'collecting', prefs pre-filled ────────────
  insert into groups(name, invite_code, created_by)
    values ('Taco Tuesday Crew', 'TACO42', u1)
    on conflict (invite_code) do update set name = excluded.name
    returning id into g1;

  update profiles set group_id = g1, avatar_emoji = '🌮' where id = u1;
  update profiles set group_id = g1, avatar_emoji = '🥗' where id = u2;
  update profiles set group_id = g1, avatar_emoji = '🍕' where id = u3;

  -- close any open session for the group, then open a fresh collecting one
  update daily_lunch_sessions set status = 'closed', closed_at = now()
    where group_id = g1 and status <> 'closed';
  insert into daily_lunch_sessions(group_id) values (g1) returning id into s1;

  insert into lunch_preferences(session_id, user_id, attendance, available_from, available_to,
      max_budget, categories, dietary, transport, max_walking_minutes, comment)
  values
    (s1, u1, 'yes',   '12:00', '13:30', 15, '{mexican,burgers}',      '{}',           'walk', 12, 'Taco Tuesday is not optional'),
    (s1, u2, 'yes',   '12:15', '13:00', 12, '{salad,bowls,mexican}',  '{vegetarian}', 'walk',  8, 'Something green please'),
    (s1, u3, 'maybe', '12:00', '14:00', 20, '{pizza,mexican,asian}',  '{}',           'walk', 15, 'Might have a call at 1');

  -- ── Group 2: VOTE99 — fallback L2, frozen mid-'voting' with recs + AI copy ─
  insert into groups(name, invite_code, created_by)
    values ('Fallback Friends', 'VOTE99', u1)
    on conflict (invite_code) do nothing;
  select id into g2 from groups where invite_code = 'VOTE99';

  update daily_lunch_sessions set status = 'closed', closed_at = now()
    where group_id = g2 and status <> 'closed';
  insert into daily_lunch_sessions(group_id, status) values (g2, 'voting') returning id into s2;

  insert into recommendations(session_id, restaurant_id, restaurant_name, rank, score, score_breakdown, ai_why, ai_slogan, ai_source)
  values
    (s2, 'falafel-mishel', 'Falafel Mishel', 1, 11,
     '[{"rule":"dietary_ok","points":3,"label":"Works for everyone''s dietary needs"},{"rule":"category_match","points":3,"label":"Matches what the group is craving"},{"rule":"in_budget","points":2,"label":"Fits the group budget"},{"rule":"transport_ok","points":2,"label":"Walkable for the whole crew"},{"rule":"open_now","points":1,"label":"Open during your window"}]',
     'Three people typed "falafel" independently and then spent ten minutes pretending other options existed. The Turkish market settles all remaining debates.',
     'Democracy, deep fried.', 'fallback'),
    (s2, 'abu-shakker', 'Abu Shakker', 2, 9,
     '[{"rule":"dietary_ok","points":3,"label":"Works for everyone''s dietary needs"},{"rule":"in_budget","points":2,"label":"Fits the group budget"},{"rule":"transport_ok","points":2,"label":"Walkable for the whole crew"},{"rule":"walk_ok","points":2,"label":"Short walk"}]',
     'For the contingent that says "anything works" and then vetoes everything: hummus is the diplomatic option nobody can argue with.',
     'Consensus, with extra pita.', 'fallback'),
    (s2, 'breada', 'Breada', 3, 8,
     '[{"rule":"dietary_ok","points":3,"label":"Works for everyone''s dietary needs"},{"rule":"in_budget","points":2,"label":"Fits the group budget"},{"rule":"transport_ok","points":2,"label":"Walkable for the whole crew"},{"rule":"open_now","points":1,"label":"Open during your window"}]',
     'Build-your-own sandwiches mean the 12:15-vs-12:30 negotiation is the only decision left to fight about.',
     'Assemble your own consensus.', 'fallback');

  select id into r1 from recommendations where session_id = s2 and rank = 1;
  insert into votes(session_id, user_id, recommendation_id) values (s2, u1, r1)
    on conflict (session_id, user_id) do nothing;

  raise notice 'Seed complete. TACO42 (collecting) and VOTE99 (voting) ready.';
end $$;
