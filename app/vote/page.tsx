'use client';

import { VoteScreen } from '@/components/vote/VoteScreen';
import { useShell } from '@/components/Shell';

export default function VotePage() {
  const { state, cohort } = useShell();
  return <VoteScreen state={state} cohort={cohort} />;
}
