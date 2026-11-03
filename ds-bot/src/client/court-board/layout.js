// Where everything in the palace stands, as plain numbers: the 衙门 table, where each
// official stands, the court's two ranks on the square, and the ways people walk. The
// scene builds from this and the tests check it, so nothing here touches three.js.
//
// The palace faces south (+z, toward the default camera). One wall runs round the whole
// city — every 衙门 is inside it with the halls on the axis; the 午门 is in the south
// wall, the 神武门 in the north, a moat runs round the other three sides.

export const WALL = { x: 60, north: -74, south: 41.4 }
// The open lanes either side of the axis, between the palace halls and the 衙门.
export const LANE_X = 21
// The cross street south of the 金水河, where a walker crosses from one side to the other.
export const CROSS_Z = 37

const Y = '#f2b630'
const GREEN = '#3f9a6b'
const SLATE = '#6f8aa6'
const TEAL = '#3a8f95'
const DARK = '#4b4c63'
const RED = '#c4412e'

/**
 * The buildings. `type` is a plain hall unless it says oct (八角亭) or tower (观星台);
 * `spare` buildings stand empty until a Bot with no 衙门 of its own moves in.
 */
export const BUILDINGS = [
  { id: 'taihe', name: '太和殿', x: 0, z: -10, w: 22, d: 11, h: 4.2, roof: Y, tiers: 3, dbl: true, wall: RED, palace: true },
  { id: 'taihemen', name: '太和门', x: 0, z: 24, w: 12, d: 5, h: 3.2, roof: Y, tiers: 1, wall: RED, palace: true },
  { id: 'qianqing', name: '乾清宫', x: 0, z: -38, w: 15, d: 8, h: 3.6, roof: Y, tiers: 2, dbl: true, wall: RED, palace: true },
  { id: 'neige', name: '文渊阁', x: 37, z: -6, w: 12, d: 7, h: 3.4, roof: GREEN },
  { id: 'gongbu', name: '工部', x: 30, z: 14, roof: SLATE },
  { id: 'hubu', name: '户部', x: 44, z: 14, roof: SLATE },
  { id: 'xingbu', name: '刑部', x: 30, z: 30, roof: SLATE },
  { id: 'libu', name: '礼部', x: 44, z: 30, roof: SLATE },
  { id: 'nanshufang', name: '南书房', x: 30, z: -24, w: 8, d: 5.5, roof: Y, wall: RED },
  { id: 'jingyan', name: '文华殿', x: 44, z: -24, roof: GREEN, wall: RED },
  { id: 'neiwufu', name: '内承运库', x: 30, z: -44, roof: Y, wall: RED },
  { id: 'duzhi', name: '都知监', x: 44, z: -44, roof: Y, wall: RED },
  { id: 'zhenfu', name: '锦衣卫', x: -37, z: 30, w: 13, d: 7, roof: DARK },
  { id: 'jinzou', name: '通政司', x: -30, z: -6, roof: TEAL },
  { id: 'tongwen', name: '四夷馆', x: -44, z: -6, roof: GREEN },
  { id: 'liju', name: '历局', x: -30, z: -24, roof: TEAL },
  { id: 'sitian', name: '钦天监', x: -44, z: -24, type: 'tower' },
  { id: 'hanlin', name: '翰林院', x: -30, z: 14, roof: GREEN },
  { id: 'guozi', name: '国子监', x: -44, z: 14, roof: GREEN },
  { id: 'taiyi', name: '太医院', x: -30, z: -44, roof: TEAL },
  { id: 'taishi', name: '御用监', x: -44, z: -44, type: 'oct', roof: TEAL },
  { id: 'spare1', name: '', x: 30, z: -60, roof: SLATE, spare: true },
  { id: 'spare2', name: '', x: -30, z: -60, roof: GREEN, spare: true },
  { id: 'spare3', name: '', x: 44, z: -60, roof: TEAL, spare: true },
  { id: 'spare4', name: '', x: -44, z: -60, roof: SLATE, spare: true },
].map(b => ({ w: 9, d: 6, h: 3, ...b }))

export const BUILDING = Object.fromEntries(BUILDINGS.map(b => [b.id, b]))
export const SPARES = BUILDINGS.filter(b => b.spare).map(b => b.id)

/** How far a building reaches south of its middle: its terraces and front steps. */
export function footOf(b) {
  if (b.type === 'oct' || b.type === 'tower') return 9
  const tiers = b.tiers ?? 1
  const rise = tiers * 0.7
  return b.d + 2 + tiers * 1.6 * 0.8 + rise * 1.7 * 0.3
}

/** Where an official stands at his own 衙门: before its steps, his desk in front of him. */
export function homeOf(b, offset = 0) {
  return { x: b.x + offset, z: b.z + footOf(b) / 2 + 3.2 }
}

/** The ground a building covers, with room for its eaves. */
export function footprint(b) {
  if (b.type === 'oct') return { minX: b.x - 4.6, maxX: b.x + 4.6, minZ: b.z - 4.6, maxZ: b.z + 4.6 }
  if (b.type === 'tower') return { minX: b.x - 4.6, maxX: b.x + 4.6, minZ: b.z - 4.6, maxZ: b.z + 4.6 }
  const tiers = b.tiers ?? 1
  const w = b.w + 2 + tiers * 1.6
  const foot = footOf(b)
  return { minX: b.x - w / 2, maxX: b.x + w / 2, minZ: b.z - (b.d + 3) / 2, maxZ: b.z + foot / 2 }
}

/**
 * Where a court member stands. The first meeting lines up on the square before the
 * 太和殿, the second before the 乾清宫, civil officials east and the rest west, two
 * abreast, facing north.
 * @param {number} room the meeting's place in order of size, 0 first
 * @param {'E'|'W'} side
 * @param {number} index his place in his rank
 */
export function courtSlot(room, side, index) {
  const s = side === 'E' ? 1 : -1
  const base = room % 2 === 0 ? 4.2 : -26
  return { x: s * (4.6 + (index % 2) * 3.6), z: base + Math.floor(index / 2) * 3.4 }
}

/** The side of the axis a point is on: -1 west, 1 east, 0 on the axis or the square. */
const sideOf = x => (Math.abs(x) < 12 ? 0 : Math.sign(x))

/**
 * The way from one spot to another without walking through a building: out in front of
 * the 衙门, along the lane on its side, across by the street south of the 金水河 when
 * the other end is on the other side, up the far lane and in.
 * @returns {{x: number, z: number}[]} from `from` (included) to `to` (included)
 */
export function walkPath(from, to) {
  const a = sideOf(from.x)
  const b = sideOf(to.x)
  const laneA = (a || b || 1) * LANE_X
  const laneB = b === 0 ? laneA : b * LANE_X
  const path = [{ x: from.x, z: from.z }, { x: from.x, z: from.z + 3 }, { x: laneA, z: from.z + 3 }]
  if (laneA !== laneB) path.push({ x: laneA, z: CROSS_Z }, { x: laneB, z: CROSS_Z })
  if (b === 0) path.push({ x: laneB, z: to.z })
  else path.push({ x: laneB, z: to.z + 3 }, { x: to.x, z: to.z + 3 })
  path.push({ x: to.x, z: to.z })
  return path.filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.z - all[i - 1].z) > 0.01)
}

/** The guard's round on the wall top: down the west wall, along the north, up the east. */
export const PATROL = [
  { x: -WALL.x, z: WALL.south - 2 }, { x: -WALL.x, z: WALL.north }, { x: WALL.x, z: WALL.north }, { x: WALL.x, z: WALL.south - 2 },
]
export const WALL_TOP = 4.5
