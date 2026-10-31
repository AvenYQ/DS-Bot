// Each section owns a compact paved yard alongside the palace. Rows advance toward the
// front (+z); their full footprints and door spaces count toward the next yard's start.
export const DOOR_GAP = 2.4
const PALACE_EDGE = 23
const NORTH = -54
const YARD_GAP = 7
const MAX_COLUMNS = 3

export function planYards(sections) {
  const cursors = [NORTH, NORTH]
  return sections.map(halls => {
    const side = cursors[0] <= cursors[1] ? 0 : 1
    const sign = side === 0 ? 1 : -1
    if (halls.length === 0) return { x: sign * PALACE_EDGE, z: NORTH, halls: [] }
    const columns = Math.min(MAX_COLUMNS, halls.length)
    const width = Math.max(9, ...halls.map(hall => hall.w ?? 9))
    const footprint = Math.max(10, ...halls.map(hall => hall.foot ?? 10))
    const pitchX = width + 7
    const pitchZ = footprint + DOOR_GAP + 6
    const north = cursors[side]
    const firstZ = north + footprint / 2 + 3
    const rows = Math.ceil(halls.length / columns)
    const south = firstZ + (rows - 1) * pitchZ + footprint / 2 + DOOR_GAP + 3
    const innerX = PALACE_EDGE + width / 2 + 3
    const spots = halls.map((_, i) => ({
      x: sign * (innerX + (i % columns) * pitchX),
      z: firstZ + Math.floor(i / columns) * pitchZ,
    }))
    cursors[side] = south + YARD_GAP
    return {
      x: sign * (innerX + (columns - 1) * pitchX / 2),
      z: (north + south) / 2,
      halls: spots,
      north,
      south,
    }
  })
}

export const doorSpot = (hall, offset = 0) => ({
  x: hall.x + offset,
  z: hall.z + (hall.foot ?? 10) / 2 + DOOR_GAP,
})

// The assembly lane runs between the section's yard and the palace, clear of all roofs.
export function yardSlots(count, yard) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.sign(yard.x) * (PALACE_EDGE - 2),
    z: (yard.north ?? yard.z) + 4 + i * 2.6,
  }))
}
