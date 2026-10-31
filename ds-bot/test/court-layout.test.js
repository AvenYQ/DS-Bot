import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOOR_GAP, doorSpot, planYards, yardSlots } from '../src/client/court-board/layout.js'

const hall = (w, d, foot) => ({ w, d, foot })
const inside = (spot, h) => Math.abs(spot.x - h.x) < (h.w ?? 9) / 2 && Math.abs(spot.z - h.z) < (h.d ?? 6) / 2

// The court's real shape: 2, 4, 4, 3, 5 and 1 hall in six sections.
const SECTIONS = [
  [hall(12, 7, 11), hall(9, 6, 10)],
  [hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10)],
  [hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10)],
  [hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10)],
  [hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10), hall(9, 6, 10)],
  [hall(13, 7, 12)],
]

const place = sections => planYards(sections).flatMap((block, index) => block.halls.map((spot, i) => ({
  ...sections[index][i], ...spot, section: index,
})))

test('no two halls overlap, however many halls the sections have', () => {
  const halls = place(SECTIONS)
  assert.equal(halls.length, SECTIONS.flat().length)
  for (let i = 0; i < halls.length; i += 1) {
    for (let j = i + 1; j < halls.length; j += 1) {
      const a = halls[i], b = halls[j]
      const apartX = Math.abs(a.x - b.x) >= (a.w / 2 + b.w / 2)
      const apartZ = Math.abs(a.z - b.z) >= (a.foot / 2 + b.foot / 2)
      assert.ok(apartX || apartZ, `halls ${i} and ${j} overlap (sections ${a.section} and ${b.section})`)
    }
  }
})

test('a section stays in its own block: nobody stands in another section\'s yard', () => {
  const plan = planYards(SECTIONS)
  plan.forEach((block, index) => {
    const mine = SECTIONS[index].map((own, i) => ({ ...own, ...block.halls[i] }))
    mine.forEach(own => {
      for (const offset of [0, -2, 2]) {
        const spot = doorSpot(own, offset)
        assert.equal(Math.round((spot.z - own.z) * 10) / 10, Math.round((own.foot / 2 + DOOR_GAP) * 10) / 10)
        plan.forEach((other, otherIndex) => {
          if (otherIndex === index) return
          for (const h of SECTIONS[otherIndex].map((entry, i) => ({ ...entry, ...other.halls[i] }))) {
            assert.ok(!inside(spot, h), `the door of section ${index} falls inside a hall of section ${otherIndex}`)
          }
        })
      }
    })
  })
})

test('sections do not share a yard, in either column', () => {
  const plan = planYards(SECTIONS)
  for (let i = 0; i < plan.length; i += 1) {
    for (let j = i + 1; j < plan.length; j += 1) {
      if (Math.sign(plan[i].x) !== Math.sign(plan[j].x)) continue
      assert.ok(Math.abs(plan[i].z - plan[j].z) > 20, `sections ${i} and ${j} sit in the same spot`)
    }
  }
})

test('every official is nearest to his own hall, not to the one next door', () => {
  const plan = planYards(SECTIONS)
  const halls = SECTIONS.flatMap((own, index) => own.map((entry, i) => ({ ...entry, ...plan[index].halls[i] })))
  for (const own of halls) {
    const home = doorSpot(own, 0)
    const nearest = halls.reduce((best, hall) => {
      const d = Math.hypot(hall.x - home.x, hall.z - home.z)
      return d < best.d ? { d, hall } : best
    }, { d: Infinity, hall: null }).hall
    assert.equal(nearest, own, 'a door spot must be nearest its own hall')
  }
})

test('a 朝会 row stands in front of its yard and clear of its halls', () => {
  const plan = planYards(SECTIONS)
  const [own] = SECTIONS[4].map((entry, i) => ({ ...entry, ...plan[4].halls[i] }))
  const slots = yardSlots(7, plan[4])
  assert.equal(slots.length, 7)
  for (const slot of slots) {
    assert.ok(Math.abs(slot.x) < 23)
    assert.ok(!inside(slot, own))
  }
})


test('the nineteen-official layout stays compact and empty sections take no space', () => {
  const halls = place(SECTIONS)
  const width = Math.max(...halls.map(h => h.x + h.w / 2)) - Math.min(...halls.map(h => h.x - h.w / 2))
  const depth = Math.max(...halls.map(h => h.z + h.foot / 2 + DOOR_GAP)) - Math.min(...halls.map(h => h.z - h.foot / 2))
  assert.ok(width < 150, `city width ${width}`)
  assert.ok(depth < 115, `city depth ${depth}`)
  const withEmpty = planYards([[], ...SECTIONS]).slice(1)
  assert.deepEqual(withEmpty, planYards(SECTIONS))
})
