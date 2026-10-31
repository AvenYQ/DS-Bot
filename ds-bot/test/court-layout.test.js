import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOOR_GAP, doorSpot, placeYard, yardOf, yardSlots } from '../src/client/court-board/layout.js'

const hall = (w, d, foot) => ({ w, d, foot })
const inside = (spot, h) => Math.abs(spot.x - h.x) < (h.w ?? 9) / 2 && Math.abs(spot.z - h.z) < (h.d ?? 6) / 2

test('a yard spaces its halls by footprint, so no hall reaches into the row behind it', () => {
  const halls = [hall(12, 7, 11), hall(9, 6, 10), hall(9, 6, 10), hall(13, 7, 12), hall(9, 6, 10)]
  const spots = placeYard(halls, 0)
  assert.equal(spots.length, halls.length)
  const placed = halls.map((h, i) => ({ ...h, ...spots[i] }))
  // two columns, rows south to north, each row's front clear of the row behind it
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i], b = placed[j]
      const apartX = Math.abs(a.x - b.x) >= (a.w / 2 + b.w / 2)
      const apartZ = Math.abs(a.z - b.z) >= (a.foot / 2 + b.foot / 2)
      assert.ok(apartX || apartZ, `halls ${i} and ${j} overlap`)
    }
  }
})

test('an official stands in front of his own hall, never inside it or the next one', () => {
  const halls = [hall(12, 7, 11), hall(9, 6, 10), hall(9, 6, 10), hall(13, 7, 12)]
  const spots = placeYard(halls, 2)
  const placed = halls.map((h, i) => ({ ...h, ...spots[i] }))
  placed.forEach((own, index) => {
    for (const offset of [0, -2, 2]) {
      const spot = doorSpot(own, offset)
      assert.ok(Math.abs(spot.z - own.z) > own.d / 2, 'in front of the hall, not inside it')
      assert.equal(Math.round((spot.z - own.z) * 10) / 10, Math.round((own.foot / 2 + DOOR_GAP) * 10) / 10)
      placed.forEach((other, otherIndex) => {
        if (otherIndex === index) return
        assert.ok(!inside(spot, other), `the door spot of hall ${index} falls inside hall ${otherIndex}`)
      })
    }
  })
})

test('yards do not sit on top of each other', () => {
  const yards = Array.from({ length: 9 }, (_, index) => yardOf(index))
  for (let i = 0; i < yards.length; i += 1) {
    for (let j = i + 1; j < yards.length; j += 1) {
      const apart = Math.abs(yards[i].x - yards[j].x) >= 30 || Math.abs(yards[i].z - yards[j].z) >= 22
      assert.ok(apart, `yards ${i} and ${j} collide`)
    }
  }
})

test('a 朝会 row stands in front of its yard, clear of the halls', () => {
  const yard = { x: 34, z: -14 }
  const halls = [hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10)]
  const placed = halls.map((h, i) => ({ ...h, ...placeYard(halls, 0)[i] }))
  const slots = yardSlots(7, yard)
  assert.equal(slots.length, 7)
  for (const slot of slots) {
    assert.ok(slot.z < yard.z - 2, 'the row stands south of the yard')
    for (const h of placed) assert.ok(!inside(slot, h), 'a slot must not stand inside a hall')
  }
})
