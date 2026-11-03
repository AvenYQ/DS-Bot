import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUILDINGS, BUILDING, PATROL, SPARES, WALL, courtSlot, footprint, homeOf, walkPath } from '../src/client/court-board/layout.js'
import { OFFICIALS } from '../src/client/court-board/data.js'
import { weatherOf } from '../src/client/court-board/weather.js'

const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
const inside = (p, f, pad = 0) => p.x > f.minX + pad && p.x < f.maxX - pad && p.z > f.minZ + pad && p.z < f.maxZ - pad

test('no two buildings stand on each other', () => {
  for (let i = 0; i < BUILDINGS.length; i += 1) {
    for (let j = i + 1; j < BUILDINGS.length; j += 1) {
      assert.ok(!overlaps(footprint(BUILDINGS[i]), footprint(BUILDINGS[j])), `${BUILDINGS[i].id} overlaps ${BUILDINGS[j].id}`)
    }
  }
})

test('every building, and everyone standing at one, is inside the one city wall', () => {
  for (const b of BUILDINGS) {
    const f = footprint(b)
    assert.ok(f.minX > -WALL.x && f.maxX < WALL.x && f.minZ > WALL.north, `${b.id} pokes through the wall`)
    const home = homeOf(b)
    assert.ok(Math.abs(home.x) < WALL.x && home.z < WALL.south && home.z > WALL.north, `${b.id}'s official stands outside`)
  }
})

test('every official in the table has a 衙门 of his own kind', () => {
  for (const official of OFFICIALS) assert.ok(BUILDING[official.b], `${official.name} has no building`)
  assert.ok(SPARES.length >= 4)
})

test('walking from any 衙门 to any other, or to the square, never cuts through a building', () => {
  const homes = BUILDINGS.filter(b => !b.palace).map(b => ({ id: b.id, ...homeOf(b) }))
  const targets = [...homes, { id: 'square-E', ...courtSlot(0, 'E', 5) }, { id: 'square-W', ...courtSlot(0, 'W', 3) }]
  for (const from of homes) {
    for (const to of targets) {
      const path = walkPath(from, to)
      assert.deepEqual(path[0], { x: from.x, z: from.z })
      assert.deepEqual(path.at(-1), { x: to.x, z: to.z })
      for (let i = 0; i < path.length - 1; i += 1) {
        for (let k = 0.05; k < 1; k += 0.05) {
          const p = { x: path[i].x + (path[i + 1].x - path[i].x) * k, z: path[i].z + (path[i + 1].z - path[i].z) * k }
          for (const b of BUILDINGS) {
            assert.ok(!inside(p, footprint(b), 0.6), `${from.id} → ${to.id} walks through ${b.id}`)
          }
        }
      }
    }
  }
})

test('the court stands in two ranks on the square, civil east and the rest west', () => {
  const east = courtSlot(0, 'E', 0)
  const west = courtSlot(0, 'W', 0)
  assert.ok(east.x > 0 && west.x < 0)
  assert.ok(courtSlot(0, 'E', 2).z > east.z, 'the ranks run south from the hall')
  for (const slot of [east, west, courtSlot(0, 'E', 9)]) {
    for (const b of BUILDINGS) assert.ok(!inside(slot, footprint(b)), `a court slot falls inside ${b.id}`)
  }
})

test('the guard walks the wall top, round three sides', () => {
  assert.equal(PATROL.length, 4)
  for (const p of PATROL) assert.ok(Math.abs(Math.abs(p.x) - WALL.x) < 0.01 || Math.abs(p.z - WALL.north) < 0.01)
})

test('weather codes become the sky the scene paints', () => {
  assert.equal(weatherOf(0).kind, 'clear')
  assert.equal(weatherOf(3).kind, 'cloudy')
  assert.equal(weatherOf(61).kind, 'rain')
  assert.equal(weatherOf(73).kind, 'snow')
  assert.equal(weatherOf(95).kind, 'storm')
  assert.equal(weatherOf(45).kind, 'fog')
})
