import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isWebview = mode === 'webview'
  const isObsidian = mode === 'obsidian-webview'
  return {
    plugins: [react(), tailwindcss()],
    base: isWebview || isObsidian ? './' : '/',
    build: {
      chunkSizeWarningLimit: 2000,
      outDir: isWebview
        ? 'extension/webview'
        : isObsidian
          ? 'obsidian-plugin/webview'
          : 'dist',
      // Obsidian: single IIFE bundle injected directly into DOM (no module context)
      ...(isObsidian && {
        rollupOptions: {
          output: {
            format: 'iife' as const,
            name: 'ArchViz',
            entryFileNames: 'app.js',
            assetFileNames: (info: { name?: string }) =>
              info.name?.endsWith('.css') ? 'app.css' : (info.name ?? 'asset'),
          },
        },
        codeSplitting: false,
      }),
    },
  }
})
