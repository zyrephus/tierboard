'use client';

import { ChartScreen } from '@/components/chart/ChartScreen';
import { useShell } from '@/components/Shell';

export default function ChartPage() {
  const { state } = useShell();
  return <ChartScreen state={state} />;
}
