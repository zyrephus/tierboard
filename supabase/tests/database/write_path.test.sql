-- #7b regression test: companies.elo has exactly one writer (recompute_rankings).
-- process_vote is append-only; the batch recompute is the sole elo writer.
-- Wrapped in begin/rollback so the vote mutations auto-revert.
begin;

do $$
declare
  v_secret_pv text := (select value from public.app_secrets where name = 'vote_secret');
  v_secret_lb text := (select value from private.app_config where key = 'vote_secret');
  v_before numeric; v_rows int; v_after numeric; v_lb_before numeric;
begin
  -- process_vote is append-only: logs exactly one votes row and must NOT touch elo
  select elo into v_before from public.companies where id = 'citadel';
  select count(*) into v_rows from public.votes;
  perform public.process_vote('citadel', 'openai', 'all', null, v_secret_pv);
  select elo into v_after from public.companies where id = 'citadel';
  assert v_after = v_before, 'process_vote must not mutate companies.elo';
  assert (select count(*) from public.votes) = v_rows + 1,
    'process_vote did not log exactly one votes row';

  -- recompute_rankings is the writer: replaying the log assigns elo + ranks
  perform public.recompute_rankings();
  assert (select rank from public.companies where id = 'citadel') is not null,
    'recompute_rankings did not assign ranks';

  -- process_leaderboard_vote (prestige) must NOT mutate companies.elo
  select elo into v_lb_before from public.companies where id = 'citadel';
  perform public.process_leaderboard_vote('citadel', 'openai', 'all', null, v_secret_lb, 'prestige');
  assert (select elo from public.companies where id = 'citadel') = v_lb_before,
    'process_leaderboard_vote must not mutate companies.elo (single-writer invariant)';
end $$;

rollback;
