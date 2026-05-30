-- Batch ranking model.
--
-- Before: process_vote moved companies.elo on every vote (K=32, no dedup) and
-- realtime pushed each move to clients — volatile, and trivially brigaded.
--
-- After: `votes` is the source of truth. process_vote only validates + appends.
-- recompute_rankings() is the SOLE writer of companies.elo: hourly (via the
-- existing cron -> hourly_elo_job) it replays the whole log with
--   * per-(session, unordered pair, 12h window) dedup  — defeats a single spammer
--   * vote-count-decayed K (40 / 24 / 12)               — established companies
--     barely move, so a small brigade can't shift them; new ones calibrate fast
-- then snapshots the official series and refreshes the 24h trend.

-- 1. process_vote -> append-only. Return type changes (TABLE -> void), so drop first.
drop function if exists public.process_vote(text, text, text, text, text);

create function public.process_vote(
  p_winner_id text,
  p_loser_id  text,
  p_cohort    text default 'all',
  p_session_id text default null,
  p_secret    text default null
) returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select value into v_secret from app_secrets where name = 'vote_secret';
  if p_secret is null or p_secret is distinct from v_secret then
    raise exception 'unauthorized';
  end if;

  if p_winner_id = p_loser_id then
    raise exception 'winner and loser cannot be the same';
  end if;

  perform 1 from companies where id = p_winner_id;
  if not found then raise exception 'unknown company id'; end if;
  perform 1 from companies where id = p_loser_id;
  if not found then raise exception 'unknown company id'; end if;

  -- elo_delta is computed in batch now; store 0 as a placeholder.
  insert into votes (winner_id, loser_id, elo_delta, cohort, session_id)
       values (p_winner_id, p_loser_id, 0, p_cohort, p_session_id);
end;
$$;

-- 2. recompute_rankings -> sole writer of companies.elo.
create or replace function public.recompute_rankings()
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  r     record;
  w_elo numeric; l_elo numeric;
  w_n   int;     l_n   int;
  p_w   numeric; k_w   numeric; k_l numeric;
begin
  -- Working set seeded from each company's starting elo.
  create temp table tmp_elo on commit drop as
    select id, starting_elo::numeric as elo, 0::int as n,
           0::int as votes, 0::int as wins, 0::int as losses
      from companies;
  create index on tmp_elo (id);

  -- Replay deduped votes chronologically. Dedup: at most one vote per
  -- (session, unordered pair, 12h window = 43200s). Null sessions can't be
  -- deduped, so coalesce to the vote id keeps each one distinct.
  for r in
    select winner_id, loser_id
      from (
        select distinct on (
                 coalesce(session_id, id::text),
                 least(winner_id, loser_id), greatest(winner_id, loser_id),
                 floor(extract(epoch from created_at) / 43200)
               )
               winner_id, loser_id, created_at
          from votes
         order by coalesce(session_id, id::text),
                  least(winner_id, loser_id), greatest(winner_id, loser_id),
                  floor(extract(epoch from created_at) / 43200),
                  created_at
      ) d
     order by created_at
  loop
    select elo, n into w_elo, w_n from tmp_elo where id = r.winner_id;
    select elo, n into l_elo, l_n from tmp_elo where id = r.loser_id;
    if w_elo is null or l_elo is null then
      continue;  -- vote referencing a since-deleted company
    end if;

    p_w := 1.0 / (1.0 + power(10.0, (l_elo - w_elo) / 400.0));
    -- Per-company decayed K: stable once a company has many votes.
    k_w := case when w_n < 30 then 40 when w_n < 200 then 24 else 12 end;
    k_l := case when l_n < 30 then 40 when l_n < 200 then 24 else 12 end;

    update tmp_elo
       set elo = elo + k_w * (1.0 - p_w),
           n = n + 1, votes = votes + 1, wins = wins + 1
     where id = r.winner_id;
    update tmp_elo
       set elo = elo - k_l * (1.0 - p_w),
           n = n + 1, votes = votes + 1, losses = losses + 1
     where id = r.loser_id;
  end loop;

  -- Publish in one bulk write.
  update companies c
     set elo = t.elo, votes = t.votes, wins = t.wins, losses = t.losses,
         updated_at = now()
    from tmp_elo t
   where t.id = c.id;

  -- Recompute ranks (rank_prev keeps the prior rank for trend arrows).
  with ranked as (
    select id, row_number() over (order by elo desc) as rk from companies
  )
  update companies c
     set rank_prev = c.rank, rank = ranked.rk
    from ranked
   where ranked.id = c.id;

  -- Snapshot the official series + refresh the 24h trend.
  insert into elo_snapshots (company_id, t, elo, votes)
       select id, now(), elo, votes from companies;

  perform public.recompute_delta_24h();
end;
$$;

-- 3. Point the existing hourly cron at the recompute (cron schedule unchanged).
create or replace function public.hourly_elo_job()
  returns void
  language sql
  security definer
  set search_path to 'public'
as $$
  select public.recompute_rankings();
$$;
