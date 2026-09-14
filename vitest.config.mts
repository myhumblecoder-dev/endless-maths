import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Component tests opt into jsdom with a per-file docblock, so the pure
    // logic suites keep running in plain node.
    environment: 'node',
  },
})
