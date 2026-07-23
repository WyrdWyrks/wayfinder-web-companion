import {
    defineConfig,
    minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset,
    // Must live directly under public/, not a subdirectory — the generator
    // writes output files into a directory mirroring the source image's
    // location relative to publicDir, but the manifest/head-link hrefs it
    // emits are basenames assuming root placement. A source in public/svg/
    // produces files at dist/svg/* while the links point at dist/* (404s).
    images: ['public/pwa-icon.svg'],
})
