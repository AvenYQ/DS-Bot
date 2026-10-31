import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { OFFICIALS, buildingFor } from '../src/client/court-board/data.js'
import { castOf, castOrder, courtStateOf, officialFor, sleepsAt } from '../src/client/court-board/state.js'
import { decreeFor } from '../src/client/court-board/decree.js'

const { outputFiles } = await build({
  entryPoints: ['src/client/live-state.js'], bundle: true, format: 'cjs', platform: 'browser',
  write: false, logLevel: 'silent', external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const bundled = { exports: {} }
runInNewContext(outputFiles[0].text, {
  module: bundled, exports: bundled.exports,
  require: name => name === 'react' ? { createContext: value => ({ value }) } : {},
})
const { liveStateOf, createDoneHold } = bundled.exports

const bot = (over = {}) => ({ id: 'b1', name: '首辅·张居正', section: '内阁', avatar: { color: '#123456' }, ...over })

test('the court theme is on unless the team turned it off', async () => {
  const { courtTheme } = await import('../src/client/sources.js')
  assert.equal(courtTheme(undefined), true)
  assert.equal(courtTheme({}), true)
  assert.equal(courtTheme({ prefs: {} }), true)
  assert.equal(courtTheme({ prefs: { court: true } }), true)
  assert.equal(courtTheme({ prefs: { court: false } }), false)
})

test('a Bot is matched to the official whose name it carries', () => {
  assert.equal(officialFor(bot()).id, 'zjz')
  assert.equal(officialFor(bot({ name: '户部尚书·和珅' })).id, 'hs')
  assert.equal(officialFor(bot({ name: 'Chief' })), null)
})

test('an unknown Bot lodges by the words in its name, then by its group', () => {
  assert.equal(buildingFor({ name: '工部·某某' }, ''), 'gongbu')
  assert.equal(buildingFor({ name: '无名', role: '' }, '内阁'), 'neige')
  assert.equal(buildingFor({ name: '无名', role: '' }, '编外'), null)
})

test('the cast follows the sidebar: each section in its order, unfiled Bots last', () => {
  const roster = {
    sections: [{ name: '内阁' }, { name: '六部' }],
    bots: [
      { id: 'c', name: '礼部尚书·纪晓岚', section: '六部' },
      { id: 'x', name: 'Chief', section: '' },
      { id: 'a', name: '次辅·王安石', section: '内阁' },
      { id: 'h', name: '隐藏的', section: '内阁', hidden: true },
      { id: 'b', name: '首辅·张居正', section: '内阁' },
    ],
  }
  assert.deepEqual(castOrder(roster).map(item => item.id), ['a', 'b', 'c', 'x'])
})

test('a Bot at work shows what it is doing; a waiting question wins over work', () => {
  assert.equal(courtStateOf({ running: true, doing: { tool: 'read' } }, 10, () => '调阅卷宗…').kind, 'work')
  assert.equal(courtStateOf({ running: true, doing: { tool: 'read' } }, 10, () => '调阅卷宗…').text, '调阅卷宗…')
  assert.equal(courtStateOf({ alert: true, running: true }, 10).kind, 'question')
  assert.equal(courtStateOf({ approval: true, alert: true, running: true, done: true }, 10).kind, 'pending')
  assert.equal(courtStateOf({ alert: true, done: true }, 10).kind, 'question')
  assert.equal(courtStateOf({ away: true, roomName: '内阁议事' }, 10).kind, 'court')
  assert.equal(courtStateOf({ done: true }, 10, undefined, { done: '已办' }).text, '已办')
  assert.equal(courtStateOf({ state: 'waiting', waitsFor: '等 王安石' }, 10).kind, 'waiting')
  assert.equal(courtStateOf({}, 23).kind, 'sleep')
  assert.equal(courtStateOf({}, 12).kind, 'idle')
  assert.equal(sleepsAt(3), true)
  assert.equal(sleepsAt(9), false)
})

test('live approval and roster questions produce distinct seals, with approval first', () => {
  const member = bot({ sessionId: 'session-1' })
  const state = (questions, approval, entry) => liveStateOf({ bot: member, roster: { questions }, approval, entry })
  assert.equal(courtStateOf(state({}, false, { completionUnread: true }), 12).kind, 'done')
  assert.equal(courtStateOf(state({ 'session-1': {} }, false, { running: true }), 12).kind, 'question')
  assert.equal(courtStateOf(state({}, true, { running: true }), 12).kind, 'pending')
  assert.equal(courtStateOf(state({ 'session-1': {} }, true), 12).kind, 'pending')
  assert.equal(courtStateOf(state({ other: {} }, false), 12).kind, 'idle')
})

test('completion waits for host turns and pending interactions', () => {
  const member = bot({ sessionId: 'session-1' })
  const entry = { completionUnread: true }
  const state = extra => liveStateOf({ bot: member, roster: {}, entry, ...extra })
  assert.equal(state({ turn: 123 }).running, true)
  assert.equal(state({ turn: 123 }).seal, null)
  assert.equal(state({ roster: { views: { 'session-1': {} } } }).seal, 'question')
  assert.equal(state({ roster: { questions: { 'session-1': {} } } }).done, false)
})

test('completion waits for a fresh snapshot and ignores stale or failed requests', async () => {
  const requests = []
  const timers = new Map()
  let next = 0
  let notifications = 0
  const hold = createDoneHold(() => { notifications++ }, () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    fn => { const id = ++next; timers.set(id, fn); return id }, id => timers.delete(id))
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
  hold.update(['session-1'])
  await flush()
  assert.equal(hold.ready.has('session-1'), false)
  hold.update([])
  requests[0].resolve(true)
  await flush()
  assert.equal(hold.ready.has('session-1'), false)
  hold.update(['session-1'])
  await flush()
  requests[1].reject(new Error('offline'))
  await flush()
  assert.equal(hold.ready.has('session-1'), false)
  assert.equal(timers.size, 1)
  const retry = [...timers.values()][0]
  timers.clear()
  retry()
  await flush()
  requests[2].resolve(true)
  await flush()
  assert.equal(hold.ready.has('session-1'), true)
  assert.equal(notifications, 1)
  hold.update([])
  assert.equal(hold.ready.has('session-1'), false)
  hold.dispose()
})

test('the cast dresses a known official from the table and an unknown Bot from itself', () => {
  const roster = {
    sections: [{ name: '内阁' }],
    bots: [
      bot(),
      { id: 'n1', name: 'Chief', section: '内阁', avatar: { color: '#abcdef' } },
      { id: 'n2', name: '工部·新来的', section: '' },
    ],
  }
  const live = new Map()
  const { people, bots } = castOf({ roster, live, hour: 12 })
  assert.equal(people.length, 3)
  const first = people.find(person => person.id === 'b1')
  assert.equal(first.building, 'neige')
  assert.equal(first.robe, OFFICIALS[0].robe)
  assert.equal(first.side, OFFICIALS[0].side)
  const own = people.find(person => person.id === 'n1')
  assert.equal(own.robe, '#abcdef')
  assert.equal(own.building, 'neige')
  const worded = people.find(person => person.id === 'n2')
  assert.equal(worded.building, 'gongbu')
  assert.equal(bots.length, 3)
})

// The court board's 宣旨 trigger, apart from React and the scene.
const NOW = 1_800_000_000_000
const given = (over = {}) => ({ from: 'main', at: NOW - 1_000, ...over })

test('two different officials inside ten seconds get one decree', () => {
  const batch = [given({ to: 'a', at: NOW - 500 }), given({ to: 'b', at: NOW - 4_000 })]
  assert.deepEqual(decreeFor(batch, 'main', {}, NOW), { kind: 'bots', from: 'main', to: ['a', 'b'], at: NOW - 500 })
})

test('one recipient is a hand-over, not a decree', () => {
  const one = [given({ to: 'a' }), given({ to: 'a', at: NOW - 2_000 })]
  assert.equal(decreeFor(one, 'main', {}, NOW), null)
})

test('assignments older than ten seconds are stale', () => {
  assert.equal(decreeFor([given({ to: 'a', at: NOW - 11_000 }), given({ to: 'b', at: NOW - 12_000 })], 'main', {}, NOW), null)
  // An old hand-over does not count towards a current batch.
  assert.equal(decreeFor([given({ to: 'a' }), given({ to: 'b', at: NOW - 11_000 })], 'main', {}, NOW), null)
})

test('the same batch does not replay', () => {
  const batch = [given({ to: 'a' }), given({ to: 'b', at: NOW - 2_000 })]
  const first = decreeFor(batch, 'main', {}, NOW)
  assert.equal(first.kind, 'bots')
  assert.equal(decreeFor(batch, 'main', { [first.kind]: first.at }, NOW), null)
})

test('a group order plays the bigger decree, once', () => {
  const order = [given({ room: 'r1', at: NOW - 2_000 })]
  const first = decreeFor(order, 'main', {}, NOW)
  assert.deepEqual(first, { kind: 'room', from: 'main', room: 'r1', at: NOW - 2_000 })
  assert.equal(decreeFor(order, 'main', { room: first.at }, NOW), null)
})

test('a group order outranks a batch, and the batch still plays once afterwards', () => {
  const both = [given({ room: 'r1', at: NOW - 1_000 }), given({ to: 'a', at: NOW - 2_000 }), given({ to: 'b', at: NOW - 2_500 })]
  const room = decreeFor(both, 'main', {}, NOW)
  assert.equal(room.kind, 'room')
  assert.deepEqual(decreeFor(both, 'main', { room: room.at }, NOW), { kind: 'bots', from: 'main', to: ['a', 'b'], at: NOW - 2_000 })
})

test('work from another Bot is ignored', () => {
  const other = [{ from: 'deputy', to: 'a', at: NOW - 1_000 }, { from: 'deputy', to: 'b', at: NOW - 2_000 }]
  assert.equal(decreeFor(other, 'main', {}, NOW), null)
})
