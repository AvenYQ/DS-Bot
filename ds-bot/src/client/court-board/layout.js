// Where a section's halls and its people stand. Kept out of the 3D scene so the placement
// can be tested on its own: no one's doorway may land inside another hall, and a hall's
// figure stands in front of that hall, not of the one next door.

// Where each section's halls stand. A section gets a block exactly as deep as its own
// rows need, and blocks are stacked down one of two columns flanking the palace, so a
// yard can never reach into the next one however many halls a section has.
export const DOOR_GAP = 2.4
const COLUMNS = [{ x: 40 }, { x: -40 }]
const TOP = -14
// A yard's doors stand one door-gap south of its last row, so blocks must clear that too.
const YARD_GAP = 30

const yardSize = halls => {
  const widest = Math.max(9, ...halls.map(hall => hall.w ?? 9))
  const deepest = Math.max(10, ...halls.map(hall => hall.foot ?? 10))
  const rows = Math.ceil(halls.length / 2)
  return { colGap: widest + 8, rowGap: deepest + 9, rows }
}

/**
 * One block per section: where its halls stand and where the section gathers.
 * @param {Array<Array<{w?:number,foot?:number}>>} sections halls of each section, in order
 * @returns {Array<{x:number, z:number, halls:{x:number,z:number}[]}>}
 */
export function planYards(sections) {
  const cursors = COLUMNS.map(() => TOP)
  return sections.map((halls, index) => {
    const column = index % COLUMNS.length
    const { colGap, rowGap, rows } = yardSize(halls)
    const height = Math.max(0, (rows - 1) * rowGap)
    const x = COLUMNS[column].x
    const z = cursors[column] - height / 2
    cursors[column] = z - height / 2 - YARD_GAP
    return {
      x, z,
      halls: halls.map((_, i) => ({
        x: x + (i % 2 === 0 ? -colGap / 2 : colGap / 2),
        z: z - Math.floor(i / 2) * rowGap,
      })),
    }
  })
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
