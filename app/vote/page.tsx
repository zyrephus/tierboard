'use client';

import { VoteScreen } from '@/components/vote/VoteScreen';
import { useShell } from '@/components/Shell';

export default function VotePage() {
  const { state, vote, cohort } = useShell();
  return <VoteScreen state={state} vote={vote} cohort={cohort} />;
}
