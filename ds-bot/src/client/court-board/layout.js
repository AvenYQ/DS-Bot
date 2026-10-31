// Where a section's halls and its people stand. Kept out of the 3D scene so the placement
// can be tested on its own: no one's doorway may land inside another hall, and a hall's
// figure stands in front of that hall, not of the one next door.

// The yards around the palace, in the order sections claim them: east and west of the
// 太和殿 square first, then the south-east and south-west yards, then the inner court.
export const YARDS = [
  { x: 40, z: -28 }, { x: -40, z: -28 },
  { x: 40, z: 6 }, { x: -40, z: 6 },
  { x: 40, z: 36 }, { x: -40, z: 36 },
  { x: 40, z: -60 }, { x: -40, z: -60 },
  { x: 0, z: -60 },
]

/** How far the staff of a hall stand in front of its front edge. */
export const DOOR_GAP = 2.4

export const yardOf = index => {
  const yard = YARDS[index % YARDS.length]
  const wrappers = index >= YARDS.length ? Math.floor(index / YARDS.length) : 0
  return { x: yard.x + wrappers * 6, z: yard.z + wrappers * 16 }
}

/**
 * Where a yard's halls stand: two columns, one row per pair, spaced by the footprints so
 * a hall's front never reaches into the row behind it.
 * @param {Array<{w?:number,d?:number,foot?:number}>} halls
 * @param {number} index which yard this is
 * @returns {{x:number,z:number}[]} one spot per hall, in the order given
 */
export function placeYard(halls, index) {
  const yard = yardOf(index)
  const widest = Math.max(9, ...halls.map(hall => hall.w ?? 9))
  const deepest = Math.max(10, ...halls.map(hall => hall.foot ?? 10))
  const colGap = widest + 8
  const rowGap = deepest + 9
  return halls.map((_, i) => ({
    x: yard.x + (i % 2 === 0 ? -colGap / 2 : colGap / 2),
    z: yard.z - Math.floor(i / 2) * rowGap,
  }))
}

/** The spot in front of a hall's door where its official stands. */
export const doorSpot = (hall, offset = 0) => ({
  x: hall.x + offset,
  z: hall.z + (hall.foot ?? 10) / 2 + DOOR_GAP,
})

/** A section's row in front of its yard, for a 朝会. */
export function yardSlots(count, yard) {
  const perRow = 4
  return Array.from({ length: count }, (_, i) => ({
    x: yard.x + (i % perRow - (perRow - 1) / 2) * 2.6,
    z: yard.z - 4 - Math.floor(i / perRow) * 2.6,
  }))
}
