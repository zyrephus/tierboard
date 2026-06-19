'use client';

import { MapScreen } from '@/components/map/MapScreen';
import { useShell } from '@/components/Shell';

export default function MapPage() {
  const { state } = useShell();
  return <MapScreen state={state} />;
}
