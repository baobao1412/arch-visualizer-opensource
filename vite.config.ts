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
      chunkSizeWarningLimit: 900,
      outDir: isWebview
        ? 'extension/webview'
        : isObsidian
          ? 'obsidian-plugin/webview'
          : 'dist',
    },
  }
})
