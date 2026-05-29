-- Generalize TierBoard from one rating surface to multiple leaderboards.
-- Before production use, set private.app_config.vote_secret to the same value
-- as the server-side VOTE_SECRET environment variable:
--
-- insert into private.app_config (key, value)
-- values ('vote_secret', '<same value as VOTE_SECRET>')
-- on conflict (key) do update set value = excluded.value;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table private.app_config enable row level security;

create table if not exists public.leaderboards (
  id text primary key,
  label text not null,
  short_label text not null,
  prompt text not null,
  description text not null,
  sort_order integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leaderboards enable row level security;
grant select on table public.leaderboards to anon, authenticated;
drop policy if exists "Leaderboards are public" on public.leaderboards;
create policy "Leaderboards are public"
  on public.leaderboards
  for select
  to anon, authenticated
  using (true);

insert into public.leaderboards (id, label, short_label, prompt, description, sort_order)
values
  (
    'prestige',
    'Prestige',
    'Prestige',
    'Would you rather work at',
    'Overall desirability and tech career signal.',
    10
  ),
  (
    'work_life_balance',
    'Work-life balance',
    'WLB',
    'Which company has better work-life balance?',
    'Sustainable pace, flexibility, and day-to-day quality of life.',
    20
  ),
  (
    'benefits_compensation',
    'Benefits and compensation',
    'Comp & benefits',
    'Which company has stronger compensation and benefits?',
    'Pay, equity, healthcare, perks, and financial upside.',
    30
  ),
  (
    'impact',
    'Impact',
    'Impact',
    'Where could you have more impact?',
    'Scope, mission, leverage, and ability to do meaningful work.',
    40
  )
on conflict (id) do update
set
  label = excluded.label,
  short_label = excluded.short_label,
  prompt = excluded.prompt,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.company_leaderboard_stats (
  leaderboard_id text not null references public.leaderboards(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  elo numeric not null default 1500,
  starting_elo numeric not null default 1500,
  votes integer not null default 0 check (votes >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  delta_24h numeric not null default 0,
  rank integer,
  rank_prev integer,
  updated_at timestamptz not null default now(),
  primary key (leaderboard_id, company_id),
  check (wins + losses <= votes)
);

create index if not exists company_leaderboard_stats_leaderboard_elo_idx
  on public.company_leaderboard_stats (leaderboard_id, elo desc);

create index if not exists company_leaderboard_stats_company_idx
  on public.company_leaderboard_stats (company_id);

alter table public.company_leaderboard_stats enable row level security;
grant select on table public.company_leaderboard_stats to anon, authenticated;
drop policy if exists "Leaderboard stats are public" on public.company_leaderboard_stats;
create policy "Leaderboard stats are public"
  on public.company_leaderboard_stats
  for select
  to anon, authenticated
  using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.company_leaderboard_stats;
    exception
      when duplicate_object then null;
    end;
  end if;
end;
$$;

insert into public.company_leaderboard_stats (
  leaderboard_id,
  company_id,
  elo,
  starting_elo,
  votes,
  wins,
  losses,
  delta_24h,
  updated_at
)
select
  'prestige',
  c.id,
  c.elo,
  c.starting_elo,
  c.votes,
  c.wins,
  c.losses,
  c.delta_24h,
  c.updated_at
from public.companies c
on conflict (leaderboard_id, company_id) do nothing;

insert into public.company_leaderboard_stats (leaderboard_id, company_id)
select l.id, c.id
from public.leaderboards l
cross join public.companies c
where l.id in ('work_life_balance', 'benefits_compensation', 'impact')
on conflict (leaderboard_id, company_id) do nothing;

create table if not exists public.leaderboard_votes (
  id bigserial primary key,
  leaderboard_id text not null references public.leaderboards(id) on delete cascade,
  winner_id text not null references public.companies(id) on delete cascade,
  loser_id text not null references public.companies(id) on delete cascade,
  cohort text not null default 'all',
  session_id text,
  delta numeric not null,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);

create index if not exists leaderboard_votes_leaderboard_created_idx
  on public.leaderboard_votes (leaderboard_id, created_at desc);

create index if not exists leaderboard_votes_session_idx
  on public.leaderboard_votes (session_id)
  where session_id is not null;

alter table public.leaderboard_votes enable row level security;

create or replace function public.ensure_company_leaderboard_stats()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.company_leaderboard_stats (leaderboard_id, company_id)
  select id, new.id
  from public.leaderboards
  on conflict (leaderboard_id, company_id) do nothing;

  return new;
end;
$$;

revoke all on function public.ensure_company_leaderboard_stats() from public;

drop trigger if exists companies_create_leaderboard_stats on public.companies;
create trigger companies_create_leaderboard_stats
after insert on public.companies
for each row execute function public.ensure_company_leaderboard_stats();

drop function if exists public.process_leaderboard_vote(text, text, text, text, text, text);
create function public.process_leaderboard_vote(
  p_winner_id text,
  p_loser_id text,
  p_cohort text default 'all',
  p_session_id text default null,
  p_secret text default null,
  p_leaderboard_id text default 'prestige'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret text;
  v_winner public.company_leaderboard_stats%rowtype;
  v_loser public.company_leaderboard_stats%rowtype;
  v_expected numeric;
  v_delta numeric;
begin
  if p_winner_id is null
    or p_loser_id is null
    or p_winner_id = p_loser_id
    or p_leaderboard_id is null
  then
    raise exception 'bad vote request' using errcode = '22023';
  end if;

  select value
  into v_secret
  from private.app_config
  where key = 'vote_secret';

  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'invalid vote secret' using errcode = '28000';
  end if;

  insert into public.company_leaderboard_stats (leaderboard_id, company_id)
  values
    (p_leaderboard_id, p_winner_id),
    (p_leaderboard_id, p_loser_id)
  on conflict (leaderboard_id, company_id) do nothing;

  perform 1
  from public.company_leaderboard_stats
  where leaderboard_id = p_leaderboard_id
    and company_id in (p_winner_id, p_loser_id)
  order by company_id
  for update;

  select *
  into v_winner
  from public.company_leaderboard_stats
  where leaderboard_id = p_leaderboard_id
    and company_id = p_winner_id;

  select *
  into v_loser
  from public.company_leaderboard_stats
  where leaderboard_id = p_leaderboard_id
    and company_id = p_loser_id;

  if v_winner.company_id is null or v_loser.company_id is null then
    raise exception 'company or leaderboard not found' using errcode = '22023';
  end if;

  v_expected := 1 / (1 + power(10::numeric, (v_loser.elo - v_winner.elo) / 400));
  v_delta := 32 * (1 - v_expected);

  update public.company_leaderboard_stats
  set
    elo = elo + v_delta,
    votes = votes + 1,
    wins = wins + 1,
    delta_24h = delta_24h + v_delta,
    updated_at = now()
  where leaderboard_id = p_leaderboard_id
    and company_id = p_winner_id;

  update public.company_leaderboard_stats
  set
    elo = elo - v_delta,
    votes = votes + 1,
    losses = losses + 1,
    delta_24h = delta_24h - v_delta,
    updated_at = now()
  where leaderboard_id = p_leaderboard_id
    and company_id = p_loser_id;

  if p_leaderboard_id = 'prestige' then
    update public.companies
    set
      elo = elo + v_delta,
      votes = votes + 1,
      wins = wins + 1,
      delta_24h = delta_24h + v_delta,
      updated_at = now()
    where id = p_winner_id;

    update public.companies
    set
      elo = elo - v_delta,
      votes = votes + 1,
      losses = losses + 1,
      delta_24h = delta_24h - v_delta,
      updated_at = now()
    where id = p_loser_id;
  end if;

  insert into public.leaderboard_votes (
    leaderboard_id,
    winner_id,
    loser_id,
    cohort,
    session_id,
    delta
  )
  values (
    p_leaderboard_id,
    p_winner_id,
    p_loser_id,
    coalesce(nullif(p_cohort, ''), 'all'),
    nullif(p_session_id, ''),
    v_delta
  );

  return jsonb_build_object(
    'leaderboardId', p_leaderboard_id,
    'winnerId', p_winner_id,
    'loserId', p_loser_id,
    'delta', v_delta
  );
end;
$$;

revoke all on function public.process_leaderboard_vote(text, text, text, text, text, text) from public;
grant execute on function public.process_leaderboard_vote(text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
