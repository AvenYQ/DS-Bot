// The court board's play layer: the confirmation card in front of a 折子, and the line an
// official says when he is clicked. The card must never send on 且慢, and a send that fails
// must come back so the card can stay open and say so.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

const { outputFiles } = await build({
  entryPoints: ['src/client/court-board/play.js'], bundle: true, format: 'cjs',
  platform: 'browser', write: false, logLevel: 'silent', external: ['react'],
})
const bundled = { exports: {} }
runInNewContext(outputFiles[0].text, {
  module: bundled, exports: bundled.exports,
  require: name => (name === 'react'
    ? { createElement: () => null, useEffect: () => {}, useRef: () => ({ current: null }), useState: () => [null, () => {}] }
    : {}),
})
const { createDispatch, createLocateGate, createTicket, greetingOf, nextPick } = bundled.exports

const bot = { id: 'zgf', name: '曾国藩' }

test('且慢 sends nothing, 准奏 sends once with the confirmed flag', async () => {
  const sent = []
  const card = createDispatch({ send: (id, text, options) => { sent.push({ id, text, options }); return Promise.resolve({ ok: true }) } })
  card.ask({ bot, text: '把瓦垄改圆' })
  assert.equal(await card.cancel(), true)
  assert.deepEqual(sent, [], '且慢 must not reach the sender')
  card.ask({ bot, text: '把瓦垄改圆' })
  assert.equal((await card.confirm()).ok, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].id, 'zgf')
  assert.equal(sent[0].text, '把瓦垄改圆')
  assert.equal(sent[0].options.confirmed, true)
})

test('a send that fails comes back, so the card can stay open and say so', async () => {
  const card = createDispatch({ send: () => Promise.resolve({ ok: false, reason: 'send-failed' }) })
  card.ask({ bot, text: '把瓦垄改圆' })
  const answer = await card.confirm()
  assert.equal(answer.ok, false)
  assert.equal(answer.reason, 'send-failed')
})

test('confirming twice sends once: the pending 折子 is taken at the first press', async () => {
  let calls = 0
  const card = createDispatch({ send: () => { calls += 1; return Promise.resolve({ ok: true }) } })
  card.ask({ bot, text: '把瓦垄改圆' })
  await card.confirm()
  await card.confirm()
  assert.equal(calls, 1)
})

test('a failed send keeps the 折子, so 再试一次 sends it again and it goes out', async () => {
  let calls = 0
  const card = createDispatch({
    send: () => {
      calls += 1
      return calls === 1 ? Promise.resolve({ ok: false, reason: 'send-failed' }) : Promise.resolve({ ok: true })
    },
  })
  card.ask({ bot, text: '把瓦垄改圆' })
  const first = await card.confirm()
  assert.equal(first.ok, false)
  assert.equal(calls, 1)
  assert.notEqual(card.pending(), null, 'the 折子 is still there to try again')
  const second = await card.confirm()
  assert.equal(second.ok, true)
  assert.equal(calls, 2, 'the retry is the second send, not a third')
  assert.equal(card.pending(), null)
  assert.equal((await card.confirm()).ok, false, 'nothing left to send')
})

test('a place answer that arrives late cannot undo a city the reader picked', () => {
  const tickets = createTicket()
  const inflight = tickets.issue()
  assert.equal(tickets.valid(inflight), true)
  tickets.issue()                       // the reader picks a city while it is in flight
  assert.equal(tickets.valid(inflight), false, 'the late answer is dropped')
  const next = tickets.issue()
  assert.equal(tickets.valid(next), true, 'and the newest answer still lands')
})

test('an older locate answer cannot clear the wait of a newer one', () => {
  const gate = createLocateGate()
  const older = gate.begin()
  const newer = gate.begin()            // the reader pressed again while the first ran
  let applied = 0
  assert.equal(gate.settle(older, () => { applied += 1 }), false, 'the older answer lands nowhere')
  assert.equal(applied, 0)
  assert.equal(gate.waiting(), true, 'the newer wait is still standing')
  assert.equal(gate.settle(newer, () => { applied += 1 }), true)
  assert.equal(gate.waiting(), false, 'and only its own answer ends it')
})

test('closing the board during a look puts the wait away, and reopening starts clean', () => {
  const gate = createLocateGate()
  const inFlight = gate.begin()
  assert.equal(gate.waiting(), true, 'the card shows a wait')
  gate.close()                          // the board is put away mid-look
  assert.equal(gate.waiting(), false, 'reopening does not sit in a wait nobody will end')
  let applied = 0
  assert.equal(gate.settle(inFlight, () => { applied += 1 }), false, 'and the late answer changes nothing')
  assert.equal(applied, 0)
  const next = gate.begin()             // reopened, the reader asks again
  assert.equal(gate.waiting(), true)
  assert.equal(gate.settle(next), true)
  assert.equal(gate.waiting(), false)
})

test('a background look never shows or ends the wait', () => {
  const gate = createLocateGate()
  const mine = gate.begin()
  const look = gate.look()              // the half-hour look starts while the reader waits
  assert.equal(gate.accept(look), true, 'the background answer is taken')
  assert.equal(gate.waiting(), true, 'but the reader’s own wait is untouched')
  assert.equal(gate.settle(mine), true, 'and its own answer still ends it')
  assert.equal(gate.waiting(), false)
})

test('the greeting changes on every pick, even for the same official', () => {
  const errand = '把瓦垄改圆'
  const lines = [0, 1, 2, 3, 4, 5].map(pick => greetingOf('work', { task: errand, pick }))
  assert.equal(new Set(lines).size, 6, 'six picks say six different things')
  assert.equal(greetingOf('work', { task: errand, pick: 0 }), greetingOf('work', { task: errand, pick: 0 }))
  assert.notEqual(greetingOf('work', { task: errand, pick: 0 }), greetingOf('work', { task: errand, pick: 1 }))
  // Two picks of the same official walk two lines.
  const counts = {}
  assert.equal(nextPick(counts, 'zgf'), 1)
  assert.equal(nextPick(counts, 'zgf'), 2)
  assert.notEqual(
    greetingOf('work', { task: errand, pick: nextPick({}, 'zgf') }),
    greetingOf('work', { task: errand, pick: nextPick({ zgf: 1 }, 'zgf') }),
  )
  // With no errand to name, the lines that want {task} step aside.
  assert.equal(new Set([0, 1, 2, 3, 4, 5].map(pick => greetingOf('work', { pick }))).size, 4)
})
