// Rasterises public/cookmate.svg into the PNG icons the PWA manifest + iOS
// home screen need. Run via `npm run pwa:icons` whenever the logo changes.
//
// Outputs (into public/):
//   icon-192.png        — manifest icon (Android install)
//   icon-512.png        — manifest icon (Android splash, high-density)
//   icon-maskable.png   — maskable variant with padding inside the safe zone
//   apple-touch-icon.png — iOS home screen (180×180, flat)

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const publicDir = resolve(root, 'public')

const BG = '#F5F0E8' // cream — matches --color-cream

const svg = await readFile(resolve(publicDir, 'cookmate.svg'))

async function render({ size, file, pad = 0 }) {
  const inner = size - pad * 2
  const logo = await sharp(svg).resize(inner, inner).png().toBuffer()
  const out = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toBuffer()
  await writeFile(resolve(publicDir, file), out)
  console.log(`→ public/${file} (${size}×${size}${pad ? `, ${pad}px pad` : ''})`)
}

// Plain variants — logo fills most of the canvas.
await render({ size: 192, file: 'icon-192.png' })
await render({ size: 512, file: 'icon-512.png' })
await render({ size: 180, file: 'apple-touch-icon.png' })

// Maskable variant — Android launchers may crop aggressively, so keep the
// logo inside a ~80% safe zone.
await render({ size: 512, file: 'icon-maskable.png', pad: 64 })

console.log('\nPWA icons generated.')
