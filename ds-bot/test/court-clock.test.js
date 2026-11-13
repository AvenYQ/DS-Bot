// The board's clock and date line follow the place, not the machine: a reader who picked
// Tokyo sees Tokyo's 时辰 and date even when the Mac still sits in Nanjing.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateIn, hourIn } from '../src/client/court-board/clock.js'
import { shichen } from '../src/client/court-board/feed.js'

// 06:00 UTC is 14:00 in Shanghai and 15:00 in Tokyo.
const AT = Date.UTC(2026, 10, 13, 6, 0)

test('the hour is read in the place’s own zone', () => {
  assert.equal(hourIn('Asia/Shanghai', AT), 14)
  assert.equal(hourIn('Asia/Tokyo', AT), 15)
  assert.equal(hourIn(undefined, AT), 14, 'no zone falls back to the court’s own')
})

test('a place in another zone changes the 时辰 with it', () => {
  const here = shichen(hourIn('Asia/Shanghai', AT))
  const there = shichen(hourIn('Asia/Tokyo', AT))
  assert.notEqual(here, there, 'the 时辰 follows the zone, so the board reads the place')
})

test('the date line is read in the place’s own zone', () => {
  // 23:30 in Shanghai on the 13th is already 00:30 on the 14th in Tokyo.
  const late = Date.UTC(2026, 10, 13, 15, 30)
  assert.match(dateIn('Asia/Shanghai', late), /13日/u)
  assert.match(dateIn('Asia/Tokyo', late), /14日/u)
})
