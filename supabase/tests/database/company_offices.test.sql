-- pgtap tests for company_offices (interactive map office table + seed).
-- Run with: supabase test db   (or: pg_prove against the database)
-- Wrapped in begin/rollback so every mutation auto-reverts.
begin;
select plan(4);

-- RLS: the anon role can actually READ a row (the public-read policy works).
-- Insert a probe row as the privileged test role, then assert anon sees it.
-- A weaker `count(*) >= 0` check would pass even with the policy missing
-- (RLS on + no policy => anon sees 0 rows, no error) — the exact silent
-- "empty map in prod" failure this test exists to catch. So we prove visibility.
insert into public.company_offices (company_id, city, lat, lng, is_hq)
  values ((select id from public.companies limit 1), '__rls_probe__', 1, 1, false);
set local role anon;
select is(
  (select count(*)::int from public.company_offices where city = '__rls_probe__'),
  1,
  'anon role can read company_offices rows (public-read policy grants select)');
reset role;

-- region CHECK rejects an unknown key (must be in the curated metro list or null).
select throws_ok(
  $$insert into public.company_offices (company_id, city, region, lat, lng)
    values ('citadel', 'Nowhere', 'bayy', 0, 0)$$,
  '23514',
  null,
  'region CHECK rejects an unknown key');

-- FK integrity: an office referencing a non-existent company is rejected.
select throws_ok(
  $$insert into public.company_offices (company_id, city, lat, lng)
    values ('__no_such_company__', 'Nowhere', 0, 0)$$,
  '23503',
  null,
  'FK rejects an office for a non-existent company');

-- Seed integrity: every company has at least one is_hq=true office row.
select is(
  (select count(*)::int
     from public.companies c
    where not exists (
      select 1 from public.company_offices o
       where o.company_id = c.id and o.is_hq
    )),
  0, 'every company has at least one is_hq office');

select * from finish();
rollback;
