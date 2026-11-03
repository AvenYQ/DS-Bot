// Where everything on the court's terrace stands, as plain numbers. The scene builds
// from this and the tests check it, so nothing here touches three.js.
//
// The terrace faces south (+z, toward the default camera). The 御道 runs down the
// middle from the 议事亭 in the north. Every sidebar section is a 班 — a low slab beside
// the 御道, west and east in turn, filled north to south — and every Bot has a seat on
// its section's slab, facing south, with a desk in front of it.

export const SEAT_X = 3.6
export const SEAT_Z = 3.9
const PAD_X = 1.9
const PAD_N = 2.3
const PAD_S = 1.5
const MAX_COLUMNS = 3
// Half the 御道's width, the gap between the 御道 and a slab, and between two slabs.
export const LANE = 3.4
const AISLE = 1.4
const GAP = 1.6
// The 议事亭 stands in the north; meetings gather on the round 月台 in front of it.
export const PAVILION_R = 3.1
export const MOON_R = 3.5
const RIM = 3.2

/** A slab's size for this many seats. */
export function slabSize(count) {
  const columns = Math.max(1, Math.min(MAX_COLUMNS, count))
  const rows = Math.max(1, Math.ceil(count / columns))
  return {
    columns, rows,
    w: 2 * PAD_X + (columns - 1) * SEAT_X,
    d: PAD_N + PAD_S + (rows - 1) * SEAT_Z + 1.2,
  }
}

/**
 * The whole terrace.
 * @param {{name: string, ids: string[]}[]} sections in sidebar order
 * @returns {{slabs: object[], seats: Map<string, {x: number, z: number, slab: number}>,
 *   pavilion: {x: number, z: number, r: number}, bounds: {minX: number, maxX: number, minZ: number, maxZ: number}}}
 */
export function planCourt(sections) {
  const sizes = sections.map(section => slabSize(section.ids.length))
  // Each column is as wide as its widest slab, so the 御道 stays straight.
  const widest = { '-1': 0, '1': 0 }
  const sides = []
  const height = { '-1': 0, '1': 0 }
  sizes.forEach((size, index) => {
    const side = height['-1'] <= height['1'] ? -1 : 1
    sides[index] = side
    height[side] += size.d + GAP
    widest[side] = Math.max(widest[side], size.w)
  })

  const moonZ = -MOON_R + 1
  const pavZ = moonZ - MOON_R - 0.7 - PAVILION_R
  const cursor = { '-1': 0, '1': 0 }
  const slabs = []
  const seats = new Map()
  sections.forEach((section, index) => {
    const size = sizes[index]
    const side = sides[index]
    const north = cursor[side]
    cursor[side] += size.d + GAP
    // Hug the 御道: a narrow slab sits against the lane, not out at the rim.
    const inner = side * (LANE + AISLE)
    const x = inner + side * size.w / 2
    const z = north + size.d / 2
    const slab = { name: section.name, index, side, x, z, w: size.w, d: size.d, seats: [] }
    section.ids.forEach((id, at) => {
      const row = Math.floor(at / size.columns)
      const inRow = Math.min(size.columns, section.ids.length - row * size.columns)
      const col = at % size.columns
      // A short last row is centred under the full ones.
      const sx = x + (col - (inRow - 1) / 2) * SEAT_X
      const sz = north + PAD_N + row * SEAT_Z
      const seat = { id, x: sx, z: sz, slab: index }
      slab.seats.push(seat)
      seats.set(id, seat)
    })
    slabs.push(slab)
  })

  const pavilion = { x: 0, z: pavZ, r: PAVILION_R, moon: { x: 0, z: moonZ, r: MOON_R } }
  const south = Math.max(cursor['-1'], cursor['1'], 6) - GAP
  const half = Math.max(LANE + AISLE + Math.max(widest['-1'], widest['1']), PAVILION_R + 4)
  return {
    slabs, seats, pavilion,
    bounds: { minX: -half - RIM, maxX: half + RIM, minZ: pavZ - PAVILION_R - RIM, maxZ: south + RIM + 2 },
  }
}

/**
 * Where the members of one meeting stand: a ring on the 月台 for the first meeting, a
 * ring on the 御道 below it for each one after.
 * @returns {{x: number, z: number, face: number}[]} `face` is the angle each one turns to,
 *   toward the ring's middle
 */
export function meetingSpots(pavilion, roomIndex, count) {
  const centre = meetingCentre(pavilion, roomIndex)
  const r = roomIndex === 0 ? pavilion.moon.r * 0.66 : Math.max(1.6, 0.55 * count)
  const spots = []
  for (let i = 0; i < count; i += 1) {
    // Start at the south so the first member faces north, toward the camera's back.
    const a = Math.PI / 2 + (i / Math.max(1, count)) * Math.PI * 2
    const x = centre.x + Math.cos(a) * r
    const z = centre.z + Math.sin(a) * r
    spots.push({ x, z, face: Math.atan2(centre.x - x, centre.z - z) })
  }
  return spots
}

/** The middle of a meeting's ring. */
export function meetingCentre(pavilion, roomIndex) {
  const { moon } = pavilion
  if (roomIndex === 0) return { x: moon.x, z: moon.z }
  return { x: 0, z: moon.z + moon.r + 3.4 + (roomIndex - 1) * 5.6 }
}

/**
 * The way from a seat to a spot by the 御道: out in front of the desk, along the slab's
 * front edge to the lane, up the lane, then straight to the spot. A walker never cuts
 * through another official's desk.
 * @returns {{x: number, z: number}[]}
 */
export function walkPath(seat, spot) {
  const side = Math.sign(seat.x) || 1
  const front = seat.z + SEAT_Z / 2
  const laneX = side * (LANE - 0.9)
  return [
    { x: seat.x, z: seat.z },
    { x: seat.x, z: front },
    { x: laneX, z: front },
    { x: laneX, z: spot.z },
    { x: spot.x, z: spot.z },
  ]
}

/** The sections a cast fills, in the order its people come: sidebar order. */
export function sectionsOf(people, unfiled = '') {
  const order = []
  const byName = new Map()
  for (const person of people) {
    const name = person.section || unfiled
    if (!byName.has(name)) { byName.set(name, { name, ids: [] }); order.push(name) }
    byName.get(name).ids.push(person.id)
  }
  return order.map(name => byName.get(name))
}
