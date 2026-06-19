import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // The supabase client (transitively imported by offices.ts) instantiates at
    // module load and requires these. Dummy values are fine — companiesByRegion
    // is pure and the tests never hit the network.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    },
  },
});
