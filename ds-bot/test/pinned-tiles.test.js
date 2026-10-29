import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPinned } from '../src/client/sources.js'

test('the first Main Bot is pinned until unpinned; any other Bot once pinned', () => {
  const roster = { mainBotId: 'm' }
  assert.equal(isPinned(roster, { id: 'm' }), true)
  assert.equal(isPinned(roster, { id: 'm', pinned: false }), false)
  assert.equal(isPinned(roster, { id: 'b' }), false)
  assert.equal(isPinned(roster, { id: 'b', pinned: true }), true)
  assert.equal(isPinned(roster, undefined), false)
})
