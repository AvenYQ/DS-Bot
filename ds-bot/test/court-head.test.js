// The board's head must step around the macOS window lights exactly where the app marks
// them. The app's preload (app/src/preload.cjs) sets data-caption-lights on macOS and never
// sets data-platform, so the rule has to hang off that flag and off nothing else.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const board = read('court-board/styles.js')
const shell = read('styles.js')

const BAND = 'html[data-caption-lights]:not([data-fullscreen]) .bt-cb-pane[data-edge=left]{--cb-band:40px}'
const HEAD = 'html[data-caption-lights]:not([data-fullscreen]) .bt-cb-pane[data-edge=left] .bt-cb-head{top:calc(var(--cb-band) + 12px)}'
const DRAG = '.bt-cb-pane[data-edge=left]::before{content:"";position:absolute;z-index:4;top:0;left:0;right:0;height:var(--cb-band)'
const CAP = 'max-height:calc(100% - var(--cb-band) - 92px)'

test('the board head keeps clear of the window lights, on the flag the app really sets', () => {
  assert.ok(board.includes(BAND), 'the window band exists only where the lights are marked')
  assert.ok(board.includes(HEAD), 'the bar sits below the band')
  assert.ok(board.includes(DRAG), 'and the band itself drags the window')
  assert.equal(board.split(CAP).length - 1, 2, 'both panels keep their bottom margin under the band')
  assert.ok(!/data-platform=darwin/u.test(board), 'nothing hangs off a platform flag the app never sets')
  assert.ok(!board.includes('data-head'), 'only the one layout is kept')
})

test('the band is the height the app gives its caption band', () => {
  assert.ok(/html\[data-caption-lights\]\{--bt-caption-start:64px\}/u.test(shell), 'the app still marks the lights it draws')
  assert.ok(board.includes('--cb-band:40px'), 'the band is 40px, the app’s own caption height')
})
