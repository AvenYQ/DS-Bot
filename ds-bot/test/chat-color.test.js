import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  stdin: { contents: "export { edgeColor, chatColorCss, botChatColor } from './src/client/chat-color.js'", resolveDir: dirname(dirname(fileURLToPath(import.meta.url))) },
  bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: () => ({ createElement: () => null }) })
const { edgeColor, chatColorCss, botChatColor } = module.exports

// A square picture: a background color with a figure of another color in the middle.
function picture(side, background, figure) {
  const data = new Uint8ClampedArray(side * side * 4)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const inner = x > side * 0.25 && x < side * 0.75 && y > side * 0.2
      data.set([...(inner ? figure : background), 255], (y * side + x) * 4)
    }
  }
  return data
}

test('a photo takes the color of its background, not of the figure in it', () => {
  assert.equal(edgeColor(picture(48, [30, 90, 200], [240, 200, 20]), 48, 48), '#1e5ac8')
  assert.equal(edgeColor(new Uint8ClampedArray(16 * 16 * 4), 16, 16), undefined, 'a transparent picture has no color')
})

test('a character Bot takes its ink, and the colors repaint the accent and the bubbles', () => {
  assert.deepEqual([...botChatColor({ id: 'b', color: 'green' })], ['#00C972', '#009957'])
  const css = chatColorCss(['#1e5ac8', '#1e5ac8'])
  assert.match(css, /--bt-accent:#1e5ac8;--bt-accent-ink:#ffffff;--bt-user:#1e5ac8;--bt-user-ink:#ffffff/)
  assert.match(chatColorCss(['#ffe680', '#ffe680']), /--bt-user-ink:#141414/)
  assert.equal(chatColorCss(['nope', 'nope']), '')
})
