import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OFFICIALS, buildingFor } from '../src/client/court-board/data.js'
import { castOf, castOrder, courtStateOf, officialFor, sleepsAt } from '../src/client/court-board/state.js'

const bot = (over = {}) => ({ id: 'b1', name: '首辅·张居正', section: '内阁', avatar: { color: '#123456' }, ...over })

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
  assert.equal(courtStateOf({ alert: true, running: true }, 10).kind, 'pending')
  assert.equal(courtStateOf({ away: true, roomName: '内阁议事' }, 10).kind, 'court')
  assert.equal(courtStateOf({ done: true }, 10, undefined, { done: '已办' }).text, '已办')
  assert.equal(courtStateOf({ state: 'waiting', waitsFor: '等 王安石' }, 10).kind, 'waiting')
  assert.equal(courtStateOf({}, 23).kind, 'sleep')
  assert.equal(courtStateOf({}, 12).kind, 'idle')
  assert.equal(sleepsAt(3), true)
  assert.equal(sleepsAt(9), false)
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
