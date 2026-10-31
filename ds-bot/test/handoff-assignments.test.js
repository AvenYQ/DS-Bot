// The assignments the client's court board plays: the work Bots were just given, read
// from the open works on every poll. The summary is read only: it writes nothing.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install as installHandoffs } from '../src/host/handoffs.js'

const NOW = 1_800_000_000_000

// A host over a team file that holds `works` and nothing else of the plugin.
function host(works = {}) {
  const rt = { home: '/nonexistent', state: { works }, botOf: () => undefined, readOnly: () => undefined, warn() {}, save: async () => {} }
  installHandoffs(rt)
  return rt
}

test('the summary shows the work a Bot gave another, newest first', () => {
  const rt = host({
    first: { from: 'a', to: 'b', at: NOW - 30_000, open: [], results: [] },
    second: { from: 'c', to: 'd', at: NOW - 5_000, open: [], results: [] },
  })
  assert.deepEqual(rt.assignmentsView(NOW), [
    { from: 'c', to: 'd', at: NOW - 5_000 },
    { from: 'a', to: 'b', at: NOW - 30_000 },
  ])
})

test('only the last minute of Bot-to-Bot work is shown', () => {
  const rt = host({
    recent: { from: 'a', to: 'b', at: NOW - 59_000 },
    old: { from: 'a', to: 'c', at: NOW - 60_001 },
  })
  assert.deepEqual(rt.assignmentsView(NOW), [{ from: 'a', to: 'b', at: NOW - 59_000 }])
})

test('work that names no two Bots is left out', () => {
  const rt = host({
    self: { from: 'a', to: 'a', at: NOW - 1_000 },
    askerOnly: { from: 'a', at: NOW - 2_000 },
    receiverOnly: { to: 'b', at: NOW - 3_000 },
    noSides: { at: NOW - 4_000, open: [], results: [] },
    noClock: { from: 'a', to: 'b', open: [], results: [] },
    fresh: { from: 'a', to: 'b', at: NOW - 5_000 },
  })
  assert.deepEqual(rt.assignmentsView(NOW), [{ from: 'a', to: 'b', at: NOW - 5_000 }])
})

test('at most 40 assignments are sent, the newest of them', () => {
  const works = {}
  for (let index = 0; index < 45; index += 1) {
    works[`w${index}`] = { from: `a${index}`, to: `b${index}`, at: NOW - index * 100 }
  }
  const shown = host(works).assignmentsView(NOW)
  assert.equal(shown.length, 40)
  assert.deepEqual(shown.map(({ from }) => from), Array.from({ length: 40 }, (_, index) => `a${index}`))
  assert.equal(shown.at(-1).at, NOW - 39 * 100)
})

test('an order to a group shows its room instead of a recipient', () => {
  const rt = host({
    order: { from: 'a', room: 'r1', at: NOW - 1_000, open: [], results: [] },
    single: { from: 'a', to: 'b', at: NOW - 2_000, open: [], results: [] },
  })
  const [order, single] = rt.assignmentsView(NOW)
  assert.deepEqual(order, { from: 'a', room: 'r1', at: NOW - 1_000 })
  assert.equal('to' in order, false)
  assert.deepEqual(single, { from: 'a', to: 'b', at: NOW - 2_000 })
})

test('reading the summary writes nothing', () => {
  let saves = 0
  const rt = host({ live: { from: 'a', to: 'b', at: NOW - 1_000, open: [], results: [] } })
  rt.save = async () => { saves += 1 }
  const state = JSON.stringify(rt.state)
  assert.deepEqual(rt.assignmentsView(NOW), [{ from: 'a', to: 'b', at: NOW - 1_000 }])
  assert.deepEqual(rt.assignmentsView(NOW), [{ from: 'a', to: 'b', at: NOW - 1_000 }])
  assert.equal(saves, 0)
  assert.equal(JSON.stringify(rt.state), state)
})

test('work leaves the summary when it comes back', async () => {
  const rt = host()
  rt.openWork('w1', { from: 'a', to: 'b' })
  const at = rt.state.works.w1.at
  assert.deepEqual(rt.assignmentsView(), [{ from: 'a', to: 'b', at }])
  rt.closeWork('w1', 'Writer', 'done')
  await Promise.resolve()
  assert.deepEqual(rt.assignmentsView(), [])
})
