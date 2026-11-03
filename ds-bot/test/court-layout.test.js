import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LANE, meetingCentre, meetingSpots, planCourt, sectionsOf, walkPath } from '../src/client/court-board/layout.js'

// The court's real shape: 2, 4, 4, 3, 5 and 1 officials in six sections.
const SIZES = [2, 4, 4, 3, 5, 1]
const SECTIONS = SIZES.map((count, index) => ({ name: `s${index}`, ids: Array.from({ length: count }, (_, i) => `s${index}-${i}`) }))
const DESK = { w: 1.9, d: 2.6 } // a seat's mat, figure and desk, with room to pass

test('every official gets a seat, and no two seats crowd each other', () => {
  const plan = planCourt(SECTIONS)
  const seats = [...plan.seats.values()]
  assert.equal(seats.length, SIZES.reduce((a, b) => a + b, 0))
  for (let i = 0; i < seats.length; i += 1) {
    for (let j = i + 1; j < seats.length; j += 1) {
      const a = seats[i], b = seats[j]
      assert.ok(Math.abs(a.x - b.x) >= DESK.w * 1.5 || Math.abs(a.z - b.z) >= DESK.d * 1.4, `seats ${i} and ${j} crowd each other`)
    }
  }
})

test('a seat stands on its own section\'s slab and slabs do not overlap', () => {
  const plan = planCourt(SECTIONS)
  for (const slab of plan.slabs) {
    for (const seat of slab.seats) {
      assert.ok(Math.abs(seat.x - slab.x) < slab.w / 2 - 0.8, 'seat off its slab sideways')
      assert.ok(Math.abs(seat.z - slab.z) < slab.d / 2 - 0.8, 'seat off its slab lengthways')
    }
  }
  for (let i = 0; i < plan.slabs.length; i += 1) {
    for (let j = i + 1; j < plan.slabs.length; j += 1) {
      const a = plan.slabs[i], b = plan.slabs[j]
      const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2
      assert.ok(apart, `slabs ${i} and ${j} overlap`)
    }
  }
})

test('the 御道 stays clear: every slab keeps off the lane', () => {
  const plan = planCourt(SECTIONS)
  for (const slab of plan.slabs) assert.ok(Math.abs(slab.x) - slab.w / 2 >= LANE, `slab ${slab.name} sits on the lane`)
})

test('the 议事亭 and its 月台 lie north of every seat and inside the terrace', () => {
  const plan = planCourt(SECTIONS)
  const { pavilion, bounds } = plan
  assert.ok(pavilion.z + pavilion.r < pavilion.moon.z - pavilion.moon.r + 0.01)
  for (const seat of plan.seats.values()) assert.ok(seat.z > pavilion.z + pavilion.r)
  assert.ok(pavilion.z - pavilion.r > bounds.minZ)
  for (const slab of plan.slabs) {
    assert.ok(slab.x - slab.w / 2 > bounds.minX && slab.x + slab.w / 2 < bounds.maxX)
    assert.ok(slab.z + slab.d / 2 < bounds.maxZ)
  }
})

test('a meeting stands in a ring facing its middle, on the 月台 first', () => {
  const plan = planCourt(SECTIONS)
  const spots = meetingSpots(plan.pavilion, 0, 5)
  const centre = meetingCentre(plan.pavilion, 0)
  assert.deepEqual(centre, { x: plan.pavilion.moon.x, z: plan.pavilion.moon.z })
  for (const spot of spots) {
    assert.ok(Math.hypot(spot.x - centre.x, spot.z - centre.z) < plan.pavilion.moon.r - 0.6, 'a member stands off the 月台')
    // Facing the middle: a step forward brings him closer to it.
    const ahead = { x: spot.x + Math.sin(spot.face) * 0.5, z: spot.z + Math.cos(spot.face) * 0.5 }
    assert.ok(Math.hypot(ahead.x - centre.x, ahead.z - centre.z) < Math.hypot(spot.x - centre.x, spot.z - centre.z))
  }
  assert.ok(meetingCentre(plan.pavilion, 1).z > plan.pavilion.moon.z + plan.pavilion.moon.r, 'a second meeting gathers below the 月台')
})

test('the way to a meeting goes out in front of the desk and up the lane', () => {
  const plan = planCourt(SECTIONS)
  const seat = plan.seats.get('s4-4')
  const spot = meetingSpots(plan.pavilion, 0, 3)[0]
  const path = walkPath(seat, spot)
  assert.deepEqual(path[0], { x: seat.x, z: seat.z })
  assert.ok(path[1].z > seat.z, 'he steps out in front of his desk first')
  assert.ok(Math.abs(path[2].x) < LANE, 'then onto the lane')
  assert.deepEqual(path.at(-1), { x: spot.x, z: spot.z })
})

test('sections come in the order their people do, unfiled ones under one name', () => {
  const people = [{ id: 'a', section: '内阁' }, { id: 'b', section: '' }, { id: 'c', section: '内阁' }, { id: 'd', section: '六部' }]
  assert.deepEqual(sectionsOf(people, '编外'), [
    { name: '内阁', ids: ['a', 'c'] }, { name: '编外', ids: ['b'] }, { name: '六部', ids: ['d'] },
  ])
})
