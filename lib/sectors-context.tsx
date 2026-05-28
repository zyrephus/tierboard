'use client';

import { createContext, useContext } from 'react';
import { SECTORS } from './data';
import type { Sector } from './types';

const SectorsContext = createContext<Sector[]>(SECTORS);

export function SectorsProvider({ sectors, children }: { sectors: Sector[]; children: React.ReactNode }) {
  return (
    <SectorsContext.Provider value={sectors.length > 0 ? sectors : SECTORS}>
      {children}
    </SectorsContext.Provider>
  );
}

export function useSectors() {
  return useContext(SectorsContext);
}
