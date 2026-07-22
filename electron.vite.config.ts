import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve('electron/main/index.ts') },
        // Stay ESM: `electron-store` v10 is ESM-only, so a CommonJS bundle gets a
        // module namespace instead of the class. `.mjs` makes the entry
        // unambiguously ESM regardless of the package's `type` field.
        output: { format: 'es', entryFileNames: 'index.mjs' }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('electron/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve('electron/preload/index.ts') },
        // Sandboxed preload scripts must be CommonJS — force a .js output so the
        // window-manager can reference `../preload/index.js`.
        output: { format: 'cjs', entryFileNames: 'index.js' }
      }
    },
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve('index.html') }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@shared': resolve('src/shared'),
        '@components': resolve('src/components'),
        '@widgets': resolve('src/widgets'),
        '@pages': resolve('src/pages'),
        '@hooks': resolve('src/hooks'),
        '@store': resolve('src/store'),
        '@analytics': resolve('src/analytics'),
        '@prediction': resolve('src/prediction'),
        '@settings': resolve('src/settings'),
        '@providers': resolve('src/providers'),
        '@utils': resolve('src/utils'),
        '@types': resolve('src/types')
      }
    }
  }
})
