import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest runs the pure engine/util modules in a Node environment. Path aliases
 * mirror the app configs so tests import via the same `@shared/...` specifiers.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@utils': resolve('src/utils'),
      '@analytics': resolve('src/analytics')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false
  }
})
