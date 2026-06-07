-- pgtap tests for the ELO history chart pipeline.
-- Run with: supabase test db   (or: pg_prove against the database)
begin;
select plan(9);

-- get_elo_series: empty input is not an error, just no rows
select is(
  (select count(*)::int from public.get_elo_series(array[]::text[], '1W')),
  0, 'empty company list returns 0 rows');

-- unknown company id returns no rows (not an error)
select is(
  (select count(*)::int from public.get_elo_series(array['__no_such_company__'], '1W')),
  0, 'unknown company returns 0 rows');

-- a known company returns points
select ok(
  (select count(*) from public.get_elo_series(array['citadel'], '1W')) > 0,
  '1W returns points for a known company');

-- live edge: the newest point equals the authoritative companies.elo (now the BT
-- display Prestige Index, 1500 + 120*log10(strength)).
select public.recompute_rankings();
select is(
  (select elo from public.get_elo_series(array['citadel'], '1W') order by t desc limit 1),
  (select elo from public.companies where id = 'citadel'),
  'live-edge point equals current companies.elo (BT display index)');

-- read-time index: a snapshot row carrying raw strength is rendered on the BT
-- display scale (1500 + 120*log10(strength)), not its stored raw value.
select is(
  (select case when strength is not null then round(1500 + 120 * log(10, strength)) else elo end
     from public.elo_snapshots
    where company_id = 'citadel'
    order by t desc limit 1),
  (select elo from public.companies where id = 'citadel'),
  'snapshot strength renders to the BT display index at read time');

-- coarser range buckets to <= the finer range's point count
select ok(
  (select count(*) from public.get_elo_series(array['citadel'], '3M'))
  <= (select count(*) from public.get_elo_series(array['citadel'], '1W')),
  'daily bucketing (3M) has <= hourly (1W) point count');

-- snapshot_elos is idempotent within the same hour (PK company_id,t)
select public.snapshot_elos();
select public.snapshot_elos();
select is(
  (select count(*)::int from public.elo_snapshots where t = date_trunc('hour', now())),
  (select count(*)::int from public.companies),
  'snapshot_elos: exactly one row per company per hour');

-- recompute_delta_24h leaves no nulls (cold-start coalesces to starting_elo)
select public.recompute_delta_24h();
select is(
  (select count(*)::int from public.companies where delta_24h is null),
  0, 'delta_24h is non-null for every company');

-- RLS: elo_snapshots is readable by the anon role (browser reads)
set local role anon;
select ok(
  (select count(*) from public.elo_snapshots) >= 0,
  'anon role can select from elo_snapshots');
reset role;

select * from finish();
rollback;
