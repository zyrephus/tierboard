'use client';

import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { useShell } from '@/components/Shell';

export default function BoardPage() {
  const { state, cohort } = useShell();
  return <Leaderboard state={state} cohort={cohort} />;
}
