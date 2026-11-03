// The palace itself, as a toy model: every hall, the walls and gates, the 金水河, the
// lanterns, the woods outside the moat. Built once per cast shape from the table in
// layout.js; everything that never moves is merged into a handful of meshes. scene.js
// owns the people and everything else that moves.
import * as THREE from 'three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BUILDINGS, LANE_X, WALL, footOf } from './layout.js'

const Y = '#f2b630'
const RED = '#c4412e'
const YAMEN = '#b8573f'
const MARBLE = '#f3efe6'
const PILLAR = '#b3382a'
const BAND = '#2f8a8a'
const SERIF = '"ZCOOL XiaoWei","Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif'
export const ROOF_COLOURS = [Y, '#3f9a6b', '#6f8aa6', '#3a8f95', '#4b4c63', '#e3a92a', '#e8b23a']
export const CROWNS = ['#5fae5a', '#7cc46a', '#4c9a57', '#f2c443', '#e8703f', '#5fae5a', '#7cc46a', '#f0a33a']

// A fixed seed, so the trees stand in the same places every time the board opens.
function seeded(start) {
  let seed = start
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export const shade = (colour, amount) => {
  const c = new THREE.Color(colour)
  c.offsetHSL(0, 0, amount)
  return c.getHex()
}

/**
 * The toon materials, shared by colour. The three-step ramp is what gives the city its
 * flat, painted look.
 */
export function createMaterials() {
  const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
  ramp.minFilter = THREE.NearestFilter
  ramp.magFilter = THREE.NearestFilter
  ramp.generateMipmaps = false
  ramp.needsUpdate = true
  const byColour = new Map()
  const mat = (colour) => {
    const key = typeof colour === 'number' ? colour : new THREE.Color(colour).getHex()
    if (!byColour.has(key)) byColour.set(key, new THREE.MeshToonMaterial({ color: key, gradientMap: ramp }))
    return byColour.get(key)
  }
  const toon = options => new THREE.MeshToonMaterial({ gradientMap: ramp, ...options })
  return { ramp, mat, toon, byColour }
}

/**
 * Builds the palace into `scene`.
 * @param {THREE.Scene} scene
 * @param {object} kit createMaterials()'s result
 * @param {{spares?: Map<string, string>, maxAniso?: number}} options the spare 衙门
 *   that have a Bot moved in, with the name on each one's plaque
 * @returns {object} what the scene needs afterwards: the lit windows and lanterns, the
 *   pick targets, the armillary, the halo before the throne, the clouds, the ground
 */
export function buildPalace(scene, kit, { spares = new Map(), maxAniso = 4 } = {}) {
  const { mat, toon } = kit
  const root = new THREE.Group()
  scene.add(root)
  const statics = new THREE.Group()
  const flats = new THREE.Group()
  const owned = []
  const glowWin = toon({ color: 0xf1d48d, emissive: 0xffa53a, emissiveIntensity: 0.2 })
  const glowLan = toon({ color: 0xe2442e, emissive: 0xff5a2a, emissiveIntensity: 0.3 })
  const pickMat = new THREE.MeshBasicMaterial({ visible: false })
  owned.push(glowWin, glowLan, pickMat)
  const pickables = []
  const rnd = seeded(7)

  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
  const C = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s)
  function add(parent, geometry, colour, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geometry, colour && colour.isMaterial ? colour : mat(colour))
    m.position.set(x, y, z)
    if (o.rx) m.rotation.x = o.rx
    if (o.ry) m.rotation.y = o.ry
    if (o.rz) m.rotation.z = o.rz
    if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2])
    m.castShadow = o.cast !== false
    m.receiveShadow = true
    if (o.keep) m.userData.noMerge = true
    parent.add(m)
    return m
  }
  function frustum(w0, d0, w1, d1, h) {
    const g = new THREE.BoxGeometry(1, 1, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i += 1) {
      const top = p.getY(i) > 0
      p.setXYZ(i, p.getX(i) * (top ? w1 : w0), (p.getY(i) + 0.5) * h, p.getZ(i) * (top ? d1 : d0))
    }
    g.computeVertexNormals()
    return g
  }
  function hipGeo(w, d, h) {
    const r = Math.max(0, (w - d) / 2)
    const A = [-w / 2, 0, -d / 2]
    const Bv = [w / 2, 0, -d / 2]
    const Cv = [w / 2, 0, d / 2]
    const D = [-w / 2, 0, d / 2]
    const R1 = [-r, h, 0]
    const R2 = [r, h, 0]
    const tris = [D, Cv, R2, D, R2, R1, Bv, A, R1, Bv, R1, R2, Cv, Bv, R2, A, D, R1, A, Bv, Cv, A, Cv, D]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
    g.computeVertexNormals()
    return g
  }
  function roof(p, w, d, y, colour, hh) {
    const dark = shade(colour, -0.16)
    add(p, B(w, 0.28, d), dark, 0, y + 0.14, 0)
    const sk = hh * 0.28
    const w1 = w - d * 0.3
    const d1 = d * 0.7
    add(p, frustum(w, d, w1, d1, sk), colour, 0, y + 0.28, 0)
    const top = y + 0.28 + sk
    const rh = hh * 0.72
    add(p, hipGeo(w1, d1, rh), colour, 0, top, 0)
    const r = Math.max(0, (w1 - d1) / 2)
    if (r > 0.2) {
      add(p, B(2 * r + 0.5, 0.32, 0.32), dark, 0, top + rh, 0)
      add(p, B(0.32, 0.8, 0.32), dark, r + 0.15, top + rh + 0.3, 0)
      add(p, B(0.32, 0.8, 0.32), dark, -r - 0.15, top + rh + 0.3, 0)
    } else add(p, new THREE.SphereGeometry(0.35, 8, 6), '#e8b23a', 0, top + rh + 0.1, 0)
    return top + rh
  }
  function plaque(p, text, x, y, z, w) {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 176
    const c = cv.getContext('2d')
    c.fillStyle = '#e3a92a'
    c.fillRect(0, 0, 512, 176)
    c.fillStyle = '#22406f'
    c.fillRect(12, 12, 488, 152)
    c.strokeStyle = '#f4d27a'
    c.lineWidth = 4
    c.strokeRect(24, 24, 464, 128)
    let fs = 96
    c.font = `${fs}px ${SERIF}`
    while (c.measureText(text).width > 430 && fs > 40) { fs -= 6; c.font = `${fs}px ${SERIF}` }
    c.fillStyle = '#f6d47c'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, 256, 92)
    const texture = new THREE.CanvasTexture(cv)
    texture.anisotropy = maxAniso
    const material = new THREE.MeshBasicMaterial({ map: texture })
    owned.push(texture, material)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 176 / 512), material)
    m.position.set(x, y, z)
    m.userData.noMerge = true
    p.add(m)
    return m
  }
  function lantern(p, x, z, y0 = 0) {
    add(p, C(0.07, 0.09, 2.3, 6), '#3b2a24', x, y0 + 1.15, z)
    add(p, B(0.6, 0.08, 0.08), '#3b2a24', x, y0 + 2.25, z + 0.2)
    add(p, new THREE.SphereGeometry(0.34, 10, 8), glowLan, x, y0 + 1.85, z + 0.42, { s: [1, 1.25, 1] })
    add(p, C(0.2, 0.2, 0.08, 8), '#e3a92a', x, y0 + 2.27, z + 0.42)
    add(p, C(0.2, 0.2, 0.08, 8), '#e3a92a', x, y0 + 1.43, z + 0.42)
  }
  function pick(parent, geometry, x, y, z, id) {
    const m = add(parent, geometry, pickMat, x, y, z, { keep: true, cast: false })
    m.userData.bid = id
    pickables.push(m)
  }

  function hall(b, name) {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    statics.add(g)
    const { w, d, h } = b
    const tiers = b.tiers ?? 1
    const th = 0.7
    const wall = b.wall ?? YAMEN
    let y = 0
    let topD = d
    for (let i = 0; i < tiers; i += 1) {
      const ext = (tiers - i) * 1.6
      const tw = w + 2 + ext
      const td = d + 2 + ext * 0.8
      add(g, B(tw, th, td), MARBLE, 0, y + th / 2, 0)
      add(g, B(tw + 0.1, 0.12, td + 0.1), '#e2dbcc', 0, y + th - 0.06, 0)
      y += th
      topD = td
    }
    const run = y * 1.7
    const L = Math.hypot(y, run)
    const z0 = topD / 2
    add(g, B(3.4, 0.3, L), MARBLE, 0, y / 2, z0 + run / 2, { rx: Math.atan2(y, run) })
    add(g, B(1.4, 0.32, L), '#e8dcc0', 0, y / 2 + 0.04, z0 + run / 2, { rx: Math.atan2(y, run) })
    add(g, B(w, h, d), wall, 0, y + h / 2, 0)
    const n = Math.max(4, Math.round(w / 2.4))
    const cz = d / 2 + 0.7
    for (let i = 0; i < n; i += 1) {
      const x = -w / 2 + 0.4 + (w - 0.8) * i / (n - 1)
      add(g, C(0.2, 0.23, h, 8), PILLAR, x, y + h / 2, cz)
    }
    add(g, B(w + 0.6, 0.32, 0.4), '#7f2a1f', 0, y + h - 0.12, cz)
    add(g, B(2.2, h * 0.74, 0.16), '#6e2a20', 0, y + h * 0.37, d / 2 + 0.06)
    add(g, B(0.12, h * 0.74, 0.2), '#e3a92a', 0, y + h * 0.37, d / 2 + 0.1)
    const wx = Math.min(w / 4 + 0.6, w / 2 - 1.2)
    add(g, B(1.7, h * 0.38, 0.14), glowWin, wx, y + h * 0.55, d / 2 + 0.06)
    add(g, B(1.7, h * 0.38, 0.14), glowWin, -wx, y + h * 0.55, d / 2 + 0.06)
    add(g, B(w + 1.4, 0.45, d + 1.8), BAND, 0, y + h + 0.2, 0)
    const yr = y + h + 0.42
    const hh = d * 0.45 + 1.2
    let top
    if (b.dbl) {
      add(g, B(w + 3, 0.28, d + 3), shade(b.roof, -0.16), 0, yr + 0.14, 0)
      add(g, frustum(w + 3, d + 3, w + 0.8, d + 0.8, 1.1), b.roof, 0, yr + 0.28, 0)
      const uw = w * 0.82
      const ud = d * 0.78
      add(g, B(uw, 1.5, ud), wall, 0, yr + 1.9, 0)
      add(g, B(uw + 1, 0.4, ud + 1), BAND, 0, yr + 2.75, 0)
      top = roof(g, uw + 2.6, ud + 2.6, yr + 2.95, b.roof, hh)
      plaque(g, name, 0, yr + 1.95, ud / 2 + 0.04, Math.min(3.6, uw * 0.4))
    } else {
      top = roof(g, w + 3, d + 3, yr, b.roof, hh)
      if (name) plaque(g, name, 0, y + h - 0.55, cz + 0.24, Math.min(3.4, w * 0.42))
    }
    const fz = footOf(b) / 2 + 0.5 - run * 0.15
    lantern(g, 2.3, fz)
    lantern(g, -2.3, fz)
    pick(g, B(w + 3, top, d + 3), 0, top / 2, 0, b.id)
    b.platY = y
    return g
  }

  function octPavilion(b, scale = 1, name = b.name) {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    statics.add(g)
    const s = scale
    add(g, C(4.2 * s, 4.5 * s, 0.7, 8), MARBLE, 0, 0.35, 0)
    for (let i = 0; i < 8; i += 1) {
      const a = i / 8 * Math.PI * 2 + Math.PI / 8
      add(g, C(0.18, 0.2, 3, 8), PILLAR, Math.cos(a) * 3.1 * s, 0.7 + 1.5, Math.sin(a) * 3.1 * s)
    }
    add(g, C(3.5 * s, 3.5 * s, 0.4, 8), BAND, 0, 3.9, 0)
    add(g, C(3.1 * s, 5.2 * s, 0.9, 8), b.roof ?? '#3a8f95', 0, 4.5, 0)
    add(g, C(0.2, 3.2 * s, 2.6 * s, 8), b.roof ?? '#3a8f95', 0, 4.95 + 1.3 * s, 0)
    add(g, new THREE.SphereGeometry(0.38, 8, 6), '#e3a92a', 0, 4.95 + 2.6 * s + 0.2, 0)
    if (name) {
      // 御用监's workbench: a lathe wheel and a crucible.
      add(g, C(1.2, 1.2, 0.12, 24), '#f6efe0', 0, 1.35, 0)
      add(g, C(0.6, 0.6, 0.14, 24), '#2b2b3d', 0, 1.37, 0)
      add(g, C(0.15, 0.25, 0.6, 8), '#7f2a1f', 0, 1.0, 0)
      plaque(g, name, 0, 3.35, 3.0 * s, 2.6)
      lantern(g, 2.2, 5.2)
      lantern(g, -2.2, 5.2)
      pick(g, C(5, 5, 8, 8), 0, 4, 0, b.id)
    }
    return g
  }

  // 钦天监's 观星台: a stone platform with battlements and, on top, an armillary sphere
  // the scene turns while the 监正 works.
  const armillary = new THREE.Group()
  function tower(b) {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    statics.add(g)
    const stone = '#bdb3a1'
    add(g, frustum(9, 9, 7.2, 7.2, 4.6), stone, 0, 0, 0)
    for (let i = 0; i < 4; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const a = i * Math.PI / 2
        const ox = Math.round(Math.cos(a))
        const oz = Math.round(Math.sin(a))
        add(g, B(1.1, 0.6, 0.5), stone, ox * 3.4 + (oz ? j * 2.4 : 0), 4.9, oz * 3.4 + (ox ? j * 2.4 : 0), { ry: a })
      }
    }
    add(g, B(2.2, 2.8, 0.4), '#6e2a20', 0, 1.4, 4.35)
    const bronze = '#b07a35'
    add(g, C(0.15, 0.3, 1.4, 8), bronze, 0, 5.3, -0.8)
    add(g, C(0.15, 0.15, 1.6, 6), bronze, 2.3, 5.4, 1.6, { rz: 0.5 })
    add(g, B(1.2, 0.1, 1.2), bronze, 2.4, 5, 2, { rx: 0.4 })
    plaque(g, b.name, 0, 3.25, 3.97, 2.6).rotation.x = -0.19
    lantern(g, 2.2, 6)
    lantern(g, -2.2, 6)
    pick(g, B(9, 8, 9), 0, 4, 0, b.id)
    armillary.position.set(b.x, 7.0, b.z - 0.8)
    for (const [rx, rz, r] of [[Math.PI / 2, 0, 1.5], [0, 0, 1.5], [Math.PI / 2, 0.5, 1.25], [0.4, 0, 1.2]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 28), mat('#c99a45'))
      ring.rotation.set(rx, 0, rz)
      ring.castShadow = true
      armillary.add(ring)
    }
    armillary.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat('#e3a92a')))
    root.add(armillary)
    return g
  }

  for (const b of BUILDINGS) {
    if (b.spare && !spares.has(b.id)) continue
    const name = b.spare ? spares.get(b.id) : b.name
    if (b.type === 'oct') octPavilion(b, 1, name)
    else if (b.type === 'tower') tower(b)
    else hall(b, name)
  }

  // The throne on the 太和殿's terrace, empty: the Emperor is the one looking on.
  const tb = BUILDINGS.find(b => b.id === 'taihe')
  const ty = tb.platY
  const tz = tb.z + tb.d / 2 + 1.9
  add(statics, B(1.8, 0.6, 1.3), '#e3a92a', 0, ty + 0.3, tz)
  add(statics, B(2, 1.9, 0.3), '#e3a92a', 0, ty + 1.0, tz - 0.6)
  add(statics, B(1.4, 0.18, 1), '#c8402f', 0, ty + 0.66, tz + 0.05)
  add(statics, new THREE.SphereGeometry(0.22, 8, 6), '#e3a92a', 0.9, ty + 2, tz - 0.6)
  add(statics, new THREE.SphereGeometry(0.22, 8, 6), '#e3a92a', -0.9, ty + 2, tz - 0.6)
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  owned.push(haloMat)
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.6, 40), haloMat)
  halo.rotation.x = -Math.PI / 2
  halo.position.set(0, ty + 0.05, tz)
  root.add(halo)
  // A 日晷 and a bronze crane either side of the throne.
  add(statics, C(0.5, 0.6, 1.1, 8), MARBLE, -8.5, ty + 0.55, tz - 0.6)
  add(statics, C(0.9, 0.9, 0.1, 20), '#d8d2c2', -8.5, ty + 1.2, tz - 0.6, { rx: -0.7 })
  add(statics, C(0.03, 0.03, 1.2, 4), '#7a5a3a', -8.5, ty + 1.25, tz - 0.6, { rx: -0.7 })
  add(statics, C(0.6, 0.7, 0.5, 8), MARBLE, 8.5, ty + 0.25, tz - 0.6)
  add(statics, new THREE.SphereGeometry(0.45, 8, 6), '#3f6e5a', 8.5, ty + 1, tz - 0.6, { s: [1, 0.8, 1.4] })
  add(statics, C(0.06, 0.08, 0.9, 5), '#3f6e5a', 8.5, ty + 1.6, tz - 0.2, { rx: 0.3 })
  add(statics, new THREE.SphereGeometry(0.15, 6, 5), '#d2452f', 8.5, ty + 2.05, tz - 0.05)

  // 午门 in the south wall.
  {
    const g = new THREE.Group()
    g.position.set(0, 0, 44)
    statics.add(g)
    add(g, B(26, 7, 6), RED, 0, 3.5, 0)
    add(g, B(26.4, 0.5, 6.4), '#e3a92a', 0, 7.1, 0)
    add(g, B(26.4, 0.8, 6.4), MARBLE, 0, 0.4, 0)
    for (const x of [-6.5, 0, 6.5]) add(g, B(x ? 2.4 : 3, x ? 3.8 : 4.4, 6.2), '#4a2a22', x, x ? 1.9 : 2.2, 0)
    for (const sx of [-1, 1]) {
      add(g, B(5, 7, 14), RED, sx * 13.5, 3.5, 7)
      add(g, B(5.4, 0.5, 14.4), '#e3a92a', sx * 13.5, 7.1, 7)
      const t = new THREE.Group()
      t.position.set(sx * 13.5, 7.3, 12)
      g.add(t)
      add(t, B(3.6, 2, 3.6), RED, 0, 1, 0)
      add(t, B(4.4, 0.35, 4.4), BAND, 0, 2.1, 0)
      roof(t, 6, 6, 2.25, Y, 3)
    }
    const top = new THREE.Group()
    top.position.set(0, 7.3, 0)
    g.add(top)
    add(top, B(15, 2.6, 4.6), RED, 0, 1.3, 0)
    for (let i = 0; i < 7; i += 1) add(top, C(0.18, 0.2, 2.6, 8), PILLAR, -7.2 + i * 2.4, 1.3, 2.6)
    add(top, B(16.4, 0.4, 6.2), BAND, 0, 2.8, 0)
    add(top, B(18, 0.28, 8), shade(Y, -0.16), 0, 3.14, 0)
    add(top, frustum(18, 8, 15.8, 5.8, 0.9), Y, 0, 3.28, 0)
    add(top, B(12.4, 1.2, 4.2), RED, 0, 4.6, 0)
    roof(top, 15.4, 7.2, 5.2, Y, 4.2)
    plaque(top, '午门', 0, 4.6, 2.12, 2.6)
  }

  // One wall round the whole city, a 角楼 at each corner, the 神武门 in the north.
  function wallSeg(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const alongZ = Math.abs(z1 - z0) > Math.abs(x1 - x0)
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    add(statics, alongZ ? B(1.2, 4, len) : B(len, 4, 1.2), RED, cx, 2, cz)
    add(statics, alongZ ? B(1.9, 0.5, len + 0.4) : B(len + 0.4, 0.5, 1.9), '#e3a92a', cx, 4.25, cz)
    add(statics, alongZ ? B(1.5, 0.4, len) : B(len, 0.4, 1.5), MARBLE, cx, 0.2, cz)
  }
  const { x: OX, north: ON, south: OS } = WALL
  wallSeg(-OX, ON, -4, ON)
  wallSeg(4, ON, OX, ON)
  for (const s of [-1, 1]) {
    wallSeg(OX * s, ON, OX * s, OS)
    wallSeg(16 * s, OS, OX * s, OS)
  }
  {
    const g = new THREE.Group()
    g.position.set(0, 0, ON)
    statics.add(g)
    add(g, B(1.4, 4.8, 1.8), RED, -2.6, 2.4, 0)
    add(g, B(1.4, 4.8, 1.8), RED, 2.6, 2.4, 0)
    add(g, B(6.6, 0.9, 1.9), RED, 0, 4.4, 0)
    add(g, B(6.8, 0.35, 2.4), BAND, 0, 4.95, 0)
    roof(g, 8, 3.6, 5.1, Y, 2)
  }
  for (const [x, z] of [[-OX, ON], [OX, ON], [-OX, OS], [OX, OS]]) {
    const g = new THREE.Group()
    g.position.set(x, 4.5, z)
    statics.add(g)
    add(g, B(3.4, 0.4, 3.4), MARBLE, 0, 0.2, 0)
    add(g, B(2.6, 1.8, 2.6), RED, 0, 1.3, 0)
    add(g, B(3.2, 0.35, 3.2), BAND, 0, 2.35, 0)
    roof(g, 4.6, 4.6, 2.5, Y, 2.6)
  }

  // 御花园 behind the 乾清宫.
  octPavilion({ x: 0, z: -50, roof: '#3a8f95' }, 0.55, '')

  // ---------------------------------------------------------------------------
  // Ground: grass outside, paving inside the wall, pale roads, the moat.
  const tex = (draw, size = 256) => {
    const cv = document.createElement('canvas')
    cv.width = size
    cv.height = size
    draw(cv.getContext('2d'), size)
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.anisotropy = maxAniso
    owned.push(t)
    return t
  }
  const grassMat = toon({ color: 0xa9cf87 })
  owned.push(grassMat)
  const grass = new THREE.Mesh(new THREE.CircleGeometry(190, 48), grassMat)
  grass.rotation.x = -Math.PI / 2
  grass.receiveShadow = true
  root.add(grass)
  const paveTex = tex((c, s) => {
    c.fillStyle = '#ead9b8'
    c.fillRect(0, 0, s, s)
    const n = 4
    const q = s / n
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        c.fillStyle = `rgba(${200 + ((i * 7 + j * 3) % 5) * 6},${180 + ((i + j * 5) % 4) * 7},${140 + ((i * 3 + j) % 3) * 8},.35)`
        c.fillRect(i * q + 1, j * q + 1, q - 2, q - 2)
      }
    }
    c.strokeStyle = 'rgba(160,130,95,.45)'
    c.lineWidth = 2
    for (let i = 0; i <= n; i += 1) {
      c.beginPath(); c.moveTo(i * q, 0); c.lineTo(i * q, s); c.stroke()
      c.beginPath(); c.moveTo(0, i * q); c.lineTo(s, i * q); c.stroke()
    }
  })
  const paveW = OX * 2
  const paveD = OS - ON
  paveTex.repeat.set(paveW / 4, paveD / 4)
  const paveMat = toon({ color: 0xffffff, map: paveTex })
  owned.push(paveMat)
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(paveW, paveD), paveMat)
  pave.rotation.x = -Math.PI / 2
  pave.position.set(0, 0.03, (ON + OS) / 2)
  pave.receiveShadow = true
  root.add(pave)
  const ROAD = '#e4d6b8'
  const flat = (w, d, x, z, colour = ROAD, y = 0.05) => {
    const m = new THREE.Mesh(B(w, y * 2, d), mat(colour))
    m.position.set(x, y, z)
    m.receiveShadow = true
    flats.add(m)
  }
  flat(3.2, 46, 0, 19, '#f5efe2', 0.07)
  flat(28, 18, 0, 52, ROAD)
  for (const s of [-1, 1]) flat(3.2, OS - ON - 6, LANE_X * s, (ON + OS) / 2 + 2)
  flat(2 * LANE_X + 3.2, 3.2, 0, 37)
  for (const b of BUILDINGS) {
    if (Math.abs(b.x) < 15 || (b.spare && !spares.has(b.id))) continue
    const foot = footOf(b)
    flat(b.w + 6, foot + 9, b.x, b.z + 3)
    const hz = b.z + foot / 2 + 3.2 + 3
    const reach = Math.abs(b.x) - (LANE_X - 2) + 5
    flat(reach, 3, (reach / 2 + LANE_X - 2) * Math.sign(b.x), hz)
  }
  {
    const water = toon({ color: 0x7cc3d8, emissive: 0x2a6d86, emissiveIntensity: 0.15 })
    owned.push(water)
    for (const [w, d, x, z] of [[2 * OX + 16, 5, 0, ON - 5.5], [5, OS - ON + 11, -OX - 5.5, (ON + OS) / 2], [5, OS - ON + 11, OX + 5.5, (ON + OS) / 2]]) {
      const m = new THREE.Mesh(B(w, 0.2, d), water)
      m.position.set(x, 0.06, z)
      m.receiveShadow = true
      root.add(m)
      flat(w + 1.4, d + 1.4, x, z, '#d9cfbb', 0.03)
    }
  }

  // 金水河 and its five bridges.
  {
    const f = x => 31.5 - x * x / 70
    const xs = []
    for (let x = -18; x <= 18; x += 1) xs.push(x)
    const ribbon = (wd, y, material) => {
      const arr = []
      const normal = (x) => { const dz = -2 * x / 70; const l = Math.hypot(1, dz); return [-dz / l, 1 / l] }
      for (let i = 0; i < xs.length - 1; i += 1) {
        const a = xs[i]
        const b = xs[i + 1]
        const [nax, naz] = normal(a)
        const [nbx, nbz] = normal(b)
        const A1 = [a + nax * wd, y, f(a) + naz * wd]
        const A2 = [a - nax * wd, y, f(a) - naz * wd]
        const B1 = [b + nbx * wd, y, f(b) + nbz * wd]
        const B2 = [b - nbx * wd, y, f(b) - nbz * wd]
        arr.push(...A1, ...A2, ...B1, ...B1, ...A2, ...B2)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      g.computeVertexNormals()
      const nn = g.attributes.normal
      for (let i = 0; i < nn.count; i += 1) nn.setXYZ(i, 0, 1, 0)
      const m = new THREE.Mesh(g, material)
      m.receiveShadow = true
      root.add(m)
    }
    const bank = toon({ color: 0xf3efe6, side: THREE.DoubleSide })
    const water = toon({ color: 0x7cc3d8, emissive: 0x2a6d86, emissiveIntensity: 0.15, side: THREE.DoubleSide })
    owned.push(bank, water)
    ribbon(1.9, 0.08, bank)
    ribbon(1.45, 0.1, water)
    for (const x of [-8, -4, 0, 4, 8]) {
      const z = f(x)
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = Math.atan(2 * x / 70)
      statics.add(g)
      add(g, B(2.4, 0.35, 4.6), MARBLE, 0, 0.3, 0)
      add(g, B(2.4, 0.3, 2.4), MARBLE, 0, 0.55, 0)
      add(g, B(0.16, 0.45, 4.4), '#ece6d8', 1.15, 0.8, 0)
      add(g, B(0.16, 0.45, 4.4), '#ece6d8', -1.15, 0.8, 0)
    }
  }

  // Lanterns along the 御道 and before the 午门.
  for (const z of [3, 9, 15]) for (const s of [-1, 1]) lantern(statics, 2.9 * s, z)
  for (const x of [-9, 9]) lantern(statics, x, 48.5)

  // Woods outside the moat, a few trees inside, the garden's rocks and flower beds.
  const lowIco = r => new THREE.IcosahedronGeometry(r, 0)
  function tree(x, z, s, ci) {
    const c = CROWNS[ci ?? Math.floor(rnd() * CROWNS.length)]
    add(statics, C(0.18 * s, 0.28 * s, 1.6 * s, 6), '#8a5a3a', x, 0.8 * s, z)
    add(statics, lowIco(1.4 * s), c, x, 2.4 * s, z)
    add(statics, lowIco(0.95 * s), shade(c, 0.06), x + 0.6 * s, 3.1 * s, z - 0.3 * s)
  }
  let placed = 0
  let guard = 0
  while (placed < 110 && guard < 5000) {
    guard += 1
    const a = rnd() * Math.PI * 2
    const r = 74 + rnd() * 80
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r - 12
    if (Math.abs(x) < 74 && z > ON - 14 && z < 64) continue
    tree(x, z, 0.9 + rnd() * 0.7)
    placed += 1
  }
  for (let z = ON + 4; z <= 40; z += 9) { tree(OX + 11 + rnd() * 2, z, 1 + rnd() * 0.4); tree(-OX - 11 - rnd() * 2, z, 1 + rnd() * 0.4) }
  for (let x = -OX + 4; x <= OX - 4; x += 8) {
    if (Math.abs(x) < 17) continue
    tree(x, ON - 13 - rnd() * 2, 1 + rnd() * 0.4)
    if (Math.abs(x) > 20) tree(x, 52 + rnd() * 3, 1 + rnd() * 0.4)
  }
  for (const [x, z, ci] of [[-12, -49, 3], [12, -49, 4], [-8, -53, 0], [8, -53, 1], [-14, -53, 7], [14, -53, 2], [-12, -30, 3], [12, -30, 4]]) tree(x, z, 0.9, ci)
  for (const b of BUILDINGS) {
    if (Math.abs(b.x) <= 15 || (b.spare && !spares.has(b.id))) continue
    tree(b.x + Math.sign(b.x) * (b.w / 2 + 2.6), b.z - 1.5, 0.8)
  }
  for (let i = 0; i < 6; i += 1) add(statics, lowIco(0.5 + rnd() * 0.7), '#9a9a8e', -6 + rnd() * 3 - 1.5, 0.4, -50 + rnd() * 3 - 1.5)
  for (let i = 0; i < 6; i += 1) {
    const x = 9 + (i % 3) * 4
    const z = -57 + Math.floor(i / 3) * 2.5
    add(statics, B(3, 0.35, 1.6), '#7a5a3a', x, 0.17, z)
    add(statics, B(2.6, 0.4, 1.2), i % 2 ? '#9d7cc9' : '#6fb35f', x, 0.45, z, { cast: false })
  }

  // ---------------------------------------------------------------------------
  // Merge everything that never moves into one mesh per material.
  const merged = []
  function merge(group, cast) {
    group.updateMatrixWorld(true)
    const buckets = new Map()
    const keep = []
    group.traverse((o) => {
      if (!o.isMesh) return
      if (o.userData.noMerge) { keep.push(o); return }
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      g.applyMatrix4(o.matrixWorld)
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
      if (!buckets.has(o.material.uuid)) buckets.set(o.material.uuid, { m: o.material, gs: [] })
      buckets.get(o.material.uuid).gs.push(g)
      o.geometry.dispose()
    })
    for (const o of keep) { o.updateMatrixWorld(true); root.attach(o) }
    for (const { m, gs } of buckets.values()) {
      const geometry = BufferGeometryUtils.mergeBufferGeometries(gs)
      for (const g of gs) g.dispose()
      const mesh = new THREE.Mesh(geometry, m)
      mesh.castShadow = cast
      mesh.receiveShadow = true
      root.add(mesh)
      merged.push(mesh)
    }
  }
  root.add(statics)
  root.add(flats)
  merge(statics, true)
  merge(flats, false)
  root.remove(statics)
  root.remove(flats)

  // Clouds drifting high over the city.
  const cloudMat = toon({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 })
  owned.push(cloudMat)
  const clouds = []
  for (let i = 0; i < 7; i += 1) {
    const g = new THREE.Group()
    const n = 3 + Math.floor(rnd() * 3)
    for (let j = 0; j < n; j += 1) {
      const s = 2.4 + rnd() * 2.4
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), cloudMat)
      m.position.set(j * 3.2 - n * 1.6, rnd() * 1.2, rnd() * 2)
      m.scale.y = 0.75
      g.add(m)
    }
    const a = rnd() * Math.PI * 2
    const r = 120 + rnd() * 50
    g.position.set(Math.cos(a) * r, 26 + rnd() * 18, Math.sin(a) * r - 20)
    g.userData.v = 1.2 + rnd() * 1.6
    root.add(g)
    clouds.push(g)
  }

  return {
    root, pickables, glowWin, glowLan, armillary, halo, clouds, cloudMat, grass, pave,
    throne: { y: ty, z: tz },
    dispose() {
      scene.remove(root)
      root.traverse((o) => { if (o.geometry) o.geometry.dispose() })
      for (const m of owned) m.dispose()
    },
  }
}
