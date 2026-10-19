import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function listFiles(dir, prefix) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    const url = '/' + join(prefix, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) out.push(...listFiles(full, join(prefix, entry.name)))
    else if (!entry.name.endsWith('.html')) out.push(url)
  }
  return out
}

function swCacheVersion() {
  return {
    name: 'sw-cache-version',
    closeBundle() {
      const dist = join(process.cwd(), 'dist')
      const file = join(dist, 'sw.js')
      try {
        const assets = [
          ...new Set(
            listFiles(dist, '.')
              .filter((url) => url !== '/sw.js')
              .sort()
          ),
        ]
        let code = readFileSync(file, 'utf8')
        code = code.replace(
          'const PRECACHE = [];',
          `const PRECACHE = ${JSON.stringify(assets)};`
        )
        code = code.replace(/aimer-v[\w-]+/, `aimer-v${Date.now()}`)
        writeFileSync(file, code)
        console.log(`[sw-cache-version] cache del SW actualizado · ${assets.length} assets en precache`)
      } catch (err) {
        console.warn('[sw-cache-version] no se pudo actualizar el cache del SW:', err.message)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swCacheVersion()],
  // nada de console/debugger en el bundle que se publica
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    proxy: {
      "/api": {
        target: "https://malla-unimag.vercel.app",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
