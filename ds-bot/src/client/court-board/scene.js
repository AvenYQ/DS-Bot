// The 值房图 diorama: a toy Forbidden City with one bureau per building and one
// Q-version official per Bot.
//
// The module owns the canvas and the floating name tags only; the title bar, the
// official card, the roster and the time slider are the React shell's. One factory
// call builds the world, the returned object drives it and tears it down.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// three r128 exports BufferGeometryUtils as a class and mergeBufferGeometries calls
// this.mergeBufferAttributes, so the method cannot be called detached from the class.
const mergeBufferGeometries = geometries => BufferGeometryUtils.mergeBufferGeometries(geometries)

const Y = '#f2b630'
const GREEN = '#3f9a6b'
const SLATE = '#6f8aa6'
const TEAL = '#3a8f95'
const DARK = '#4b4c63'
const RED = '#c4412e'
const YAMEN = '#b8573f'
const MARBLE = '#f3efe6'
const PILLAR = '#b3382a'
const BAND = '#2f8a8a'
const SKIN = '#fbe2c8'
const INK = '#2b211d'
const HAT_INK = '#22201f'
const ROAD = '#e4d6b8'

const BLD = [
  { id: 'taihe', name: '太和殿', x: 0, z: -10, w: 22, d: 11, h: 4.2, roof: Y, tiers: 3, dbl: true, wall: RED, palace: 1 },
  { id: 'taihemen', name: '太和门', x: 0, z: 24, w: 12, d: 5, h: 3.2, roof: Y, tiers: 1, wall: RED, palace: 1 },
  { id: 'qianqing', name: '乾清宫', x: 0, z: -38, w: 15, d: 8, h: 3.6, roof: Y, tiers: 2, dbl: true, wall: RED, palace: 1 },
  { id: 'neige', name: '文渊阁', x: 37, z: -6, w: 12, d: 7, h: 3.4, roof: GREEN },
  { id: 'gongbu', name: '工部', x: 30, z: 14, roof: SLATE },
  { id: 'hubu', name: '户部', x: 44, z: 14, roof: SLATE },
  { id: 'xingbu', name: '刑部', x: 30, z: 30, roof: SLATE },
  { id: 'libu', name: '礼部', x: 44, z: 30, roof: SLATE },
  { id: 'nanshufang', name: '南书房', x: 30, z: -24, w: 8, d: 5.5, roof: Y, wall: RED },
  { id: 'jingyan', name: '文华殿', x: 44, z: -24, roof: GREEN, wall: RED },
  { id: 'neiwufu', name: '内务府', x: 30, z: -44, roof: Y, wall: RED },
  { id: 'duzhi', name: '都知监', x: 44, z: -44, roof: Y, wall: RED },
  { id: 'zhenfu', name: '北镇抚司', x: -37, z: 30, w: 13, d: 7, roof: DARK },
  { id: 'jinzou', name: '进奏院', x: -30, z: -6, roof: TEAL },
  { id: 'tongwen', name: '同文馆', x: -44, z: -6, roof: GREEN },
  { id: 'liju', name: '历局', x: -30, z: -24, roof: TEAL },
  { id: 'sitian', name: '观星台', x: -44, z: -24, type: 'tower' },
  { id: 'hanlin', name: '翰林院', x: -30, z: 14, roof: GREEN },
  { id: 'guozi', name: '国子监', x: -44, z: 14, roof: GREEN },
  { id: 'taiyi', name: '太医院', x: -30, z: -44, roof: TEAL },
  { id: 'taishi', name: '太史局', x: -44, z: -44, type: 'oct' },
]

const HATS = ['wusha', 'nei', 'jyw', 'fj', 'dao']
const CROWNS = ['#5fae5a', '#7cc46a', '#4c9a57', '#f2c443', '#e8703f', '#5fae5a', '#7cc46a', '#f0a33a']
// Ring colours, one per figure state; walk/back/court come from setCourt.
const RING = {
  work: '#e3a92a',
  alert: '#d2452f',
  error: '#d2452f',
  idle: '#c9bba8',
  sleep: '#5b6aa8',
  court: '#d2452f',
  walk: '#d2452f',
  back: '#5b6aa8',
  waiting: '#c9bba8',
  done: '#3f9a6b',
  pending: '#c9bba8',
}

const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const cl = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)
const clip = (text, n = 9) => text.length > n ? text.slice(0, n) + '…' : text

export function createCourtScene({ container, tags, onSelect, onOpen }) {
  let dead = false
  let running = false
  let raf = 0

  const containerBackground = container.style.background
  const containerPosition = container.style.position
  // The canvas is absolutely positioned so it can never feed its own size back into
  // the container; that needs a positioned containing block to sit in.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.outline = 'none'
  container.appendChild(canvas)

  const measure = () => {
    const rect = container.getBoundingClientRect()
    return { w: Math.max(1, rect.width), h: Math.max(1, rect.height) }
  }
  const first = measure()
  const narrow = first.w < 700
  renderer.setSize(first.w, first.h, false)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xe9f4f2, 150, 330)
  const camera = new THREE.PerspectiveCamera(narrow ? 50 : 40, first.w / first.h, 0.5, 700)
  camera.position.set(narrow ? 62 : 74, narrow ? 100 : 72, narrow ? 118 : 100)
  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0, -4)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = 1.32
  controls.minDistance = 14
  controls.maxDistance = 240
  controls.screenSpacePanning = false
  controls.update()

  const hemi = new THREE.HemisphereLight(0xdff2ff, 0xb9a782, 0.6)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(40, 80, 50)
  sun.target.position.set(0, 0, -6)
  scene.add(sun, sun.target)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 320 })
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.03

  const gm = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
  gm.minFilter = gm.magFilter = THREE.NearestFilter
  gm.generateMipmaps = false
  gm.needsUpdate = true

  const mats = {}
  const mat = c => {
    const key = typeof c === 'number' ? c : new THREE.Color(c).getHex()
    if (!mats[key]) mats[key] = new THREE.MeshToonMaterial({ color: key, gradientMap: gm })
    return mats[key]
  }
  const glowWin = new THREE.MeshToonMaterial({ color: 0xf1d48d, gradientMap: gm, emissive: 0xffa53a, emissiveIntensity: 0.2 })
  const glowLan = new THREE.MeshToonMaterial({ color: 0xe2442e, gradientMap: gm, emissive: 0xff5a2a, emissiveIntensity: 0.3 })
  const pickMat = new THREE.MeshBasicMaterial({ visible: false })
  const shade = (c, a) => {
    const col = new THREE.Color(c)
    col.offsetHSL(0, 0, a)
    return col.getHex()
  }

  const statics = new THREE.Group()
  scene.add(statics)
  const flats = new THREE.Group()
  scene.add(flats)
  const pickables = []

  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
  const C = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s)
  const add = (parent, geo, c, x = 0, y = 0, z = 0, o = {}) => {
    const mesh = new THREE.Mesh(geo, (c && c.isMaterial) ? c : mat(c))
    mesh.position.set(x, y, z)
    if (o.rx) mesh.rotation.x = o.rx
    if (o.ry) mesh.rotation.y = o.ry
    if (o.rz) mesh.rotation.z = o.rz
    if (o.s) mesh.scale.set(o.s[0], o.s[1], o.s[2])
    mesh.castShadow = o.cast !== false
    mesh.receiveShadow = true
    if (o.keep) mesh.userData.noMerge = true
    parent.add(mesh)
    return mesh
  }
  const frustum = (w0, d0, w1, d1, h) => {
    const g = new THREE.BoxGeometry(1, 1, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0
      p.setXYZ(i, p.getX(i) * (top ? w1 : w0), (p.getY(i) + 0.5) * h, p.getZ(i) * (top ? d1 : d0))
    }
    g.computeVertexNormals()
    return g
  }
  const hipGeo = (w, d, h) => {
    const r = Math.max(0, (w - d) / 2)
    const A = [-w / 2, 0, -d / 2], Bv = [w / 2, 0, -d / 2], Cv = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2]
    const R1 = [-r, h, 0], R2 = [r, h, 0]
    const tris = [D, Cv, R2, D, R2, R1, Bv, A, R1, Bv, R1, R2, Cv, Bv, R2, A, D, R1, A, Bv, Cv, A, Cv, D]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
    g.computeVertexNormals()
    return g
  }
  const roof = (parent, w, d, y, color, hh) => {
    const dark = shade(color, -0.16)
    add(parent, B(w, 0.28, d), dark, 0, y + 0.14, 0)
    const sk = hh * 0.28, w1 = w - d * 0.3, d1 = d * 0.7
    add(parent, frustum(w, d, w1, d1, sk), color, 0, y + 0.28, 0)
    const top = y + 0.28 + sk, rh = hh * 0.72
    add(parent, hipGeo(w1, d1, rh), color, 0, top, 0)
    const r = Math.max(0, (w1 - d1) / 2)
    if (r > 0.2) {
      add(parent, B(2 * r + 0.5, 0.32, 0.32), dark, 0, top + rh, 0)
      add(parent, B(0.32, 0.8, 0.32), dark, r + 0.15, top + rh + 0.3, 0)
      add(parent, B(0.32, 0.8, 0.32), dark, -r - 0.15, top + rh + 0.3, 0)
    } else {
      add(parent, new THREE.SphereGeometry(0.35, 8, 6), '#e8b23a', 0, top + rh + 0.1, 0)
    }
    return top + rh
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  const plaque = (parent, text, x, y, z, w) => {
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
    c.font = `${fs}px "ZCOOL XiaoWei","Songti SC",serif`
    while (c.measureText(text).width > 430 && fs > 40) {
      fs -= 6
      c.font = `${fs}px "ZCOOL XiaoWei","Songti SC",serif`
    }
    c.fillStyle = '#f6d47c'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, 256, 92)
    const tex = new THREE.CanvasTexture(cv)
    tex.anisotropy = maxAniso
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 176 / 512), new THREE.MeshBasicMaterial({ map: tex }))
    mesh.position.set(x, y, z)
    mesh.userData.noMerge = true
    parent.add(mesh)
    return mesh
  }

  /* ---------------- buildings ---------------- */
  const BMAP = {}
  const buildings = BLD.map(b => ({ ...b }))

  const lantern = (parent, x, z, y0 = 0) => {
    add(parent, C(0.07, 0.09, 2.3, 6), '#3b2a24', x, y0 + 1.15, z)
    add(parent, B(0.6, 0.08, 0.08), '#3b2a24', x, y0 + 2.25, z + 0.2)
    add(parent, new THREE.SphereGeometry(0.34, 10, 8), glowLan, x, y0 + 1.85, z + 0.42, { s: [1, 1.25, 1] })
    add(parent, C(0.2, 0.2, 0.08, 8), '#e3a92a', x, y0 + 2.27, z + 0.42)
    add(parent, C(0.2, 0.2, 0.08, 8), '#e3a92a', x, y0 + 1.43, z + 0.42)
  }

  const hall = b => {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    statics.add(g)
    const w = b.w, d = b.d, h = b.h, tiers = b.tiers || 1, th = 0.7, wall = b.wall || YAMEN
    let y = 0, topD = d
    for (let i = 0; i < tiers; i++) {
      const ext = (tiers - i) * 1.6
      const tw = w + 2 + ext, td = d + 2 + ext * 0.8
      add(g, B(tw, th, td), MARBLE, 0, y + th / 2, 0)
      add(g, B(tw + 0.1, 0.12, td + 0.1), '#e2dbcc', 0, y + th - 0.06, 0)
      y += th
      topD = td
    }
    const footD = d + 2 + tiers * 1.6 * 0.8
    const run = y * 1.7, L = Math.hypot(y, run), z0 = topD / 2
    add(g, B(3.4, 0.3, L), MARBLE, 0, y / 2, z0 + run / 2, { rx: Math.atan2(y, run) })
    add(g, B(1.4, 0.32, L), '#e8dcc0', 0, y / 2 + 0.04, z0 + run / 2, { rx: Math.atan2(y, run) })
    add(g, B(w, h, d), wall, 0, y + h / 2, 0)
    const n = Math.max(4, Math.round(w / 2.4)), cz = d / 2 + 0.7
    for (let i = 0; i < n; i++) {
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
    let top
    const hh = d * 0.45 + 1.2
    if (b.dbl) {
      add(g, B(w + 3, 0.28, d + 3), shade(b.roof, -0.16), 0, yr + 0.14, 0)
      add(g, frustum(w + 3, d + 3, w + 0.8, d + 0.8, 1.1), b.roof, 0, yr + 0.28, 0)
      const uw = w * 0.82, ud = d * 0.78
      add(g, B(uw, 1.5, ud), wall, 0, yr + 1.9, 0)
      add(g, B(uw + 1, 0.4, ud + 1), BAND, 0, yr + 2.75, 0)
      top = roof(g, uw + 2.6, ud + 2.6, yr + 2.95, b.roof, hh)
      plaque(g, b.name, 0, yr + 1.95, ud / 2 + 0.04, Math.min(3.6, uw * 0.4))
    } else {
      top = roof(g, w + 3, d + 3, yr, b.roof, hh)
      plaque(g, b.name, 0, y + h - 0.55, cz + 0.24, Math.min(3.4, w * 0.42))
    }
    const fz = footD / 2 + 0.5
    lantern(g, 2.3, fz)
    lantern(g, -2.3, fz)
    const pk = add(g, B(w + 3, top, d + 3), pickMat, 0, top / 2, 0, { keep: 1, cast: false })
    pk.userData.bid = b.id
    pickables.push(pk)
    b.foot = footD + run * 0.3
    b.top = top
    b.platY = y
    return g
  }

  const octPavilion = (b, scale = 1) => {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    statics.add(g)
    const s = scale
    add(g, C(4.2 * s, 4.5 * s, 0.7, 8), MARBLE, 0, 0.35, 0)
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.PI / 8
      add(g, C(0.18, 0.2, 3, 8), PILLAR, Math.cos(a) * 3.1 * s, 0.7 + 1.5, Math.sin(a) * 3.1 * s)
    }
    add(g, C(3.5 * s, 3.5 * s, 0.4, 8), BAND, 0, 3.9, 0)
    add(g, C(3.1 * s, 5.2 * s, 0.9, 8), b.roof || '#3a8f95', 0, 4.5, 0)
    add(g, C(0.2, 3.2 * s, 2.6 * s, 8), b.roof || '#3a8f95', 0, 4.95 + 1.3 * s, 0)
    add(g, new THREE.SphereGeometry(0.38, 8, 6), '#e3a92a', 0, 4.95 + 2.6 * s + 0.2, 0)
    if (b.name) {
      add(g, C(1.2, 1.2, 0.12, 24), '#f6efe0', 0, 1.35, 0)
      add(g, C(0.6, 0.6, 0.14, 24), '#2b2b3d', 0, 1.37, 0)
      add(g, C(0.15, 0.25, 0.6, 8), '#7f2a1f', 0, 1.0, 0)
      plaque(g, b.name, 0, 3.35, 3.0 * s, 2.6)
      lantern(g, 2.2, 5.2)
      lantern(g, -2.2, 5.2)
      const pk = add(g, C(5, 5, 8, 8), pickMat, 0, 4, 0, { keep: 1, cast: false })
      pk.userData.bid = b.id
      pickables.push(pk)
    }
    b.foot = 9
    return g
  }

  const tower = b => {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    statics.add(g)
    const st = '#bdb3a1'
    add(g, frustum(9, 9, 7.2, 7.2, 4.6), st, 0, 0, 0)
    for (let i = 0; i < 4; i++) {
      for (let j = -1; j <= 1; j++) {
        const a = i * Math.PI / 2, ox = Math.round(Math.cos(a)), oz = Math.round(Math.sin(a))
        add(g, B(1.1, 0.6, 0.5), st, ox * 3.4 + (oz ? j * 2.4 : 0) * 1, 4.9, oz * 3.4 + (ox ? j * 2.4 : 0), { ry: a })
      }
    }
    add(g, B(2.2, 2.8, 0.4), '#6e2a20', 0, 1.4, 4.35)
    const br = '#b07a35'
    add(g, C(0.15, 0.3, 1.4, 8), br, 0, 5.3, -0.8)
    const ring = (rx, rz, r) => add(g, new THREE.TorusGeometry(r, 0.09, 6, 28), br, 0, 7.0, -0.8, { rx, rz })
    ring(Math.PI / 2, 0, 1.5)
    ring(0, 0, 1.5)
    ring(Math.PI / 2, 0.5, 1.25)
    ring(0.4, 0, 1.2)
    add(g, new THREE.SphereGeometry(0.28, 10, 8), '#e3a92a', 0, 7, -0.8)
    add(g, C(0.15, 0.15, 1.6, 6), br, 2.3, 5.4, 1.6, { rz: 0.5 })
    add(g, B(1.2, 0.1, 1.2), br, 2.4, 5, 2, { rx: 0.4 })
    plaque(g, b.name, 0, 3.25, 3.97, 2.6).rotation.x = -0.19
    lantern(g, 2.2, 6)
    lantern(g, -2.2, 6)
    const pk = add(g, B(9, 8, 9), pickMat, 0, 4, 0, { keep: 1, cast: false })
    pk.userData.bid = b.id
    pickables.push(pk)
    b.foot = 9
    return g
  }

  for (const b of buildings) {
    b.w = b.w || 9
    b.d = b.d || 6
    b.h = b.h || 3
    BMAP[b.id] = b
    if (b.type === 'oct') octPavilion(b)
    else if (b.type === 'tower') tower(b)
    else hall(b)
  }

  /* throne on 太和殿 terrace */
  const tb = BMAP.taihe, ty = tb.platY, tz = tb.z + tb.d / 2 + 1.9
  add(statics, B(1.8, 0.6, 1.3), '#e3a92a', 0, ty + 0.3, tz)
  add(statics, B(2, 1.9, 0.3), '#e3a92a', 0, ty + 1.0, tz - 0.6)
  add(statics, B(1.4, 0.18, 1), '#c8402f', 0, ty + 0.66, tz + 0.05)
  add(statics, new THREE.SphereGeometry(0.22, 8, 6), '#e3a92a', 0.9, ty + 2, tz - 0.6)
  add(statics, new THREE.SphereGeometry(0.22, 8, 6), '#e3a92a', -0.9, ty + 2, tz - 0.6)
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.6, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.set(0, ty + 0.05, tz)
  scene.add(halo)
  /* sundial + bronze crane on terrace */
  add(statics, C(0.5, 0.6, 1.1, 8), MARBLE, -8.5, ty + 0.55, tz - 0.6)
  add(statics, C(0.9, 0.9, 0.1, 20), '#d8d2c2', -8.5, ty + 1.2, tz - 0.6, { rx: -0.7 })
  add(statics, C(0.03, 0.03, 1.2, 4), '#7a5a3a', -8.5, ty + 1.25, tz - 0.6, { rx: -0.7 })
  add(statics, C(0.6, 0.7, 0.5, 8), MARBLE, 8.5, ty + 0.25, tz - 0.6)
  add(statics, new THREE.SphereGeometry(0.45, 8, 6), '#3f6e5a', 8.5, ty + 1, tz - 0.6, { s: [1, 0.8, 1.4] })
  add(statics, C(0.06, 0.08, 0.9, 5), '#3f6e5a', 8.5, ty + 1.6, tz - 0.2, { rx: 0.3 })
  add(statics, new THREE.SphereGeometry(0.15, 6, 5), '#d2452f', 8.5, ty + 2.05, tz - 0.05)

  /* 午门 */
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
    for (let i = 0; i < 7; i++) add(top, C(0.18, 0.2, 2.6, 8), PILLAR, -7.2 + i * 2.4, 1.3, 2.6)
    add(top, B(16.4, 0.4, 6.2), BAND, 0, 2.8, 0)
    add(top, B(18, 0.28, 8), shade(Y, -0.16), 0, 3.14, 0)
    add(top, frustum(18, 8, 15.8, 5.8, 0.9), Y, 0, 3.28, 0)
    add(top, B(12.4, 1.2, 4.2), RED, 0, 4.6, 0)
    roof(top, 15.4, 7.2, 5.2, Y, 4.2)
    plaque(top, '午门', 0, 4.6, 2.12, 2.6)
  }

  /* palace walls, gates, corner towers */
  const wallSeg = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), hz = Math.abs(z1 - z0) > Math.abs(x1 - x0)
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
    add(statics, hz ? B(1.2, 4, len) : B(len, 4, 1.2), RED, cx, 2, cz)
    add(statics, hz ? B(1.9, 0.5, len + 0.4) : B(len + 0.4, 0.5, 1.9), '#e3a92a', cx, 4.25, cz)
    add(statics, hz ? B(1.5, 0.4, len) : B(len, 0.4, 1.5), MARBLE, cx, 0.2, cz)
  }
  wallSeg(-18, -56, 18, -56)
  for (const s of [-1, 1]) {
    wallSeg(18 * s, -56, 18 * s, -8)
    wallSeg(18 * s, -4, 18 * s, 20)
    wallSeg(18 * s, 24, 18 * s, 41)
    wallSeg(13 * s, 41.4, 18 * s, 41.4)
  }
  wallSeg(-18, -24, -3, -24)
  wallSeg(3, -24, 18, -24)

  const gate = (x, z, ry) => {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = ry
    statics.add(g)
    add(g, B(1.4, 4.8, 1.8), RED, -2.6, 2.4, 0)
    add(g, B(1.4, 4.8, 1.8), RED, 2.6, 2.4, 0)
    add(g, B(6.6, 0.9, 1.9), RED, 0, 4.4, 0)
    add(g, B(6.8, 0.35, 2.4), BAND, 0, 4.95, 0)
    roof(g, 8, 3.6, 5.1, Y, 2)
  }
  gate(0, -24, 0)
  for (const s of [-1, 1]) {
    gate(18 * s, -6, Math.PI / 2)
    gate(18 * s, 22, Math.PI / 2)
  }

  const cornerTower = (x, z) => {
    const g = new THREE.Group()
    g.position.set(x, 4.5, z)
    statics.add(g)
    add(g, B(3.4, 0.4, 3.4), MARBLE, 0, 0.2, 0)
    add(g, B(2.6, 1.8, 2.6), RED, 0, 1.3, 0)
    add(g, B(3.2, 0.35, 3.2), BAND, 0, 2.35, 0)
    roof(g, 4.6, 4.6, 2.5, Y, 2.6)
  }
  cornerTower(-18, -56)
  cornerTower(18, -56)

  /* 御花园 */
  octPavilion({ x: 0, z: -50, roof: '#3a8f95' }, 0.55)

  /* ---------------- ground ---------------- */
  const tex = (fn, size = 256) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = size
    fn(cv.getContext('2d'), size)
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = maxAniso
    return t
  }
  const grass = new THREE.Mesh(new THREE.CircleGeometry(170, 48), new THREE.MeshToonMaterial({ color: 0xa9cf87, gradientMap: gm }))
  grass.rotation.x = -Math.PI / 2
  grass.receiveShadow = true
  scene.add(grass)
  const paveT = tex((c, s) => {
    c.fillStyle = '#ead9b8'
    c.fillRect(0, 0, s, s)
    const n = 4, q = s / n
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        c.fillStyle = `rgba(${200 + ((i * 7 + j * 3) % 5) * 6},${180 + ((i + j * 5) % 4) * 7},${140 + ((i * 3 + j) % 3) * 8},.35)`
        c.fillRect(i * q + 1, j * q + 1, q - 2, q - 2)
      }
    }
    c.strokeStyle = 'rgba(160,130,95,.45)'
    c.lineWidth = 2
    for (let i = 0; i <= n; i++) {
      c.beginPath()
      c.moveTo(i * q, 0)
      c.lineTo(i * q, s)
      c.stroke()
      c.beginPath()
      c.moveTo(0, i * q)
      c.lineTo(s, i * q)
      c.stroke()
    }
  })
  paveT.repeat.set(36 / 4, 98 / 4)
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(36, 98), new THREE.MeshToonMaterial({ color: 0xffffff, map: paveT, gradientMap: gm }))
  pave.rotation.x = -Math.PI / 2
  pave.position.set(0, 0.03, -7)
  pave.receiveShadow = true
  scene.add(pave)

  const flat = (w, d, x, z, c = ROAD, y = 0.05) => {
    const m = new THREE.Mesh(B(w, y * 2, d), mat(c))
    m.position.set(x, y, z)
    m.receiveShadow = true
    flats.add(m)
  }
  flat(3.2, 46, 0, 19, '#f5efe2', 0.07)
  flat(28, 18, 0, 52, ROAD)
  for (const s of [-1, 1]) {
    flat(3.2, 100, 21 * s, -8)
    for (const b of buildings.filter(b => b.x * s > 15)) flat(b.w + 6, b.foot + 9, b.x, b.z + 3)
    for (const z of [-6, 22]) flat(6, 3.2, 18 * s, z)
  }
  for (const b of buildings.filter(b => Math.abs(b.x) > 15)) {
    const hz = b.z + b.foot / 2 + 3.2 + 3
    flat(Math.abs(b.x) - 19 + 5, 3, (Math.abs(b.x) - 19 + 5) / 2 * Math.sign(b.x) + 19 * Math.sign(b.x), hz)
  }

  /* 金水河 + bridges */
  {
    const f = x => 31.5 - x * x / 70
    const pts = []
    for (let x = -18; x <= 18; x += 1) pts.push(x)
    const riverRibbon = (wd, y, c) => {
      const arr = []
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]
        const n = x => {
          const dz = -2 * x / 70
          const l = Math.hypot(1, dz)
          return [-dz / l, 1 / l]
        }
        const [nax, naz] = n(a), [nbx, nbz] = n(b)
        const A1 = [a + nax * wd, y, f(a) + naz * wd], A2 = [a - nax * wd, y, f(a) - naz * wd]
        const B1 = [b + nbx * wd, y, f(b) + nbz * wd], B2 = [b - nbx * wd, y, f(b) - nbz * wd]
        arr.push(...A1, ...A2, ...B1, ...B1, ...A2, ...B2)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      g.computeVertexNormals()
      if (g.attributes.normal.getY(0) < 0) {
        const nn = g.attributes.normal
        for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0)
      }
      const m = new THREE.Mesh(g, c.isMaterial ? c : new THREE.MeshToonMaterial({ color: c, gradientMap: gm, side: THREE.DoubleSide }))
      m.receiveShadow = true
      scene.add(m)
      return m
    }
    riverRibbon(1.9, 0.08, '#f3efe6')
    riverRibbon(1.45, 0.1, new THREE.MeshToonMaterial({ color: 0x7cc3d8, gradientMap: gm, emissive: 0x2a6d86, emissiveIntensity: 0.15, side: THREE.DoubleSide }))
    for (const x of [-8, -4, 0, 4, 8]) {
      const z = f(x), ry = Math.atan(-2 * x / 70)
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = -ry
      statics.add(g)
      add(g, B(2.4, 0.35, 4.6), MARBLE, 0, 0.3, 0)
      add(g, B(2.4, 0.3, 2.4), MARBLE, 0, 0.55, 0)
      add(g, B(0.16, 0.45, 4.4), '#ece6d8', 1.15, 0.8, 0)
      add(g, B(0.16, 0.45, 4.4), '#ece6d8', -1.15, 0.8, 0)
    }
  }

  /* lanterns along 御道 */
  for (const z of [3, 9, 15]) for (const s of [-1, 1]) lantern(statics, 2.9 * s, z)
  for (const x of [-9, 9]) lantern(statics, x, 48.5)

  /* trees (autumn) */
  let seed = 7
  const rnd = () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  const lowIco = r => {
    const g = new THREE.IcosahedronGeometry(r, 0)
    g.computeVertexNormals()
    return g
  }
  const tree = (x, z, s, ci) => {
    const c = CROWNS[ci ?? Math.floor(rnd() * CROWNS.length)]
    add(statics, C(0.18 * s, 0.28 * s, 1.6 * s, 6), '#8a5a3a', x, 0.8 * s, z)
    add(statics, lowIco(1.4 * s), c, x, 2.4 * s, z)
    add(statics, lowIco(0.95 * s), shade(c, 0.06), x + 0.6 * s, 3.1 * s, z - 0.3 * s)
  }
  let placed = 0, guard = 0
  while (placed < 95 && guard < 4000) {
    guard++
    const a = rnd() * Math.PI * 2, r = 58 + rnd() * 70
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 4
    if (Math.abs(x) < 55 && z > -62 && z < 60) continue
    tree(x, z, 0.9 + rnd() * 0.7)
    placed++
  }
  for (let z = -50; z <= 40; z += 9) {
    tree(54 + rnd() * 2, z, 1 + rnd() * 0.4)
    tree(-54 - rnd() * 2, z, 1 + rnd() * 0.4)
  }
  for (let x = -50; x <= 50; x += 8) {
    if (Math.abs(x) < 17) continue
    tree(x, -62 - rnd() * 2, 1 + rnd() * 0.4)
    tree(x, 58 + rnd() * 3, 1 + rnd() * 0.4)
  }
  for (const [x, z, ci] of [[-12, -49, 3], [12, -49, 4], [-8, -53, 0], [8, -53, 1], [-14, -53, 7], [14, -53, 2], [-12, -30, 3], [12, -30, 4]]) tree(x, z, 0.9, ci)
  for (const b of buildings.filter(b => Math.abs(b.x) > 15)) tree(b.x + (b.x > 0 ? 1 : -1) * (b.w / 2 + 2.6), b.z - 1.5, 0.8)
  for (let i = 0; i < 6; i++) add(statics, lowIco(0.5 + rnd() * 0.7), '#9a9a8e', -6 + rnd() * 3 - 1.5, 0.4, -50 + rnd() * 3 - 1.5)
  for (let i = 0; i < 6; i++) {
    const x = -34 + (i % 3) * 4, z = -53 + Math.floor(i / 3) * 2.5
    add(statics, B(3, 0.35, 1.6), '#7a5a3a', x, 0.17, z)
    add(statics, B(2.6, 0.4, 1.2), i % 2 ? '#9d7cc9' : '#6fb35f', x, 0.45, z, { cast: false })
  }

  /* ---------------- statics merge ---------------- */
  const merge = (group, castShadow) => {
    group.updateMatrixWorld(true)
    const buckets = new Map()
    const keep = []
    const sources = []
    group.traverse(o => {
      if (!o.isMesh) return
      if (o.userData.noMerge) {
        keep.push(o)
        return
      }
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      g.applyMatrix4(o.matrixWorld)
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
      if (!buckets.has(o.material.uuid)) buckets.set(o.material.uuid, { m: o.material, gs: [] })
      buckets.get(o.material.uuid).gs.push(g)
      sources.push(o.geometry)
    })
    keep.forEach(o => scene.attach(o))
    scene.remove(group)
    for (const { m, gs } of buckets.values()) {
      const geo = mergeBufferGeometries(gs)
      const mesh = new THREE.Mesh(geo, m)
      mesh.castShadow = castShadow
      mesh.receiveShadow = true
      scene.add(mesh)
      for (const g of gs) g.dispose()
    }
    for (const g of sources) g.dispose()
  }
  merge(statics, true)
  merge(flats, false)

  /* clouds */
  const clouds = []
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gm, emissive: 0xffffff, emissiveIntensity: 0.25 })
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group()
    const n = 3 + Math.floor(rnd() * 3)
    for (let j = 0; j < n; j++) {
      const s = 2.4 + rnd() * 2.4
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), cloudMat)
      m.position.set(j * 3.2 - n * 1.6, rnd() * 1.2, rnd() * 2)
      m.scale.y = 0.75
      g.add(m)
    }
    const a = rnd() * Math.PI * 2, r = 120 + rnd() * 50
    g.position.set(Math.cos(a) * r, 26 + rnd() * 18, Math.sin(a) * r - 20)
    g.userData.v = 1.2 + rnd() * 1.6
    scene.add(g)
    clouds.push(g)
  }

  /* selection marker */
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.7, 4),
    new THREE.MeshToonMaterial({ color: 0xd2452f, gradientMap: gm, emissive: 0xd2452f, emissiveIntensity: 0.3 }),
  )
  marker.rotation.x = Math.PI
  marker.visible = false
  scene.add(marker)

  /* ---------------- sky ---------------- */
  const sky = h => {
    const day = sm(5.6, 7.2, h) * (1 - sm(17.2, 18.9, h))
    const dusk = Math.max(Math.exp(-((h - 6.4) ** 2) / 0.5), Math.exp(-((h - 17.9) ** 2) / 0.5))
    const top = cl('#18213f', '#7fc3ea', day).lerp(new THREE.Color('#f0a98a'), dusk * 0.55)
    const bot = cl('#33406e', '#eaf5f1', day).lerp(new THREE.Color('#fcd9ae'), dusk * 0.7)
    container.style.background = `linear-gradient(#${top.getHexString()},#${bot.getHexString()})`
    scene.fog.color.copy(bot)
    sun.intensity = 0.16 + 0.42 * day
    sun.color.copy(cl('#8ea4e0', '#ffffff', day).lerp(new THREE.Color('#ffb27a'), dusk * 0.6))
    hemi.intensity = 0.3 + 0.2 * day
    hemi.color.copy(cl('#6d7bb3', '#dff2ff', day))
    const a = Math.min(1, Math.max(0, (h - 6) / 12)) * Math.PI
    if (day > 0.05) sun.position.set(Math.cos(a) * 70, 32 + 50 * Math.sin(a), 50)
    else sun.position.set(-30, 80, 40)
    const nt = 1 - day
    glowWin.emissiveIntensity = 0.12 + 0.9 * nt
    glowLan.emissiveIntensity = 0.25 + 1.1 * nt
    cloudMat.emissiveIntensity = 0.25 - 0.15 * nt
  }

  /* ---------------- figures ---------------- */
  // A cinnabar seal for the pending state, shared by every figure.
  const sealTexture = () => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const c = cv.getContext('2d')
    c.fillStyle = '#d2452f'
    c.fillRect(6, 6, 52, 52)
    c.strokeStyle = 'rgba(255,240,210,.75)'
    c.lineWidth = 3
    c.strokeRect(13, 13, 38, 38)
    const t = new THREE.CanvasTexture(cv)
    t.anisotropy = maxAniso
    return t
  }
  const SEAL = sealTexture()

  let cast = []
  let selectedId = null
  let courtOn = false
  let fly = null
  let tick = 0
  let minutes = 12 * 60
  const tmp = new THREE.Vector3()
  const clock = new THREE.Clock()
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // 编外: no bureau, so a free spot on the 午门 plaza, spread out.
  const spareSpot = index => new THREE.Vector3(-11 + (index % 10) * 2.4, 0, 50.5 + Math.floor(index / 10) * 2.6)
  const homeOf = (person, index) => {
    const b = BMAP[person.building]
    if (!b) return spareSpot(index)
    return new THREE.Vector3(b.x + person.offset, 0, b.z + b.foot / 2 + 3.2)
  }

  const ownMaterial = color => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: gm })
    m.userData.own = true
    return m
  }

  const makeFig = person => {
    const g = new THREE.Group()
    g.position.copy(person.home)
    g.scale.setScalar(1.08)
    scene.add(g)
    const body = new THREE.Group()
    g.add(body)
    const robe = ownMaterial(person.robe)
    const robeShade = ownMaterial(shade(person.robe, 0.1))
    const pick = o => {
      o.userData.mid = person.id
      person.picks.push(o)
      return o
    }
    pick(add(body, C(0.48, 0.9, 1.35, 14), robe, 0, 0.675, 0))
    add(body, C(0.53, 0.53, 0.14, 14), '#e3a92a', 0, 0.98, 0)
    add(body, B(0.5, 0.42, 0.06), '#f3d27a', 0, 0.66, 0.66, { rx: -0.31 })
    add(body, B(0.3, 0.24, 0.07), robeShade, 0, 0.66, 0.69, { rx: -0.31 })
    const armL = add(body, new THREE.SphereGeometry(0.3, 10, 8), robe, -0.62, 0.95, 0.08, { s: [0.9, 1.25, 0.9] })
    const armR = add(body, new THREE.SphereGeometry(0.3, 10, 8), robe, 0.62, 0.95, 0.08, { s: [0.9, 1.25, 0.9] })
    const head = new THREE.Group()
    head.position.y = 1.38
    body.add(head)
    pick(add(head, new THREE.SphereGeometry(0.62, 20, 16), SKIN, 0, 0.45, 0))
    for (const s of [-1, 1]) {
      add(head, new THREE.SphereGeometry(0.075, 8, 6), INK, s * 0.21, 0.5, 0.55)
      add(head, new THREE.SphereGeometry(0.12, 8, 6), '#f4a3a0', s * 0.36, 0.33, 0.47, { s: [1, 0.55, 0.5], cast: false })
    }
    add(head, B(0.14, 0.035, 0.03), '#b5524a', 0, 0.3, 0.6)
    if (person.hat === 'nei') {
      add(head, C(0.4, 0.58, 0.62, 18), '#2c3550', 0, 1.02, 0)
      add(head, B(0.26, 0.2, 0.05), '#e3a92a', 0, 0.98, 0.5)
    } else if (person.hat === 'jyw') {
      add(head, C(0.9, 0.9, 0.06, 20), HAT_INK, 0, 0.84, 0)
      add(head, C(0.36, 0.46, 0.46, 16), HAT_INK, 0, 1.08, 0)
      add(head, new THREE.SphereGeometry(0.13, 8, 6), '#d2452f', 0, 1.35, 0)
    } else if (person.hat === 'fj') {
      add(head, B(0.82, 0.5, 0.82), '#33405a', 0, 1.0, -0.02, { ry: Math.PI / 4, s: [1, 1, 0.8] })
      for (const s of [-1, 1]) add(head, B(0.08, 0.55, 0.04), '#33405a', s * 0.18, 0.75, -0.62, { rz: s * 0.15 })
    } else if (person.hat === 'dao') {
      add(head, new THREE.SphereGeometry(0.4, 14, 10), HAT_INK, 0, 0.82, -0.1, { s: [1.05, 0.7, 1.05] })
      add(head, new THREE.SphereGeometry(0.22, 10, 8), HAT_INK, 0, 1.18, -0.05)
      add(head, C(0.03, 0.03, 0.8, 5), '#e3a92a', 0, 1.2, -0.05, { rz: Math.PI / 2 })
    } else {
      add(head, C(0.5, 0.54, 0.42, 18), HAT_INK, 0, 0.98, -0.02)
      add(head, new THREE.SphereGeometry(0.3, 10, 8), HAT_INK, 0, 1.12, -0.2)
      for (const s of [-1, 1]) add(head, B(0.95, 0.06, 0.22), HAT_INK, s * 0.82, 1.0, -0.24, { ry: s * 0.08 })
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false })
    ringMat.userData.own = true
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 32), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.09
    g.add(ring)
    const seal = new THREE.Sprite(new THREE.SpriteMaterial({ map: SEAL, transparent: true, depthWrite: false, rotation: -0.12 }))
    seal.scale.set(0.55, 0.55, 1)
    seal.position.set(0, 2.9, 0)
    seal.visible = false
    seal.material.userData.own = true
    g.add(seal)
    person.g = g
    person.body = body
    person.head = head
    person.armL = armL
    person.armR = armR
    person.ring = ring
    person.ringMat = ringMat
    person.seal = seal
  }

  const makeDesk = person => {
    const d = new THREE.Group()
    d.position.set(person.home.x, 0, person.home.z + 1.35)
    scene.add(d)
    add(d, B(1.7, 0.12, 0.85), '#8b5a3c', 0, 0.82, 0)
    for (const sx of [-0.7, 0.7]) for (const sz of [-0.3, 0.3]) add(d, B(0.1, 0.78, 0.1), '#6b432c', sx, 0.39, sz)
    add(d, B(0.75, 0.03, 0.5), '#fbf6e8', -0.15, 0.9, 0)
    add(d, B(0.3, 0.08, 0.22), '#2b2b2b', 0.5, 0.92, 0)
    add(d, C(0.04, 0.04, 0.5, 5), '#5a3a2a', 0.25, 0.95, -0.05, { rz: 1.3 })
    person.desk = d
  }

  const makeTag = person => {
    const el = document.createElement('div')
    el.className = 'tag'
    el.title = person.title
    Object.assign(el.style, {
      position: 'absolute', left: '0', top: '0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '3px', pointerEvents: 'auto', cursor: 'pointer', willChange: 'transform',
    })
    const bub = document.createElement('div')
    bub.className = 'bub'
    Object.assign(bub.style, {
      background: '#fff',
      color: '#3b2a24',
      fontSize: '12px',
      lineHeight: '1.3',
      padding: '3px 8px',
      borderRadius: '8px',
      whiteSpace: 'nowrap',
      boxShadow: '0 3px 10px rgba(59,42,36,.18)',
      position: 'relative',
      display: 'none',
    })
    const text = document.createElement('span')
    const tail = document.createElement('i')
    Object.assign(tail.style, {
      position: 'absolute',
      left: '50%',
      bottom: '-4px',
      width: '8px',
      height: '8px',
      background: 'inherit',
      transform: 'translateX(-50%) rotate(45deg)',
      borderRadius: '0',
    })
    bub.append(text, tail)
    const nm = document.createElement('div')
    nm.className = 'nm'
    Object.assign(nm.style, {
      fontSize: '11px',
      background: 'rgba(59,42,36,.78)',
      color: '#fff8ec',
      padding: '1px 8px 1px 6px',
      borderRadius: '999px',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    })
    const dot = document.createElement('i')
    Object.assign(dot.style, { width: '7px', height: '7px', borderRadius: '50%', background: RING.idle, display: 'block' })
    const name = document.createElement('span')
    name.textContent = person.name
    nm.append(dot, name)
    el.append(bub, nm)
    el.addEventListener('click', event => {
      event.stopPropagation()
      select(person.id)
      flyTo(person.id)
      onOpen?.(person.id)
    })
    tags.appendChild(el)
    person.el = el
    person.bub = bub
    person.text = text
    person.nm = nm
    person.dot = dot
  }

  const markTag = (person, on) => {
    person.el.classList.toggle('sel', on)
    person.nm.style.background = on ? '#d2452f' : 'rgba(59,42,36,.78)'
  }

  const person = id => cast.find(p => p.id === id) || null

  const normalize = (raw, index) => {
    const p = {
      id: String(raw.id),
      name: String(raw.name ?? ''),
      title: String(raw.title ?? ''),
      dept: String(raw.dept ?? ''),
      building: String(raw.building ?? ''),
      offset: Number(raw.offset) || 0,
      robe: raw.robe || YAMEN,
      hat: HATS.includes(raw.hat) ? raw.hat : 'wusha',
      side: raw.side === 'W' ? 'W' : 'E',
      live: { kind: raw.state?.kind || 'idle', text: String(raw.state?.text ?? '') },
      picks: [],
      home: null,
      slot: null,
      zone: 'C',
      g: null,
      body: null,
      head: null,
      armL: null,
      armR: null,
      ring: null,
      ringMat: null,
      seal: null,
      desk: null,
      el: null,
      bub: null,
      text: null,
      nm: null,
      dot: null,
      key: '',
      path: [],
      mode: 'home',
      rot: 0,
      phase: rnd() * 6,
      wt: rnd() * 3,
      wander: null,
      delay: 0,
    }
    p.home = homeOf(p, index)
    return p
  }

  const assignSlots = () => {
    const next = { E: 0, W: 0 }
    for (const p of cast) {
      const side = p.side === 'W' ? 'W' : 'E'
      const index = next[side]++
      const sign = side === 'E' ? 1 : -1
      p.slot = new THREE.Vector3(sign * (4.6 + (index % 2) * 3.6), 0, 4.2 + Math.floor(index / 2) * 3.4)
      const b = BMAP[p.building]
      p.zone = !b || Math.abs(b.x) < 15 ? 'C' : (b.x > 0 ? 'E' : 'W')
    }
  }

  const dropGroup = group => {
    if (!group) return
    scene.remove(group)
    group.traverse(o => {
      // Every Sprite shares one geometry owned by three; only meshes own theirs.
      if (o.geometry && !o.isSprite) o.geometry.dispose()
      const m = o.material
      if (m && m.userData.own) m.dispose()
    })
  }

  const dropCast = () => {
    for (const p of cast) {
      if (p.el) p.el.remove()
      dropGroup(p.g)
      dropGroup(p.desk)
    }
    cast = []
  }

  const setPeople = list => {
    dropCast()
    const rows = Array.isArray(list) ? list : []
    cast = rows.map((raw, index) => {
      const p = normalize(raw, index)
      makeDesk(p)
      makeFig(p)
      makeTag(p)
      return p
    })
    assignSlots()
    if (courtOn) {
      for (const p of cast) {
        p.mode = 'court'
        p.g.position.copy(p.slot)
      }
    }
    select(selectedId)
  }

  const setPersonState = (id, live) => {
    const p = person(id)
    if (!p) return
    p.live = { kind: live?.kind || 'idle', text: String(live?.text ?? '') }
    p.key = ''
  }

  const select = id => {
    const p = person(id)
    selectedId = p ? p.id : null
    for (const other of cast) markTag(other, other === p)
    if (!p) marker.visible = false
  }

  const glide = (target, position, dur = 1.1) => {
    fly = { t: 0, dur, ft: controls.target.clone(), tt: target, fc: camera.position.clone(), tc: position }
  }

  const flyTo = id => {
    const p = person(id)
    if (!p) return
    const tgt = p.g.position.clone().add(new THREE.Vector3(0, 1.5, 0))
    const dir = camera.position.clone().sub(controls.target).normalize()
    if (dir.y < 0.5) {
      dir.y = 0.5
      dir.normalize()
    }
    glide(tgt, tgt.clone().add(dir.multiplyScalar(narrow ? 34 : 28)))
  }

  const onControlsStart = () => {
    fly = null
  }
  controls.addEventListener('start', onControlsStart)

  const V = (x, z) => new THREE.Vector3(x, 0, z)
  const route = p => {
    const h = p.home, s = p.slot, P = []
    if (p.zone === 'C') {
      const sx = Math.sign(s.x)
      P.push(V(-1, h.z), V(-1, -21.5), V(16 * sx, -21.5), V(16 * sx, 1), V(s.x, s.z))
    } else {
      const sx = p.zone === 'E' ? 1 : -1, lz = h.z + 3, gz = h.z < 8 ? -6 : 22
      P.push(V(h.x + 1.4, h.z), V(h.x + 1.4, lz), V(21 * sx, lz), V(21 * sx, gz), V(15 * sx, gz))
      if (gz === -6) P.push(V(15 * sx, 1))
      P.push(V(s.x, s.z))
    }
    return P
  }

  const setCourt = on => {
    const next = Boolean(on)
    if (next === courtOn) return
    courtOn = next
    if (courtOn) {
      cast.forEach((p, i) => {
        p.path = route(p)
        p.mode = 'toCourt'
        p.delay = 0.1 * i + rnd() * 0.3
      })
      glide(new THREE.Vector3(0, 1, 9), new THREE.Vector3(0, narrow ? 44 : 34, narrow ? -30 : -24), 1.8)
    } else {
      cast.forEach((p, i) => {
        p.path = route(p).reverse().slice(1)
        p.path.push(p.home.clone())
        p.mode = 'toHome'
        p.delay = 0.08 * i + rnd() * 0.3
      })
      glide(new THREE.Vector3(0, 0, -4), new THREE.Vector3(narrow ? 62 : 74, narrow ? 100 : 72, narrow ? 118 : 100), 1.8)
    }
  }

  const setTime = value => {
    const m = Number(value)
    minutes = ((Number.isFinite(m) ? m : 0) % 1440 + 1440) % 1440
    sky(minutes / 60)
  }

  /* ---------------- picking ---------------- */
  const ray = new THREE.Raycaster()
  const pv = new THREE.Vector2()
  let down = null
  const onDown = e => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() }
  }
  const onUp = e => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    const held = performance.now() - down.t
    down = null
    if (moved > 7 || held > 500) return
    const rect = canvas.getBoundingClientRect()
    pv.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(pv, camera)
    const targets = pickables.concat(...cast.map(p => p.picks))
    const hit = ray.intersectObjects(targets, false)[0]
    if (!hit) {
      select(null)
      onSelect?.(null)
      return
    }
    const personId = hit.object.userData.mid
    if (personId) {
      select(personId)
      flyTo(personId)
      onSelect?.(personId)
      return
    }
    const owner = cast.find(p => p.building === hit.object.userData.bid)
    if (!owner) return
    select(owner.id)
    flyTo(owner.id)
    onSelect?.(owner.id)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)

  /* ---------------- resize ---------------- */
  const resize = () => {
    if (dead) return
    const { w, h } = measure()
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  /* ---------------- per-frame ---------------- */
  const kindOf = p => p.mode === 'court' ? 'court' : p.mode === 'toCourt' ? 'walk' : p.mode === 'toHome' ? 'back' : p.live.kind
  const angLerp = (a, b, k) => {
    const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    return a + d * k
  }

  const updateBubble = (p, kind, far, rc) => {
    p.dot.style.background = rc
    const text = p.live.text
    const loud = kind === 'alert' || kind === 'error'
    if (!text || (far && !loud)) {
      p.bub.style.display = 'none'
      return
    }
    p.bub.style.display = ''
    p.bub.className = loud ? 'bub alert' : kind === 'sleep' ? 'bub zz' : 'bub'
    p.bub.style.background = loud ? '#d2452f' : kind === 'sleep' ? '#1f2a4a' : '#fff'
    p.bub.style.color = loud ? '#fff' : kind === 'sleep' ? '#dfe6ff' : '#3b2a24'
    p.text.textContent = clip(text)
  }

  const frame = () => {
    const dt = Math.min(0.05, clock.getDelta())
    tick += dt
    if (fly) {
      fly.t += dt
      const k = Math.min(1, fly.t / fly.dur)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      controls.target.lerpVectors(fly.ft, fly.tt, e)
      camera.position.lerpVectors(fly.fc, fly.tc, e)
      if (k >= 1) fly = null
    }
    controls.target.x = Math.max(-70, Math.min(70, controls.target.x))
    controls.target.z = Math.max(-75, Math.min(70, controls.target.z))
    controls.target.y = Math.max(0, Math.min(12, controls.target.y))
    controls.update()
    halo.material.opacity += ((courtOn ? 0.75 : 0) - halo.material.opacity) * Math.min(1, dt * 3)
    halo.rotation.z += dt * 0.4
    for (const c of clouds) {
      c.position.x += c.userData.v * dt
      if (c.position.x > 170) c.position.x = -170
    }
    const camDist = camera.position.distanceTo(controls.target)
    const box = canvas.getBoundingClientRect()
    for (const p of cast) {
      const kind = kindOf(p)
      let tgt = null, spd = 0
      if (p.path.length) {
        if (p.delay > 0) p.delay -= dt
        else {
          tgt = p.path[0]
          spd = 8
        }
      } else if (p.mode === 'home') {
        if (kind === 'idle') {
          p.wt -= dt
          if (!p.wander || p.wt <= 0) {
            const a = rnd() * Math.PI * 2, r = 0.8 + rnd() * 1.6
            p.wander = p.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, -Math.abs(Math.sin(a)) * r * 0.8))
            p.wt = 3 + rnd() * 4
          }
          tgt = p.wander
          spd = 1.3
        } else {
          tgt = p.home
          spd = 2
        }
      }
      let moving = false
      if (tgt) {
        tmp.subVectors(tgt, p.g.position)
        tmp.y = 0
        const dl = tmp.length()
        if (dl > 0.05) {
          const step = Math.min(dl, spd * dt)
          p.g.position.addScaledVector(tmp.normalize(), step)
          moving = spd > 3 || dl > 0.3
          p.rot = angLerp(p.rot, Math.atan2(tmp.x, tmp.z), Math.min(1, dt * 10))
        } else if (p.path.length) {
          p.path.shift()
          if (!p.path.length) p.mode = p.mode === 'toCourt' ? 'court' : 'home'
        }
      }
      if (!moving) {
        let face = null
        if (p.mode === 'court') face = Math.PI
        else if (kind === 'work' || kind === 'alert' || kind === 'error' || kind === 'sleep' || kind === 'waiting' || kind === 'done' || kind === 'pending') face = 0
        if (face !== null) p.rot = angLerp(p.rot, face, Math.min(1, dt * 5))
      }
      p.g.rotation.y = p.rot
      const t2 = tick + p.phase, run = moving && spd > 3
      let by = 0, hx = 0, hz = 0, rz = 0, arz = 0.08
      if (moving && !reduce) {
        by = Math.abs(Math.sin(t2 * (run ? 12 : 7))) * (run ? 0.16 : 0.08)
        rz = Math.sin(t2 * (run ? 12 : 7)) * 0.06
      } else if (kind === 'work') {
        hx = 0.22 + Math.sin(t2 * 2.5) * 0.05
        arz = 0.35 + Math.sin(t2 * 9) * 0.08
      } else if (kind === 'alert' || kind === 'error') {
        by = reduce ? 0 : Math.abs(Math.sin(t2 * 7)) * 0.22
        hz = Math.sin(t2 * 7) * 0.1
      } else if (kind === 'sleep') {
        hx = 0.38
        hz = 0.18
        p.body.scale.y = 1 + Math.sin(t2 * 1.4) * 0.025
      } else if (kind === 'court') {
        hx = 0.12
      } else {
        hz = Math.sin(t2 * 1.1) * 0.07
      }
      if (kind !== 'sleep') p.body.scale.y = 1
      p.body.position.y = by
      p.body.rotation.z = rz
      p.head.rotation.x += (hx - p.head.rotation.x) * Math.min(1, dt * 6)
      p.head.rotation.z += (hz - p.head.rotation.z) * Math.min(1, dt * 6)
      p.armR.position.z = arz
      p.armR.position.y = 0.95 + (kind === 'work' && !moving ? Math.sin(t2 * 9) * 0.05 : 0)
      if (moving) {
        p.armR.position.z = 0.08 + Math.sin(t2 * 12) * 0.18
        p.armL.position.z = 0.08 - Math.sin(t2 * 12) * 0.18
      } else {
        p.armL.position.z = 0.08
      }
      const rc = RING[kind] || RING.idle
      const loud = kind === 'alert' || kind === 'error'
      p.ringMat.color.set(rc)
      p.ringMat.opacity = loud ? 0.55 + Math.sin(tick * 6) * 0.35
        : kind === 'work' ? 0.85
          : kind === 'court' || kind === 'walk' || kind === 'back' ? 0.6 : 0.35
      p.ring.scale.setScalar(loud ? 1 + Math.sin(tick * 6) * 0.12 : 1)
      p.seal.visible = kind === 'pending'
      if (p.seal.visible) {
        p.seal.position.y = 2.9 + Math.sin(tick * 2.2 + p.phase) * 0.08
        p.seal.material.rotation = -0.12 + Math.sin(tick * 1.1 + p.phase) * 0.08
      }
      /* label */
      tmp.copy(p.g.position)
      tmp.y += 3.55
      tmp.project(camera)
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.2 || Math.abs(tmp.y) > 1.2) {
        p.el.style.display = 'none'
      } else {
        p.el.style.display = ''
        const x = (tmp.x * 0.5 + 0.5) * box.width
        const y = (-tmp.y * 0.5 + 0.5) * box.height
        p.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`
        p.el.style.zIndex = String(1000 - Math.round(p.g.position.distanceTo(camera.position)))
        const far = camDist > 150
        p.el.classList.toggle('far', far && !loud)
        const key = [kind, far ? 1 : 0, p.live.text].join('\u0000')
        if (key !== p.key) {
          p.key = key
          updateBubble(p, kind, far, rc)
        }
      }
    }
    const chosen = person(selectedId)
    if (chosen) {
      marker.visible = true
      marker.position.set(chosen.g.position.x, 4.3 + Math.sin(tick * 3) * 0.2, chosen.g.position.z)
      marker.rotation.y += dt * 2
    } else {
      marker.visible = false
    }
    renderer.render(scene, camera)
  }

  const loop = () => {
    if (!running) return
    raf = requestAnimationFrame(loop)
    frame()
  }
  const start = () => {
    if (running || dead) return
    running = true
    clock.getDelta()
    loop()
  }
  const stop = () => {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  const dispose = () => {
    if (dead) return
    stop()
    dead = true
    resizeObserver.disconnect()
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointerup', onUp)
    controls.removeEventListener('start', onControlsStart)
    controls.dispose()
    dropCast()
    const geometries = new Set()
    const materials = new Set()
    const textures = new Set()
    scene.traverse(o => {
      if (o.geometry && !o.isSprite) geometries.add(o.geometry)
      const material = o.material
      if (!material) return
      for (const m of Array.isArray(material) ? material : [material]) {
        materials.add(m)
        for (const key of ['map', 'gradientMap', 'alphaMap', 'emissiveMap']) if (m[key]) textures.add(m[key])
      }
    })
    for (const t of textures) t.dispose()
    for (const m of materials) m.dispose()
    for (const g of geometries) g.dispose()
    SEAL.dispose()
    scene.clear()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
    container.style.background = containerBackground
    container.style.position = containerPosition
  }

  setTime(minutes)

  return {
    setPeople,
    setPersonState,
    setTime,
    setCourt,
    select,
    flyTo,
    start,
    stop,
    resize,
    dispose,
    isRunning: () => running,
  }
}
