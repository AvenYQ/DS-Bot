// The board's head must step around the macOS window lights exactly where the app marks
// them. The app's preload (app/src/preload.cjs) sets data-caption-lights on macOS and never
// sets data-platform, so the rule has to hang off that flag and off nothing else.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const board = read('court-board/styles.js')
const shell = read('styles.js')

const RULE = 'html[data-caption-lights]:not([data-fullscreen]) .bt-cb-pane[data-edge=left] .bt-cb-head{padding-left:calc(12px + var(--bt-caption-start,0px))}'

test('the board head keeps clear of the window lights, on the flag the app really sets', () => {
  assert.ok(board.includes(RULE), 'the rule hangs off data-caption-lights, outside fullscreen')
  assert.ok(!/data-platform=darwin\][^{}]*\.bt-cb-head/u.test(board), 'and not off a platform flag the app never sets')
})

test('the room the rule spends is the app’s own caption-start', () => {
  assert.ok(/html\[data-caption-lights\]\{--bt-caption-start:64px\}/u.test(shell), 'the variable exists where the rule is used')
  assert.ok(RULE.includes('var(--bt-caption-start,0px)'), 'and the rule spends that variable, not a number of its own')
})
