-- ⚠️ BREAK-GLASS ONLY: run if RLS misbehaves during the live demo.
-- Using this is not failure; failing the demo is.
alter table profiles disable row level security;
alter table groups disable row level security;
alter table daily_lunch_sessions disable row level security;
alter table lunch_preferences disable row level security;
alter table recommendations disable row level security;
alter table votes disable row level security;
