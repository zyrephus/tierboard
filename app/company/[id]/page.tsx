'use client';

import { use } from 'react';
import { CompanyScreen } from '@/components/company/CompanyScreen';
import { useShell } from '@/components/Shell';

export default function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useShell();
  return <CompanyScreen id={id} state={state} />;
}
