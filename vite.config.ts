import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: 'Wayfinder Web Companion',
      short_name: 'Wayfinder',
      description: 'Wayfinder Web Companion',
      theme_color: '#fc6203',
    },

    workbox: {
      // json is here for public/data/lvcc-locations.json — the LVCC template
      // is fetched at runtime, so without precaching it "Use LVCC Template"
      // is the one thing on the import page that needs the network.
      globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
      // That template is ~1 MB on its own and only grows as venue data is
      // added; the 2 MiB default would silently drop it from the precache
      // manifest rather than fail the build.
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      cleanupOutdatedCaches: true,
      clientsClaim: true,

      // Map tiles come from OpenStreetMap and can't be precached (there's no
      // knowing which ones are needed). Serving them cache-first means tiles
      // seen while online stay available offline, and an uncached tile fails
      // as a single missing image instead of taking anything else with it.
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'osm-tiles',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 30 * 24 * 60 * 60,
              purgeOnQuotaError: true,
            },
            // Tile responses are opaque (no CORS headers), hence status 0.
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },

    devOptions: {
      enabled: false,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
})
