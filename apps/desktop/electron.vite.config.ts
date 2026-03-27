import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          index: join(currentDir, 'src/main/index.ts'),
          'pascal-code-executor-worker': join(currentDir, 'src/main/agents/pascal-code-executor-worker.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    root: join(currentDir, 'src/renderer'),
    plugins: [tailwindcss(), react()],
    build: {
      outDir: '../../dist/renderer',
      emptyOutDir: true,
    },
    define: {
      'process.env': '{}',
    },
    resolve: {
      alias: {
        '@': join(currentDir, 'src/renderer/src'),
        'next/image': join(currentDir, 'src/renderer/src/shims/next-image.tsx'),
        'next/link': join(currentDir, 'src/renderer/src/shims/next-link.tsx'),
      },
    },
  },
})
