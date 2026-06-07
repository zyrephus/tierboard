-- pgtap tests for the Bradley-Terry estimator (recompute_rankings).
-- Run with: supabase test db   (or: pg_prove against the database)
-- Wrapped in begin/rollback so every mutation auto-reverts.
begin;
select plan(8);

-- Pick three real company ids to drive deterministic scenarios. They exist in the
-- seed data; using them keeps the FK on votes/elo_snapshots satisfied.
-- a = citadel, b = openai, c = stripe.

-- ORDER-INDEPENDENCE (critical, weak form): the BT fit is a global optimum, so
-- running recompute_rankings twice over an unchanged vote set yields identical
-- companies.elo / strength. This guards against any hidden order/iteration
-- dependence in the solver itself.
select public.recompute_rankings();
create temp table _run1 as
  select id, elo, strength from public.companies order by id;
select public.recompute_rankings();
create temp table _run2 as
  select id, elo, strength from public.companies order by id;

select is(
  (select count(*)::int from _run1 r1
     join _run2 r2 using (id)
    where r1.elo is distinct from r2.elo
       or r1.strength is distinct from r2.strength),
  0, 'recompute_rankings is deterministic: identical elo + strength across runs');

-- ORDER-INDEPENDENCE (critical, strong form): insert the SAME small set of votes
-- in two different created_at orders and assert identical resulting strengths.
-- Done in two nested savepoints so each scenario starts from the same DB state.
do $$
declare
  v_secret text := (select value from public.app_secrets where name = 'vote_secret');
  v_fwd_a numeric; v_fwd_b numeric; v_fwd_c numeric;
  v_rev_a numeric; v_rev_b numeric; v_rev_c numeric;
begin
  -- Scenario 1: forward insertion order.
  savepoint s_fwd;
  delete from public.votes;
  delete from public.elo_snapshots;
  perform public.process_vote('citadel', 'openai', 'all', 'sess_fwd_1', v_secret);
  perform public.process_vote('openai',  'stripe', 'all', 'sess_fwd_2', v_secret);
  perform public.process_vote('citadel', 'stripe', 'all', 'sess_fwd_3', v_secret);
  perform public.recompute_rankings();
  select strength into v_fwd_a from public.companies where id = 'citadel';
  select strength into v_fwd_b from public.companies where id = 'openai';
  select strength into v_fwd_c from public.companies where id = 'stripe';
  rollback to savepoint s_fwd;

  -- Scenario 2: reverse insertion order, same logical vote set.
  savepoint s_rev;
  delete from public.votes;
  delete from public.elo_snapshots;
  perform public.process_vote('citadel', 'stripe', 'all', 'sess_fwd_3', v_secret);
  perform public.process_vote('openai',  'stripe', 'all', 'sess_fwd_2', v_secret);
  perform public.process_vote('citadel', 'openai', 'all', 'sess_fwd_1', v_secret);
  perform public.recompute_rankings();
  select strength into v_rev_a from public.companies where id = 'citadel';
  select strength into v_rev_b from public.companies where id = 'openai';
  select strength into v_rev_c from public.companies where id = 'stripe';
  rollback to savepoint s_rev;

  assert v_fwd_a = v_rev_a and v_fwd_b = v_rev_b and v_fwd_c = v_rev_c,
    format('strengths must be insertion-order-independent (fwd %s/%s/%s vs rev %s/%s/%s)',
           v_fwd_a, v_fwd_b, v_fwd_c, v_rev_a, v_rev_b, v_rev_c);
end $$;
select ok(true, 'strong order-independence: identical strengths for shuffled inserts');

-- FINITE CONVERGENCE (critical): an undefeated company (wins only, no losses) must
-- still get a finite, non-null index + strength — the regularizer prevents p -> ∞.
do $$
declare
  v_secret text := (select value from public.app_secrets where name = 'vote_secret');
begin
  savepoint s_undef;
  delete from public.votes;
  delete from public.elo_snapshots;
  -- citadel beats three distinct opponents and never loses.
  perform public.process_vote('citadel', 'openai',  'all', 'sess_u1', v_secret);
  perform public.process_vote('citadel', 'stripe',  'all', 'sess_u2', v_secret);
  perform public.process_vote('citadel', 'google',  'all', 'sess_u3', v_secret);
  perform public.recompute_rankings();

  assert (select elo from public.companies where id = 'citadel') is not null,
    'undefeated company must have a non-null elo';
  assert (select strength from public.companies where id = 'citadel') is not null,
    'undefeated company must have a non-null strength';
  assert (select strength from public.companies where id = 'citadel') < 1e6,
    'undefeated company strength must be finite (regularizer works)';
  assert (select elo from public.companies where id = 'citadel') < 1e6,
    'undefeated company elo must be finite';
  rollback to savepoint s_undef;
end $$;
select ok(true, 'finite convergence: undefeated company gets a finite, non-null index');

-- CONVERGENCE TERMINATES: recompute_rankings completes without error over the full
-- live vote set (implicitly exercises the 500-iteration safety cap).
select lives_ok(
  'select public.recompute_rankings()',
  'recompute_rankings terminates without error (convergence loop / cap)');

-- EMPTY / COLD START: a company with zero deduped games still gets a finite
-- strength (≈1, the regularizer anchor) and a finite elo (≈1500).
do $$
declare v_strength numeric; v_elo numeric;
begin
  savepoint s_cold;
  delete from public.votes;
  delete from public.elo_snapshots;
  perform public.recompute_rankings();
  select strength, elo into v_strength, v_elo from public.companies where id = 'citadel';
  assert v_strength is not null and v_elo is not null,
    'cold-start company must have non-null strength + elo';
  assert abs(v_strength - 1.0) < 1e-3,
    format('cold-start strength must be ≈1, got %s', v_strength);
  assert abs(v_elo - 1500) < 1.0,
    format('cold-start elo must be ≈1500, got %s', v_elo);
  rollback to savepoint s_cold;
end $$;
select ok(true, 'cold start: zero-game company gets strength ≈1 and elo ≈1500');

-- GAMES COUNT: companies.games equals the deduped game count for a known company.
do $$
declare
  v_secret text := (select value from public.app_secrets where name = 'vote_secret');
  v_games int;
begin
  savepoint s_games;
  delete from public.votes;
  delete from public.elo_snapshots;
  -- citadel plays 3 deduped games (distinct sessions => no dedup collapse).
  perform public.process_vote('citadel', 'openai', 'all', 'sess_g1', v_secret);
  perform public.process_vote('stripe',  'citadel','all', 'sess_g2', v_secret);
  perform public.process_vote('citadel', 'google', 'all', 'sess_g3', v_secret);
  perform public.recompute_rankings();
  select games into v_games from public.companies where id = 'citadel';
  assert v_games = 3, format('expected games=3 for citadel, got %s', v_games);
  rollback to savepoint s_games;
end $$;
select ok(true, 'games count: companies.games equals the deduped game count');

-- DEDUP survives: two votes in the same (session, pair, 12h) window count once.
do $$
declare
  v_secret text := (select value from public.app_secrets where name = 'vote_secret');
  v_games int;
begin
  savepoint s_dedup;
  delete from public.votes;
  delete from public.elo_snapshots;
  perform public.process_vote('citadel', 'openai', 'all', 'sess_dup', v_secret);
  perform public.process_vote('citadel', 'openai', 'all', 'sess_dup', v_secret);
  perform public.recompute_rankings();
  select games into v_games from public.companies where id = 'citadel';
  assert v_games = 1, format('dedup must collapse same session/pair/window to 1, got %s', v_games);
  rollback to savepoint s_dedup;
end $$;
select ok(true, 'dedup: same session+pair+window collapses to one deduped game');

-- INDEX_SE proxy: the sample-size confidence proxy is 400/sqrt(max(games,1)).
do $$
declare
  v_secret text := (select value from public.app_secrets where name = 'vote_secret');
  v_se numeric; v_games int;
begin
  savepoint s_se;
  delete from public.votes;
  delete from public.elo_snapshots;
  perform public.process_vote('citadel', 'openai', 'all', 'sess_se1', v_secret);
  perform public.process_vote('citadel', 'stripe', 'all', 'sess_se2', v_secret);
  perform public.recompute_rankings();
  select index_se, games into v_se, v_games from public.companies where id = 'citadel';
  assert v_games = 2, format('expected games=2, got %s', v_games);
  assert abs(v_se - 400 / sqrt(2)) < 1e-6,
    format('index_se must be 400/sqrt(games), got %s', v_se);
  rollback to savepoint s_se;
end $$;
select ok(true, 'index_se equals 400/sqrt(max(games,1))');

select * from finish();
rollback;
