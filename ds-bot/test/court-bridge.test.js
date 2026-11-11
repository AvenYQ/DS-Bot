import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { dispatch, readDuty, unwireBridge, wireBridge } from '../src/client/court-board/bridge.js'

beforeEach(() => unwireBridge())

function makeWorld(overrides = {}) {
  const roster = {
    byId: {
      b1: { id: 'b1', name: '工部尚书·曾国藩' },
      b2: { id: 'b2', name: '户部尚书·和珅' },
    },
  }
  const live = new Map()
  live.set('b1', {
    approval: false,
    alert: false,
    away: false,
    running: true,
    done: false,
    state: 'work',
    since: 10,
    detail: { tool: 'fs_read' },
    bot: roster.byId.b1,
  })
  const work = { approvals: [], waiting: {}, bots: {}, rooms: {}, turns: {} }
  return { roster, live, work, hour: 12, phrase: () => '正在改瓦垄', words: {}, send: async () => {}, ...overrides }
}

test('nothing is known before the board wires the bridge', () => {
  assert.equal(readDuty('b1'), null)
  assert.equal(readDuty('nobody'), null)
})

test('an unknown Bot has no duty', () => {
  wireBridge(makeWorld())
  assert.equal(readDuty('nobody'), null)
  assert.equal(readDuty(undefined), null)
})

test('a working official reports his state and the sentence he is working on', () => {
  wireBridge(makeWorld())
  const duty = readDuty('b1')
  assert.equal(duty.status, 'work')
  assert.equal(duty.task, '正在改瓦垄')
  assert.deepEqual(duty.todos, [])
})

test('an approval makes him pending, and the approval is his first todo', () => {
  const world = makeWorld()
  world.live.set('b1', { ...world.live.get('b1'), running: false, approval: true })
  world.work.approvals = [{ id: 'ap1', botId: 'b1', tool: 'fs_write', reason: '要改 palace.js', at: 100 }]
  wireBridge(world)
  const duty = readDuty('b1')
  assert.equal(duty.status, 'pending')
  assert.equal(duty.task, '有奏折待批')
  assert.equal(duty.todos.length, 1)
  assert.equal(duty.todos[0].kind, 'approval')
  assert.equal(duty.todos[0].text, '要改 palace.js')
  assert.equal(duty.todos[0].tool, 'fs_write')
})

test('a hand-off he waits on becomes a wait todo', () => {
  const world = makeWorld()
  world.live.set('b1', {
    ...world.live.get('b1'),
    running: false,
    state: 'waiting',
    waitsFor: '等 户部尚书·和珅 回话',
  })
  world.work.waiting.b1 = { bots: ['b2'], rooms: [], waits: [{ id: 'w1', to: 'b2', name: '户部尚书·和珅' }] }
  wireBridge(world)
  const duty = readDuty('b1')
  assert.equal(duty.status, 'waiting')
  assert.equal(duty.task, '等 户部尚书·和珅 回话')
  assert.equal(duty.todos[0].kind, 'wait')
  assert.equal(duty.todos[0].text, '等 户部尚书·和珅 回话')
})

test('the to-do list keeps the newest five, approvals first', () => {
  const world = makeWorld()
  world.work.approvals = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `ap${n}`, botId: 'b1', tool: `t${n}`, reason: `r${n}`, at: n }))
  world.work.waiting.b1 = { bots: ['b2'], rooms: [], waits: [{ id: 'w1', to: 'b2', name: '和珅' }] }
  wireBridge(world)
  const todos = readDuty('b1').todos
  assert.equal(todos.length, 5)
  assert.equal(todos[0].at, 6)
  assert.deepEqual(todos.map(item => item.at), [6, 5, 4, 3, 2])
})

test('another official\'s approvals are not his', () => {
  const world = makeWorld()
  world.work.approvals = [{ id: 'ap2', botId: 'b2', tool: 'x', reason: 'y', at: 5 }]
  wireBridge(world)
  assert.deepEqual(readDuty('b1').todos, [])
})

test('the night puts an idle official to sleep', () => {
  const world = makeWorld({ hour: 23 })
  world.live.set('b1', { ...world.live.get('b1'), running: false })
  wireBridge(world)
  const duty = readDuty('b1')
  assert.equal(duty.status, 'sleep')
  assert.equal(duty.task, '歇息')
})

test('reading a duty never changes the board data', () => {
  const world = makeWorld()
  world.work.approvals = [{ id: 'ap1', botId: 'b1', tool: 'fs_write', reason: 'r', at: 1 }]
  const before = JSON.stringify(world.work)
  wireBridge(world)
  readDuty('b1')
  readDuty('b1')
  assert.equal(JSON.stringify(world.work), before)
  const first = readDuty('b1')
  first.todos.length = 0
  assert.equal(readDuty('b1').todos.length, 1)
})

test('a dispatch without the confirmed flag is refused and never sends', async () => {
  let sent = 0
  wireBridge(makeWorld({ send: async () => { sent += 1 } }))
  for (const flag of [undefined, false, 1, 'true', {}, null]) {
    const result = await dispatch('b1', '把这摺子办了', flag)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'not-confirmed')
  }
  assert.equal(sent, 0)
})

test('a confirmed dispatch sends once, trimmed', async () => {
  const calls = []
  wireBridge(makeWorld({ send: async (id, text) => { calls.push([id, text]) } }))
  const result = await dispatch('b1', '  把这摺子办了  ', true)
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(calls, [['b1', '把这摺子办了']])
})

test('a confirmed dispatch still refuses an empty word or an unknown Bot', async () => {
  let sent = 0
  wireBridge(makeWorld({ send: async () => { sent += 1 } }))
  assert.equal((await dispatch('b1', '   ', true)).reason, 'empty-message')
  assert.equal((await dispatch('b1', '话', false)).reason, 'not-confirmed')
  assert.equal((await dispatch('nobody', '话', true)).reason, 'unknown-bot')
  assert.equal(sent, 0)
})

test('an unwired bridge never sends, even when confirmed', async () => {
  assert.equal((await dispatch('b1', '话', true)).reason, 'not-wired')
})

test('a sender that fails reports it instead of throwing', async () => {
  wireBridge(makeWorld({ send: async () => { throw new Error('offline') } }))
  const result = await dispatch('b1', '话', true)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'send-failed')
  assert.equal(result.error.message, 'offline')
})
