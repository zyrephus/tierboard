-- Interactive map — office locations.
--
-- One row per physical office; the curated `region` keys group offices into the
-- tracked metros the map renders as clusters (null = office exists but isn't in a
-- tracked metro). Each company gets at least one is_hq=true row (seeded next).
-- Public read only, like the rest of the app's anon-client tables.

create table public.company_offices (
  id         bigint generated always as identity primary key,
  company_id text not null references public.companies(id) on delete cascade,
  label      text,
  city       text not null,
  region     text,
  country    text,
  lat        double precision not null,
  lng        double precision not null,
  is_hq      boolean not null default false,
  created_at timestamptz not null default now(),
  constraint company_offices_region_check check (
    region is null or region in (
      'bay','nyc','seattle','la','austin','boston','chicago','dc',
      'toronto','vancouver','london','dublin','bangalore','singapore','tel-aviv'
    )
  )
);

create index company_offices_region_idx on public.company_offices (region);
create index company_offices_company_id_idx on public.company_offices (company_id);

-- RLS: anon client reads this directly, like the other public tables.
alter table public.company_offices enable row level security;
create policy "company_offices public read" on public.company_offices for select using (true);
grant select on public.company_offices to anon, authenticated;
