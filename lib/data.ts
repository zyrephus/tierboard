import type { Sector, Cohort } from './types';

// Mirrors the `sectors` table; used for chip colors before the live fetch resolves.
export const SECTORS: Sector[] = [
  { id: 'ai',      label: 'AI Lab',    tint: 'oklch(0.95 0.04 290)', fg: 'oklch(0.4 0.15 290)' },
  { id: 'quant',   label: 'Quant',     tint: 'oklch(0.95 0.04 145)', fg: 'oklch(0.4 0.15 145)' },
  { id: 'bigtech', label: 'Big Tech',  tint: 'oklch(0.95 0.03 250)', fg: 'oklch(0.4 0.12 250)' },
  { id: 'unicorn', label: 'Unicorn',   tint: 'oklch(0.95 0.04 60)',  fg: 'oklch(0.42 0.12 60)' },
  { id: 'startup', label: 'Startup',   tint: 'oklch(0.95 0.04 25)',  fg: 'oklch(0.45 0.15 25)' },
  { id: 'public',  label: 'Public',    tint: 'oklch(0.95 0.02 0)',   fg: 'oklch(0.4 0.02 0)' },
  { id: 'hardware',label: 'Hardware',  tint: 'oklch(0.95 0.03 200)', fg: 'oklch(0.4 0.12 200)' },
  { id: 'crypto',  label: 'Crypto',    tint: 'oklch(0.95 0.04 80)',  fg: 'oklch(0.45 0.15 80)' },
  { id: 'gaming',  label: 'Gaming',    tint: 'oklch(0.95 0.04 175)', fg: 'oklch(0.4 0.15 175)' },
  { id: 'media',   label: 'Media',     tint: 'oklch(0.95 0.04 10)',  fg: 'oklch(0.45 0.18 10)' },
  { id: 'fintech', label: 'Fintech',   tint: 'oklch(0.95 0.04 145)', fg: 'oklch(0.38 0.14 145)' },
  { id: 'defense', label: 'Defense',   tint: 'oklch(0.95 0.01 220)', fg: 'oklch(0.4 0.05 220)' },
];

export const COHORTS: Cohort[] = [
  { id: 'all',     label: 'Everyone' },
  { id: 'swe',     label: 'SWE' },
  { id: 'pm',      label: 'PM' },
  { id: 'quant',   label: 'Quant' },
  { id: 'design',  label: 'Design' },
  { id: 'newgrad', label: 'New Grad' },
  { id: 'senior',  label: 'Senior+' },
];
