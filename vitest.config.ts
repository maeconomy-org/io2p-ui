import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      // Without an explicit `include`, only files a test imports are measured. src/app/ never
      // appeared at all, so ~200 untested files sat outside the denominator rather than scoring
      // zero, and the headline number described the tested 40% of the repo.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/__tests__/**',
        'src/types/**',
        // shadcn primitives — AGENTS.md exempts them from testing, so counting them depresses
        // the number without pointing at work worth doing.
        'src/components/ui/**',
        // Pure re-exports.
        '**/index.ts',
        // Framework-owned files with no branching logic of ours.
        'src/app/**/{layout,loading,error,not-found,global-error}.tsx',
        'src/instrumentation.ts',
        'src/instrumentation-client.ts',
        'src/**/*.d.ts',
      ],
      // json-summary is the file the PR-comment action reads; lcov is for any external viewer.
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
