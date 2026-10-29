// "Bot color" chat colors: in a Bot's chat the accent and the user's bubbles take that
// Bot's color. A photo gives the color of its background (the ring along its edge); a
// character gives its ink. A group chat and every other view keep the theme's colors.
import { INKS, isHex } from './inks.js'
import { colorOf } from './characters.js'
import { accentInk as inkOn } from './themes.js'

const hex = rgb => `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`

// The most common color along the edge of the picture, from 4-bit buckets so a gradient
// or noise still finds one; nearly transparent pixels do not count.
export function edgeColor(data, width, height) {
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.1))
  const buckets = new Map()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= ring && x < width - ring && y >= ring && y < height - ring) continue
      const at = (y * width + x) * 4
      if (data[at + 3] < 200) continue
      const key = ((data[at] >> 4) << 8) | ((data[at + 1] >> 4) << 4) | (data[at + 2] >> 4)
      const bucket = buckets.get(key) ?? [0, 0, 0, 0]
      bucket[0] += data[at]; bucket[1] += data[at + 1]; bucket[2] += data[at + 2]; bucket[3]++
      buckets.set(key, bucket)
    }
  }
  let best
  for (const bucket of buckets.values()) if (best === undefined || bucket[3] > best[3]) best = bucket
  return best === undefined ? undefined : hex(best.slice(0, 3).map(sum => sum / best[3]))
}

const cache = new Map()
// The photo's color, once it is read; undefined until then (or when it cannot be read).
export function photoColor(src, onReady) {
  if (cache.has(src)) {
    const known = cache.get(src)
    return typeof known === 'string' ? known : undefined
  }
  cache.set(src, null)
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    try {
      const side = 48
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = side
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const crop = Math.min(image.naturalWidth, image.naturalHeight)
      context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, side, side)
      const color = edgeColor(context.getImageData(0, 0, side, side).data, side, side)
      if (color !== undefined) { cache.set(src, color); onReady?.() }
    } catch { /* a picture the canvas may not read keeps the theme colors */ }
  }
  image.src = src
  return undefined
}

// A Bot's chat color for light and dark, or undefined while its photo is still being read.
export function botChatColor(bot, onReady) {
  const image = bot?.avatar?.image
  if (typeof image === 'string' && image !== '') {
    const color = photoColor(image, onReady)
    return color === undefined ? undefined : [color, color]
  }
  const ink = INKS[colorOf(bot)]
  return ink === undefined ? undefined : ink
}

// The declarations that repaint the accent and the user's bubbles; a near-white or near-black
// color still gets readable text.
export function chatColorCss([light, dark]) {
  if (!isHex(light) || !isHex(dark)) return ''
  const vars = color => `--bt-accent:${color};--bt-accent-ink:${inkOn(color)};--bt-user:${color};--bt-user-ink:${inkOn(color)}`
  return `html:root body{${vars(light)}}\nhtml:root body[data-ds-dark-theme]{${vars(dark)}}`
}
