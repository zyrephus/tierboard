-- Prestige Index — Bradley-Terry rework.
--
-- Before: recompute_rankings() replayed the deduped vote log chronologically
-- through ELO (K=40/24/12). Same votes in a different order -> different board
-- (order dependence) and no confidence signal.
--
-- After: recompute_rankings() fits a global Bradley-Terry model (MM solver) over
-- the same deduped vote set. Order-independent by construction. companies.elo
-- stays as the column name but now holds the DISPLAY Prestige Index
-- (1500 + 120*log10(p)); the raw normalized strength p is stored separately so
-- the display scale stays re-tunable without rewriting history.
--
-- recompute_rankings() remains the SOLE writer of companies.elo. process_vote
-- stays append-only (+ a new source flag). starting_elo is no longer used by the
-- solver (the regularizer anchor handles cold start); the column is left in place.

-- 1. SCHEMA additions.
alter table public.companies
  add column if not exists strength numeric,
  add column if not exists games int not null default 0,
  add column if not exists index_se numeric;

alter table public.votes
  add column if not exists source text;

alter table public.elo_snapshots
  add column if not exists strength numeric;

-- 2. process_vote -> append-only, now also records an optional source flag.
--    Return type is unchanged (void), but the arity changes, so drop the old
--    5-arg signature first.
drop function if exists public.process_vote(text, text, text, text, text);

create function public.process_vote(
  p_winner_id text,
  p_loser_id  text,
  p_cohort    text default 'all',
  p_session_id text default null,
  p_secret    text default null,
  p_source    text default null
) returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_secret text;
  v_source text;
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

  -- Validate source to the known vocabulary; anything else stored as null.
  v_source := case when p_source in ('gauntlet', 'random') then p_source else null end;

  -- elo_delta is computed in batch now; store 0 as a placeholder.
  insert into votes (winner_id, loser_id, elo_delta, cohort, session_id, source)
       values (p_winner_id, p_loser_id, 0, p_cohort, p_session_id, v_source);
end;
$$;

-- 3. recompute_rankings -> Bradley-Terry MM solver, sole writer of companies.elo.
--
-- Model: each company i has latent strength p_i > 0; P(i beats j) = p_i/(p_i+p_j).
-- MM update (regularized):
--   p_i = (W_i + 0.5) / ( Σ_j n_ij/(p_i+p_j) + 1/(p_i+1) )
-- The +0.5 phantom win and +1/(p_i+1) phantom game vs a unit-strength anchor are
-- REQUIRED: they keep the fit finite even with undefeated/winless companies and a
-- disconnected early graph. After each iteration p is renormalized so its
-- geometric mean is 1 (centers log10(p) at 0 -> index centers at 1500). Iterate
-- until max_i |ln(p_new) - ln(p_old)| < 1e-4, hard safety cap 500 iterations.
create or replace function public.recompute_rankings()
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_iter      int := 0;
  v_max_delta numeric;
  v_gm        numeric;
begin
  -- Deduped vote set: at most one vote per (session, unordered pair, 12h window).
  -- Null sessions can't be deduped, so coalesce to the vote id keeps each distinct.
  create temp table tmp_dedup on commit drop as
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
      ) d;

  -- Per-company strength + deduped game/win/loss counts. p initialized to 1.
  create temp table tmp_p on commit drop as
    select id, 1.0::numeric as p, 1.0::numeric as p_old,
           0::int as games, 0::int as wins, 0::int as losses
      from companies;
  create unique index on tmp_p (id);

  -- Deduped wins / losses (votes referencing since-deleted companies are dropped
  -- by the join to tmp_p, so they never inflate counts).
  update tmp_p t
     set wins = w.c
    from (select winner_id as id, count(*) as c from tmp_dedup group by winner_id) w
   where w.id = t.id;
  update tmp_p t
     set losses = l.c
    from (select loser_id as id, count(*) as c from tmp_dedup group by loser_id) l
   where l.id = t.id;
  update tmp_p set games = wins + losses;

  -- Symmetric pair counts n_ij (each unordered pair stored both directions so the
  -- denominator sum is a simple group-by over id_i). Pairs referencing a
  -- since-deleted company are excluded.
  create temp table tmp_pairs on commit drop as
    select id_i, id_j, count(*) as n
      from (
        select least(winner_id, loser_id) as id_i,
               greatest(winner_id, loser_id) as id_j
          from tmp_dedup
      ) x
     where id_i in (select id from tmp_p)
       and id_j in (select id from tmp_p)
     group by id_i, id_j;
  insert into tmp_pairs (id_i, id_j, n)
       select id_j, id_i, n from tmp_pairs;
  create index on tmp_pairs (id_i);

  -- MM iteration with per-pass geometric-mean normalization.
  loop
    v_iter := v_iter + 1;
    update tmp_p set p_old = tmp_p.p;

    update tmp_p t
       set p = (t.wins + 0.5) / (
                 coalesce((
                   select sum(pc.n / (t.p_old + o.p_old))
                     from tmp_pairs pc
                     join tmp_p o on o.id = pc.id_j
                    where pc.id_i = t.id
                 ), 0)
                 + 1.0 / (t.p_old + 1.0)
               );

    -- Normalize so geomean(p) = 1. Mandatory, inside the loop.
    select exp(avg(ln(tmp_p.p))) into v_gm from tmp_p;
    update tmp_p set p = tmp_p.p / v_gm;

    select max(abs(ln(tmp_p.p) - ln(tmp_p.p_old))) into v_max_delta from tmp_p;
    exit when v_max_delta < 1e-4 or v_iter >= 500;
  end loop;

  -- Publish in one bulk write. elo is the display Prestige Index; strength is the
  -- raw normalized p. index_se is the sample-size confidence proxy (k/sqrt(games)).
  update companies c
     set strength   = t.p,
         elo        = round(1500 + 120 * log(10, t.p)),
         games      = t.games,
         index_se   = 400 / sqrt(greatest(t.games, 1)),
         votes      = t.games,
         wins       = t.wins,
         losses     = t.losses,
         updated_at = now()
    from tmp_p t
   where t.id = c.id;

  -- Recompute ranks (rank_prev keeps the prior rank for trend arrows).
  with ranked as (
    select id, row_number() over (order by elo desc) as rk from companies
  )
  update companies c
     set rank_prev = c.rank, rank = ranked.rk
    from ranked
   where ranked.id = c.id;

  -- Snapshot the official series (raw strength + display index) + 24h trend.
  insert into elo_snapshots (company_id, t, elo, votes, strength)
       select id, now(), elo, votes, strength from companies;

  perform public.recompute_delta_24h();
end;
$$;

-- 4. snapshot_elos -> also store raw strength going forward.
create or replace function public.snapshot_elos()
  returns void
  language sql
  security definer
  set search_path to 'public'
as $$
  insert into public.elo_snapshots (company_id, t, elo, votes, strength)
  select id, date_trunc('hour', now()), elo, votes, strength
  from public.companies
  on conflict (company_id, t) do update
    set elo = excluded.elo, votes = excluded.votes, strength = excluded.strength;
$$;

-- 5. get_elo_series -> compute the DISPLAY index at read time so the scale stays
--    re-tunable without overwriting history. New snapshot rows carry raw strength
--    (-> 1500 + 120*log10(p)); old rows have null strength so their stored elo is
--    returned as-is (one-time pre-cutover seam). The live edge reads
--    companies.elo, which already holds the display index.
create or replace function public.get_elo_series(
  p_company_ids text[],
  p_range text default '1W'
) returns table(company_id text, t timestamptz, elo numeric)
  language sql
  stable
  set search_path to 'public'
as $$
  with params as (
    select
      case p_range
        when '1D' then now() - interval '1 day'
        when '1W' then now() - interval '7 days'
        when '3M' then now() - interval '3 months'
        when '1Y' then now() - interval '1 year'
        else '-infinity'::timestamptz
      end as since,
      case p_range
        when '1D' then 'hour'
        when '1W' then 'hour'
        when '3M' then 'day'
        when '1Y' then 'day'
        else 'week'
      end as bucket
  ),
  bucketed as (
    select distinct on (s.company_id, date_trunc(p.bucket, s.t))
      s.company_id,
      date_trunc(p.bucket, s.t) as t,
      case
        when s.strength is not null then round(1500 + 120 * log(10, s.strength))
        else s.elo
      end as elo
    from public.elo_snapshots s
    cross join params p
    where s.company_id = any(p_company_ids)
      and s.t >= p.since
    order by s.company_id, date_trunc(p.bucket, s.t), s.t desc
  ),
  live as (
    select c.id as company_id, date_trunc('second', now()) as t, c.elo
    from public.companies c
    where c.id = any(p_company_ids)
  )
  select company_id, t, elo from bucketed
  union all
  select company_id, t, elo from live
  order by company_id, t;
$$;
