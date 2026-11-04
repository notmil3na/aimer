import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripHtmlComments() {
  return {
    name: 'strip-html-comments',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/<!--[\s\S]*?-->/g, '')
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), stripHtmlComments()],
  server: {
    proxy: {
      "/api": {
        target: "https://aimer-project.yaritzamilena4.workers.dev",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
