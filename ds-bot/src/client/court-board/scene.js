// The 值房图: the whole Forbidden City as a toy model, every official at the door of his
// own 衙门 inside one wall. What each of them is doing shows on him and around him: a
// ring of colour at his feet, his head bent over the desk while he works, a hop when he
// waits on the Emperor, a walk to the 太和殿 square when he is called to a meeting. Some
// 衙门 show their own trade: the armillary on the 钦天监's tower turns, an easel stands
// out before the 翰林院, the abacus on the 内承运库's desk clicks, the 锦衣卫 walks the
// wall. When one official hands work to another a little eunuch runs the memorial over.
//
// The module owns the canvas, the sky behind it and the floating tags; the title bar,
// the card, the feed and the roster are the React shell's. One factory call builds the
// world; the returned object drives it and tears it down.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SEALS } from './data.js'
import { BUILDING, BUILDINGS, PATROL, SPARES, WALL_TOP, courtSlot, footOf, homeOf, walkPath } from './layout.js'
import { buildPalace, createMaterials, shade } from './palace.js'
import { plaqueOf, plaquesFor } from './plaques.js'
import { createRenderKit } from './render.js'

// r128 passed colours through untouched, with no colour management and a linear output.
// Current three does both by default, so both are switched back off to keep every tone.
THREE.ColorManagement.enabled = false

// r128's toon shader did not divide light colours by PI the way current three does, so
// both lights take PI times the old intensity to keep the same brightness.
const LIGHT_GAIN = Math.PI

export const CEREMONY_MS = 5200
const WALK = 7
const RUN = 9
const SKIN = '#fbe2c8'
const INK = '#2b211d'
const HAT = '#22201f'

// The ring at an official's feet, by what he is doing.
const RING = {
  work: '#e3a92a', pending: '#d9a21b', question: '#3f8fae', done: '#c8402f', court: '#d2452f',
  waiting: '#7a8bb5', idle: '#c9bba8', sleep: '#5b6aa8',
}

// The 南书房's own man: not a Bot, so he keeps his own hours — he reads the officials'
// memorials every evening at twenty past nine.
const CLAUDE = { id: '__nanshufang', name: 'Claude', office: '南书房行走', robe: '#d97757', hat: 'fj', cap: '#3b2a24', building: 'nanshufang', side: 'W' }

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mixColour = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)
const angLerp = (a, b, k) => {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return a + d * k
}
const prefersStill = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function createCourtScene({ container, tags, onSelect, onOpen, words = {}, rendererFactory = options => new THREE.WebGLRenderer(options) }) {
  const still = prefersStill()
  const renderer = rendererFactory({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.position = 'relative'
  canvas.style.touchAction = 'none'
  canvas.style.outline = 'none'
  const containerBackground = container.style.background
  container.appendChild(canvas)
  const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 4

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xe9f4f2, 170, 380)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 800)
  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0, -14)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = 1.32
  controls.minDistance = 12
  controls.maxDistance = 260
  controls.screenSpacePanning = false
  controls.rotateSpeed = 0.6

  const hemi = new THREE.HemisphereLight(0xdff2ff, 0xb9a782, 0.6 * LIGHT_GAIN)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 0.9 * LIGHT_GAIN)
  sun.position.set(40, 80, 50)
  sun.target.position.set(0, 0, -12)
  scene.add(sun, sun.target)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 360 })
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.03

  const kit = createMaterials()
  const { mat } = kit
  const owned = []
  const keep = (thing) => { owned.push(thing); return thing }

  let palace = null
  let render = null
  let glow = true
  let lastHour = 12
  const people = new Map()
  const runners = []
  const tagLayer = tags ?? document.createElement('div')
  const proclaim = document.createElement('div')
  proclaim.className = 'cb-proclaim'
  proclaim.hidden = true
  tagLayer.appendChild(proclaim)
  const rooms = new Map()
  let selected = null
  let hovered = null
  let proclaimUntil = 0
  let greetUntil = 0

  // ---------------------------------------------------------------------------
  // Figures: the round-headed toy officials of the city.
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
    parent.add(m)
    return m
  }

  // 表情: one small canvas per look, shared by every figure.
  const mouths = new Map()
  function mouthMaterial(kind) {
    if (mouths.has(kind)) return mouths.get(kind)
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 64
    const c = cv.getContext('2d')
    c.fillStyle = '#a8433d'
    c.strokeStyle = '#a8433d'
    c.lineCap = 'round'
    if (kind === 'work') {
      c.beginPath(); c.ellipse(64, 32, 10, 12, 0, 0, Math.PI * 2); c.fill()
    } else if (kind === 'open') {
      c.beginPath(); c.ellipse(64, 32, 16, 21, 0, 0, Math.PI * 2); c.fill()
    } else if (kind === 'smile') {
      c.lineWidth = 9
      c.beginPath(); c.arc(64, 20, 26, 0.35, Math.PI - 0.35); c.stroke()
    } else if (kind === 'flat') {
      c.lineWidth = 8
      c.beginPath(); c.moveTo(46, 34); c.lineTo(82, 34); c.stroke()
    } else {
      c.lineWidth = 8
      c.beginPath(); c.moveTo(50, 32); c.lineTo(78, 32); c.stroke()
    }
    const texture = keep(new THREE.CanvasTexture(cv))
    const material = keep(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }))
    mouths.set(kind, material)
    return material
  }

  // 补子: the square on the breast, a bird for the civil ranks and a cat for the guard.
  const BADGES = new Map()
  function badgeMaterial(kind) {
    if (BADGES.has(kind)) return BADGES.get(kind)
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 128
    const c = cv.getContext('2d')
    c.fillStyle = kind === 'cat' ? '#2f2438' : '#22305c'
    c.fillRect(0, 0, 128, 128)
    c.strokeStyle = kind === 'crane' ? '#f0d79a' : kind === 'pheasant' ? '#e8a45a' : kind === 'cat' ? '#d8a24a' : '#cfd6e6'
    c.lineWidth = 5
    c.strokeRect(6, 6, 116, 116)
    c.fillStyle = c.strokeStyle
    if (kind === 'cat') {
      c.beginPath(); c.ellipse(64, 82, 26, 14, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(40, 70, 12, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.moveTo(32, 62); c.lineTo(28, 48); c.lineTo(40, 58); c.closePath(); c.fill()
      c.lineWidth = 7
      c.beginPath(); c.moveTo(88, 84); c.quadraticCurveTo(108, 74, 104, 52); c.stroke()
    } else {
      c.beginPath(); c.ellipse(64, 76, 19, 12, -0.16, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.moveTo(72, 68); c.quadraticCurveTo(86, 52, 89, 40); c.lineTo(80, 62); c.closePath(); c.fill()
      c.beginPath(); c.moveTo(88, 38); c.lineTo(103, 42); c.lineTo(88, 47); c.closePath(); c.fill()
      c.beginPath(); c.moveTo(58, 70); c.quadraticCurveTo(32, 42, 24, 26); c.quadraticCurveTo(50, 40, 63, 74); c.closePath(); c.fill()
      c.beginPath(); c.moveTo(48, 82); c.lineTo(20, 98); c.lineTo(46, 88); c.closePath(); c.fill()
    }
    const texture = keep(new THREE.CanvasTexture(cv))
    const material = keep(new THREE.MeshBasicMaterial({ map: texture }))
    BADGES.set(kind, material)
    return material
  }

  // Which bird a 衙门 wears: the ranks have their own, and the 内廷 wears none.
  function badgeOf(look) {
    if (look.hat === 'nei') return null
    if (look.hat === 'jyw') return 'cat'
    const title = String(look.title ?? look.office ?? '')
    if (/首辅|次辅|尚书/.test(title)) return 'crane'
    if (/侍郎/.test(title)) return 'pheasant'
    if (/学士|讲官|掌院|监正|院使|祭酒/.test(title)) return 'silver'
    return null
  }

  function makeFigure(look) {
    const g = new THREE.Group()
    g.scale.setScalar(look.scale ?? 1.08)
    const body = new THREE.Group()
    g.add(body)
    const robe = mat(look.robe)
    add(body, C(0.48, 0.9, 1.35, 14), robe, 0, 0.675, 0)
    add(body, C(0.53, 0.53, 0.14, 14), look.main ? '#f2c443' : '#e3a92a', 0, 0.98, 0)
    add(body, B(0.5, 0.42, 0.06), look.main ? '#f2c443' : '#f3d27a', 0, 0.66, 0.66, { rx: -0.31 })
    add(body, B(0.3, 0.24, 0.07), shade(look.robe, 0.1), 0, 0.66, 0.69, { rx: -0.31 })
    const armL = add(body, new THREE.SphereGeometry(0.3, 10, 8), robe, -0.62, 0.95, 0.08, { s: [0.9, 1.25, 0.9] })
    const armR = add(body, new THREE.SphereGeometry(0.3, 10, 8), robe, 0.62, 0.95, 0.08, { s: [0.9, 1.25, 0.9] })
    const head = new THREE.Group()
    head.position.y = 1.38
    body.add(head)
    add(head, new THREE.SphereGeometry(0.62, 20, 16), SKIN, 0, 0.45, 0)
    const eyes = []
    for (const s of [-1, 1]) {
      eyes.push(add(head, new THREE.SphereGeometry(0.075, 8, 6), INK, s * 0.21, 0.5, 0.55))
      add(head, new THREE.SphereGeometry(0.12, 8, 6), '#f4a3a0', s * 0.36, 0.33, 0.47, { s: [1, 0.55, 0.5], cast: false })
    }
    const brows = []
    for (const side of [-1, 1]) brows.push(add(head, B(0.2, 0.045, 0.05), '#3b2a24', side * 0.21, 0.63, 0.55, { rz: -side * 0.08 }))
    const mouth = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.27, 0.14)), mouthMaterial('neutral'))
    mouth.position.set(0, 0.29, 0.605)
    head.add(mouth)
    const badgeKind = badgeOf(look)
    const badge = badgeKind ? new THREE.Mesh(keep(new THREE.PlaneGeometry(0.22, 0.22)), badgeMaterial(badgeKind)) : null
    if (badge) {
      badge.position.set(0, 0.66, 0.705)
      badge.rotation.x = -0.31
      body.add(badge)
    }
    if (look.hat === 'nei') {
      add(head, C(0.4, 0.58, 0.62, 18), '#2c3550', 0, 1.02, 0)
      add(head, B(0.26, 0.2, 0.05), '#e3a92a', 0, 0.98, 0.5)
    } else if (look.hat === 'jyw') {
      add(head, C(0.9, 0.9, 0.06, 20), HAT, 0, 0.84, 0)
      add(head, C(0.36, 0.46, 0.46, 16), HAT, 0, 1.08, 0)
      add(head, new THREE.SphereGeometry(0.13, 8, 6), '#d2452f', 0, 1.35, 0)
    } else if (look.hat === 'fj') {
      const cap = look.cap ?? '#33405a'
      add(head, B(0.82, 0.5, 0.82), cap, 0, 1.0, -0.02, { ry: Math.PI / 4, s: [1, 1, 0.8] })
      for (const s of [-1, 1]) add(head, B(0.08, 0.55, 0.04), cap, s * 0.18, 0.75, -0.62, { rz: s * 0.15 })
    } else if (look.hat === 'dao') {
      add(head, new THREE.SphereGeometry(0.4, 14, 10), HAT, 0, 0.82, -0.1, { s: [1.05, 0.7, 1.05] })
      add(head, new THREE.SphereGeometry(0.22, 10, 8), HAT, 0, 1.18, -0.05)
      add(head, C(0.03, 0.03, 0.8, 5), '#e3a92a', 0, 1.2, -0.05, { rz: Math.PI / 2 })
    } else {
      add(head, C(0.5, 0.54, 0.42, 18), HAT, 0, 0.98, -0.02)
      add(head, new THREE.SphereGeometry(0.3, 10, 8), HAT, 0, 1.12, -0.2)
      for (const s of [-1, 1]) add(head, B(0.95, 0.06, 0.22), HAT, s * 0.82, 1.0, -0.24, { ry: s * 0.08 })
    }
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }))
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 32), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.09
    g.add(ring)
    return { g, body, head, armL, armR, eyes, brows, mouth, badge, ring, ringMat }
  }

  // A desk before each official; the 内承运库's carries an abacus.
  function makeDesk(home, abacus) {
    const d = new THREE.Group()
    d.position.set(home.x, 0, home.z + 1.35)
    add(d, B(1.7, 0.12, 0.85), '#8b5a3c', 0, 0.82, 0)
    for (const sx of [-0.7, 0.7]) for (const sz of [-0.3, 0.3]) add(d, B(0.1, 0.78, 0.1), '#6b432c', sx, 0.39, sz)
    add(d, B(0.3, 0.08, 0.22), '#2b2b2b', 0.5, 0.92, 0)
    add(d, C(0.04, 0.04, 0.5, 5), '#5a3a2a', 0.25, 0.95, -0.05, { rz: 1.3 })
    const beads = []
    if (abacus) {
      add(d, B(0.9, 0.06, 0.46), '#5a3a24', -0.25, 0.9, 0)
      for (let i = 0; i < 6; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          const bead = add(d, new THREE.SphereGeometry(0.045, 8, 6), j ? '#7a3b23' : '#e3a92a', -0.61 + i * 0.145, 0.97, -0.15 + j * 0.1, { s: [1, 0.7, 1], cast: false })
          beads.push({ bead, i, j, z0: bead.position.z })
        }
      }
    } else add(d, B(0.75, 0.03, 0.5), '#fbf6e8', -0.15, 0.9, 0)
    return { group: d, beads }
  }

  // 翰林院's easel, put out while the 学士 paints.
  function makeEasel(home) {
    const g = new THREE.Group()
    g.position.set(home.x + 2.1, 0, home.z + 0.4)
    g.rotation.y = -0.35
    for (const [x, rz] of [[-0.45, 0.12], [0.45, -0.12]]) add(g, C(0.05, 0.05, 2.4, 5), '#8b5a3c', x, 1.15, 0, { rz })
    add(g, C(0.05, 0.05, 2.3, 5), '#8b5a3c', 0, 1.1, -0.4, { rx: -0.35 })
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 320
    const c = cv.getContext('2d')
    c.fillStyle = '#f6eedb'
    c.fillRect(0, 0, 256, 320)
    c.fillStyle = '#d2452f'
    c.beginPath(); c.arc(190, 70, 22, 0, 7); c.fill()
    c.fillStyle = 'rgba(40,40,45,.85)'
    c.beginPath(); c.moveTo(0, 250); c.lineTo(60, 120); c.lineTo(110, 200); c.lineTo(160, 90); c.lineTo(256, 240); c.lineTo(256, 320); c.lineTo(0, 320); c.fill()
    c.fillStyle = 'rgba(40,40,45,.45)'
    c.beginPath(); c.moveTo(0, 280); c.lineTo(90, 190); c.lineTo(200, 270); c.lineTo(256, 250); c.lineTo(256, 320); c.lineTo(0, 320); c.fill()
    c.strokeStyle = '#8b5a3c'
    c.lineWidth = 10
    c.strokeRect(5, 5, 246, 310)
    const texture = keep(new THREE.CanvasTexture(cv))
    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.45), keep(new THREE.MeshBasicMaterial({ map: texture })))
    canvasMesh.position.set(0, 1.55, 0.06)
    canvasMesh.rotation.x = -0.12
    g.add(canvasMesh)
    g.visible = false
    g.scale.set(1, 0.01, 1)
    return g
  }

  // 奏折: the pile before a 衙门's door, one folio for each thing waiting.
  function makePile(home) {
    const g = new THREE.Group()
    g.position.set(home.x - 1.55, 0, home.z + 1.05)
    const planks = []
    for (let i = 0; i < 8; i += 1) {
      const plank = add(g, B(0.62, 0.06, 0.44), i % 2 ? '#f7f0e1' : '#eedfc2', (i % 2 ? 0.03 : -0.03), 0.05 + i * 0.066, (i % 2 ? -0.03 : 0.03), { ry: (i % 3 - 1) * 0.07 })
      plank.visible = false
      planks.push(plank)
    }
    // The pile answers the pointer: a ring on the flags round it.
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xe3a92a, transparent: true, opacity: 0.5, depthWrite: false }))
    const ring = new THREE.Mesh(keep(new THREE.RingGeometry(1.05, 1.3, 30)), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.05
    ring.visible = false
    g.add(ring)
    return { group: g, planks, ring }
  }

  // ---------------------------------------------------------------------------
  // Tags.
  function buildTag(id, selectable = true) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'cb-tag'
    el.dataset.kind = 'idle'
    const bub = document.createElement('span')
    bub.className = 'cb-bub'
    const seal = document.createElement('i')
    seal.className = 'cb-seal'
    const txt = document.createElement('span')
    txt.className = 'cb-txt'
    const time = document.createElement('span')
    time.className = 'cb-time'
    bub.append(seal, txt, time)
    const nm = document.createElement('span')
    nm.className = 'cb-nm'
    const office = document.createElement('small')
    const name = document.createElement('b')
    nm.append(office, name)
    const zz = document.createElement('span')
    zz.className = 'cb-zz'
    zz.textContent = 'z z'
    el.append(bub, zz, nm)
    if (selectable) {
      el.addEventListener('click', (event) => { event.stopPropagation(); onSelect?.(id) })
      el.addEventListener('dblclick', (event) => { event.stopPropagation(); onOpen?.(id) })
    } else el.classList.add('cb-ambient')
    el.addEventListener('pointerenter', () => setHover(id))
    el.addEventListener('pointerleave', () => setHover(null))
    tagLayer.appendChild(el)
    return { el, bub, seal, txt, time, office, name, w: 0, h: 0 }
  }

  const clock = (since) => {
    if (!since) return ''
    const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000))
    const m = Math.floor(seconds / 60)
    if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    return `${m}:${String(seconds % 60).padStart(2, '0')}`
  }

  function paintTag(p) {
    const { tag, data, state } = p
    const kind = state.kind ?? 'idle'
    const seal = SEALS[kind]
    tag.el.dataset.kind = kind
    tag.el.classList.toggle('main', data.main === true)
    tag.office.textContent = data.office && data.office !== data.name ? data.office : ''
    tag.name.textContent = data.name
    tag.seal.textContent = seal ? seal.word : ''
    tag.seal.hidden = !seal
    const said = p.say && p.say.until > performance.now() ? p.say.text : null
    tag.el.dataset.say = said ? '1' : ''
    const line = said ?? (kind === 'work' ? state.text
      : kind === 'court' ? (state.speaking ? words.speaking : '')
        : kind === 'pending' ? words.pending
          : kind === 'question' ? words.question
            : kind === 'done' ? words.done
              : kind === 'waiting' ? state.text
                : '')
    tag.txt.textContent = line ?? ''
    tag.bub.hidden = !line && !seal
    tag.time.textContent = kind === 'work' && !p.ambient ? clock(state.since) : ''
    tag.w = 0
  }

  // ---------------------------------------------------------------------------
  // The cast.
  const pickGeo = keep(new THREE.CylinderGeometry(1, 1, 3.6, 8))
  const pickMat = keep(new THREE.MeshBasicMaterial({ visible: false }))

  function disposeTree(object) {
    object.traverse((o) => { if (o.geometry && o.geometry !== pickGeo) o.geometry.dispose() })
  }
  function removePerson(p) {
    scene.remove(p.fig.g, p.desk.group, p.pile.group, p.pick, p.pile.pick)
    if (pileHover === p.id) pileHover = null
    disposeTree(p.fig.g)
    disposeTree(p.desk.group)
    disposeTree(p.pile.group)
    if (p.easel) { scene.remove(p.easel); disposeTree(p.easel) }
    p.tag.el.remove()
  }

  // Which 衙门 each Bot works in: its official's own, else the first spare one free.
  function assignBuildings(list) {
    const spares = new Map()
    const settler = new Map()
    const placed = new Map()
    const free = [...SPARES]
    const extra = []
    for (const data of list) {
      if (data.building && BUILDING[data.building]) { placed.set(data.id, data.building); continue }
      const spare = free.shift()
      if (spare) {
        placed.set(data.id, spare)
        spares.set(spare, data.office || data.name)
        settler.set(spare, data)
        continue
      }
      extra.push(data.id)
    }
    return { spares, settler, placed, extra }
  }

  function setPeople(list) {
    const cast = Array.isArray(list) ? list : []
    const before = new Map([...people].map(([id, p]) => [id, p.state]))
    for (const p of people.values()) removePerson(p)
    people.clear()
    const { spares, settler, placed, extra } = assignBuildings(cast)
    palace?.dispose()
    const plaques = plaquesFor([...cast, CLAUDE].map(data => ({
      name: data.name, office: data.office, building: data === CLAUDE ? 'nanshufang' : placed.get(data.id) ?? data.building,
    })))
    for (const [id, data] of settler) plaques.set(id, plaqueOf(id, [{ name: data.name, office: data.office }]))
    palace = buildPalace(scene, kit, { spares, maxAniso, plaques })
    applyWeather()
    // Bots past the spare 衙门 wait in a row before the 太和门.
    const homes = new Map()
    extra.forEach((id, i) => homes.set(id, { x: (i % 2 ? 1 : -1) * (10 + Math.floor(i / 2) * 3.4), z: 34 }))
    // Officials sharing a 衙门 stand side by side.
    const shared = new Map()
    for (const data of [...cast, CLAUDE]) {
      const building = data === CLAUDE ? 'nanshufang' : placed.get(data.id)
      if (!building) continue
      if (!shared.has(building)) shared.set(building, [])
      shared.get(building).push(data.id)
    }
    for (const [building, ids] of shared) {
      ids.forEach((id, i) => {
        const offset = ids.length === 1 ? 0 : (i - (ids.length - 1) / 2) * 3.6
        homes.set(id, homeOf(BUILDING[building], offset))
      })
    }
    for (const data of [...cast, CLAUDE]) {
      const home = homes.get(data.id)
      if (!home) continue
      const building = data === CLAUDE ? 'nanshufang' : placed.get(data.id) ?? null
      const fig = makeFigure(data)
      fig.g.position.set(home.x, 0, home.z)
      scene.add(fig.g)
      const desk = makeDesk(home, building === 'neiwufu')
      scene.add(desk.group)
      const pile = makePile(home)
      scene.add(pile.group)
      const pilePick = new THREE.Mesh(pickGeo, pickMat)
      pilePick.position.set(home.x - 1.0, 0.6, home.z + 1.2)
      pilePick.scale.set(2.6, 0.9, 2.6)
      pilePick.userData.pile = data.id
      scene.add(pilePick)
      pile.pick = pilePick
      const easel = building === 'hanlin' ? makeEasel(home) : null
      if (easel) scene.add(easel)
      const pick = new THREE.Mesh(pickGeo, pickMat)
      pick.userData.id = data.id
      scene.add(pick)
      const ambient = data === CLAUDE
      const p = {
        id: data.id, data, building, fig, desk, easel, pile, pick, ambient,
        home: new THREE.Vector3(home.x, 0, home.z),
        tag: buildTag(data.id, !ambient),
        state: before.get(data.id) ?? data.state ?? { kind: 'idle', text: '' },
        path: [], mode: 'home', slot: null, rot: 0, phase: Math.random() * 6, wander: null, wt: Math.random() * 3,
        hop: 0, patrol: null,
      }
      if (ambient) p.state = claudeState(lastHour)
      people.set(p.id, p)
      paintTag(p)
    }
    placeMeetings(true)
    select(selected)
    // The kit reads the palette off the built world, so it is born after the first build;
    // later casts add materials of their own, which it takes in without regrading them.
    if (!render) render = createRenderKit({ renderer, scene, camera, still })
    else render.refresh?.()
    render.setClock(lastHour, weather)
  }

  // ---------------------------------------------------------------------------
  // States.
  function setPersonState(id, state) {
    const p = people.get(id)
    if (!p || !state || p.ambient) return
    const was = p.state
    p.state = state
    if (was && was.kind === state.kind && was.text === state.text && was.room === state.room && was.speaking === state.speaking && was.towards === state.towards && was.since === state.since) return
    paintTag(p)
    if (!was || was.kind !== state.kind || was.room !== state.room) placeMeetings(false)
    if (!was || was.kind !== state.kind) applySky(lastHour)
  }

  function claudeState(hour) {
    if (hour >= 21 + 20 / 60 && hour < 21 + 45 / 60) return { kind: 'work', text: words.memorials ?? '' }
    if (hour < 6.5 || hour >= 22.5) return { kind: 'sleep', text: '' }
    return { kind: 'idle', text: '' }
  }

  // Who stands where on the square. Meetings take their place in the order their first
  // member comes in the sidebar: the first before the 太和殿, the next before the 乾清宫.
  function placeMeetings(instant) {
    const order = []
    const members = new Map()
    for (const p of people.values()) {
      if (p.state.kind !== 'court') continue
      const room = p.state.room || '_'
      if (!members.has(room)) { members.set(room, []); order.push(room) }
      members.get(room).push(p)
    }
    for (const p of people.values()) {
      if (p.state.kind === 'court' || (p.mode !== 'court' && p.mode !== 'toCourt')) continue
      p.slot = null
      if (instant || still) { p.fig.g.position.copy(p.home); p.path = []; p.mode = 'home'; continue }
      p.path = walkPath({ x: p.fig.g.position.x, z: p.fig.g.position.z }, p.home).slice(1)
      p.mode = 'toHome'
    }
    order.forEach((room, index) => {
      const ranks = { E: 0, W: 0 }
      for (const p of members.get(room)) {
        const side = p.data.side === 'W' ? 'W' : 'E'
        const slot = courtSlot(index, side, ranks[side])
        ranks[side] += 1
        if (p.slot && Math.hypot(p.slot.x - slot.x, p.slot.z - slot.z) < 0.05) continue
        if (p.patrol) { p.patrol = null; p.fig.g.position.copy(p.home) }
        if (instant || still) {
          p.slot = slot
          p.fig.g.position.set(slot.x, 0, slot.z)
          p.path = []
          p.mode = 'court'
          p.rot = Math.PI
          continue
        }
        const from = { x: p.fig.g.position.x, z: p.fig.g.position.z }
        p.path = p.slot ? [slot] : walkPath(from, slot).slice(1)
        p.slot = slot
        p.mode = 'toCourt'
      }
    })
    rooms.forEach((label, room) => { if (!members.has(room)) { label.el.remove(); rooms.delete(room) } })
    order.forEach((room, index) => {
      const list = members.get(room)
      let label = rooms.get(room)
      if (!label) {
        const el = document.createElement('div')
        el.className = 'cb-room'
        tagLayer.appendChild(el)
        label = { el }
        rooms.set(room, label)
      }
      const head = courtSlot(index, 'E', 0)
      label.x = 0
      label.z = head.z - 2.4
      label.y = 0.4
      const name = list[0].state.text ?? ''
      label.el.textContent = `${words.court ?? ''}${name ? ` · ${name}` : ''} · ${list.length}${words.people ?? ''}`
    })
  }

  // ---------------------------------------------------------------------------
  // Runners: a little eunuch carrying a memorial from one official to another, or to the
  // square when the work goes to a meeting.
  function send({ from, to, room }) {
    const giver = people.get(from)
    const taker = to ? people.get(to) : null
    if (!giver || (!taker && !room) || still || runners.length >= 6) return
    const start = { x: giver.home.x + 1.6, z: giver.home.z }
    const end = taker ? { x: taker.home.x + 1.6, z: taker.home.z } : { x: 0, z: 2 }
    render?.wake(4)
    const fig = makeFigure({ robe: '#6d7fa3', hat: 'nei', scale: 0.9 })
    add(fig.body, B(0.55, 0.12, 0.38), '#f2c443', 0, 1.25, 0.72)
    fig.ring.visible = false
    fig.g.position.set(start.x, 0, start.z)
    scene.add(fig.g)
    const tag = document.createElement('div')
    tag.className = 'cb-run'
    tag.textContent = `${words.memorial ?? ''} · ${giver.data.name} → ${taker ? taker.data.name : words.square ?? ''}`
    tagLayer.appendChild(tag)
    const dotGeo = new THREE.CircleGeometry(0.16, 10)
    const dots = [...Array(14)].map(() => {
      const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#e3a92a', transparent: true, opacity: 0, depthWrite: false }))
      d.rotation.x = -Math.PI / 2
      scene.add(d)
      return d
    })
    runners.push({ fig, tag, dots, dotGeo, path: walkPath(start, end).slice(1), hist: [], acc: 0, taker, done: 0 })
    giver.hop = 1
  }

  function removeRunner(r) {
    scene.remove(r.fig.g)
    r.tag.remove()
    for (const d of r.dots) { scene.remove(d); d.material.dispose() }
    r.dotGeo.dispose()
    disposeTree(r.fig.g)
  }

  function stepRunner(r, dt, t) {
    const g = r.fig.g
    if (r.path.length > 0) {
      const next = r.path[0]
      const dx = next.x - g.position.x
      const dz = next.z - g.position.z
      const dist = Math.hypot(dx, dz)
      const step = RUN * dt
      if (dist <= step) {
        g.position.x = next.x
        g.position.z = next.z
        r.path.shift()
      } else {
        g.position.x += dx / dist * step
        g.position.z += dz / dist * step
      }
      if (dist > 0.01) g.rotation.y = Math.atan2(dx, dz)
      r.fig.body.position.y = Math.abs(Math.sin(t * 12)) * 0.16
      r.fig.armR.position.z = 0.5
      r.fig.armL.position.z = 0.5
      r.acc += dt
      if (r.acc > 0.12) { r.acc = 0; r.hist.unshift(g.position.clone()); r.hist.length = Math.min(r.hist.length, 14) }
      if (r.path.length === 0 && r.taker) r.taker.hop = 1
    } else {
      // Delivered: he is gone.
      r.done += dt
      g.scale.setScalar(0.97 * Math.max(0.01, 1 - r.done / 0.6))
    }
    r.dots.forEach((d, i) => {
      const h = r.hist[i]
      if (!h) { d.material.opacity = 0; return }
      d.position.set(h.x, 0.12, h.z)
      d.material.opacity = 0.55 * (1 - i / 14) * (r.done > 0 ? Math.max(0, 1 - r.done / 0.6) : 1)
    })
    return r.done < 0.6
  }

  // ---------------------------------------------------------------------------
  // Ceremonies.
  function banner(text, ms) {
    proclaim.textContent = text
    proclaim.hidden = false
    proclaim.style.animation = 'none'
    void proclaim.offsetWidth
    proclaim.style.animation = ''
    proclaimUntil = performance.now() + ms
  }

  function decree({ from }) {
    render?.wake(CEREMONY_MS / 1000)
    banner(words.decree ?? '', CEREMONY_MS)
    const giver = people.get(from)
    if (giver) giver.hop = 1
  }

  // 皇上驾到: the officials with nothing in hand turn to the Emperor and bow.
  function greet() {
    render?.wake(3.6)
    banner(words.arrive ?? '', 2800)
    greetUntil = performance.now() + 3600
  }

  // ---------------------------------------------------------------------------
  // Weather: the kit paints the sky, the rain and the snow; the board keeps the word.
  let weather = { kind: 'clear' }
  function setWeather(next) {
    weather = next ?? { kind: 'clear' }
    applyWeather()
  }
  function applyWeather() {
    applySky(lastHour)
  }

  // ---------------------------------------------------------------------------
  // Sky and light by the hour, dimmed under cloud.
  function applySky(hour) {
    lastHour = hour
    const day = smooth(5.6, 7.2, hour) * (1 - smooth(17.2, 18.9, hour))
    const dusk = Math.max(Math.exp(-((hour - 6.4) ** 2) / 0.5), Math.exp(-((hour - 17.9) ** 2) / 0.5))
    const overcast = { rain: 0.75, storm: 0.9, snow: 0.55, cloudy: 0.35, fog: 0.5 }[weather.kind] ?? 0
    let top = mixColour('#18213f', '#7fc3ea', day).lerp(new THREE.Color('#f0a98a'), dusk * 0.55 * (1 - overcast))
    let bottom = mixColour('#33406e', '#eaf5f1', day).lerp(new THREE.Color('#fcd9ae'), dusk * 0.7 * (1 - overcast))
    const grey = weather.kind === 'snow' ? ['#aeb9c6', '#e9edf1'] : ['#7d8b9b', '#c5cdd3']
    top = top.lerp(mixColour('#1d2333', grey[0], day), overcast)
    bottom = bottom.lerp(mixColour('#2f3548', grey[1], day), overcast)
    container.style.background = `linear-gradient(#${top.getHexString()},#${bottom.getHexString()})`
    // The kit owns the sun, the fog, the grade and the fall; the gradient above is the CSS sky.
    render?.setClock(hour, weather)
    const night = Math.max(1 - day, overcast * 0.4)
    if (palace) {
      // Only the halls with someone on duty keep their windows lit after dark.
      const busy = new Set()
      for (const p of people.values()) {
        if (!p.building) continue
        const kind = p.state.kind
        if (kind === 'work' || kind === 'pending' || kind === 'question' || kind === 'court') busy.add(p.building)
      }
      for (const [id, material] of palace.windows ?? []) {
        material.emissiveIntensity = glow && busy.has(id) ? 0.3 + 1.2 * night : 0
      }
      palace.glowLan.emissiveIntensity = glow ? 0.25 + 1.1 * night : 0
      palace.cloudMat.emissiveIntensity = 0.25 - 0.15 * (1 - day)
      palace.cloudMat.color.set(overcast > 0.3 ? (weather.kind === 'snow' ? '#e4e8ee' : '#9aa6b2') : '#ffffff')
    }
  }
  const setTime = minutes => applySky(minutes / 60)
  // The title bar's switch: the kit owns the lamps it knows, the halls keep their windows.
  function setGlow(on) {
    glow = on !== false
    render?.setGlow?.(glow)
    applySky(lastHour)
  }

  // ---------------------------------------------------------------------------
  // Selection, hover, picking.
  const markerMat = keep(kit.toon({ color: 0xd2452f, emissive: 0xd2452f, emissiveIntensity: 0.3 }))
  const marker = new THREE.Mesh(keep(new THREE.ConeGeometry(0.35, 0.7, 4)), markerMat)
  marker.rotation.x = Math.PI
  marker.visible = false
  scene.add(marker)

  // One line over an official's head for a moment — what he says when he is clicked.
  function say(id, text, ms = 4200) {
    const p = people.get(id)
    if (!p || !text) return
    p.say = { text, until: performance.now() + ms }
    paintTag(p)
    render?.wake(ms / 1000 + 0.3)
  }

  let pileHover = null
  function setPileHover(id) {
    if (pileHover === id) return
    if (pileHover) {
      const old = people.get(pileHover)
      if (old) old.pile.ring.visible = false
    }
    pileHover = id
    if (id) {
      const now = people.get(id)
      if (now) now.pile.ring.visible = true
    }
    render?.wake(1.2)
  }
  function setHover(id) {
    if (hovered === id) return
    if (hovered) people.get(hovered)?.tag.el.classList.remove('hover')
    hovered = id
    if (id) people.get(id)?.tag.el.classList.add('hover')
    canvas.style.cursor = id && !people.get(id)?.ambient ? 'pointer' : ''
  }

  function select(id) {
    render?.wake(1.5)
    const next = id && people.has(id) && !people.get(id).ambient ? id : null
    const changed = next !== selected
    selected = next
    for (const p of people.values()) p.tag.el.classList.toggle('sel', p.id === selected)
    // The 锦衣卫 on his round is called back to his door when the Emperor picks him.
    if (selected) {
      const picked = people.get(selected)
      if (picked?.patrol) { picked.patrol = null; picked.fig.g.position.copy(picked.home) }
    }
    // Picking an official walks the eye up to him; closing the card leaves the eye be.
    if (changed && selected) pushIn(selected)
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  function pickAt(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const targets = [
      ...[...people.values()].filter(p => !p.ambient).map(p => p.pick),
      ...[...people.values()].filter(p => !p.ambient).map(p => p.pile.pick),
      ...(palace?.pickables ?? []),
    ]
    // An official or his pile wins over the hall behind him: the hall's pick box is a
    // rough block round the whole 衙门, and it would otherwise swallow everything.
    const hits = raycaster.intersectObjects(targets, false)
    const hit = hits.find(one => one.object.userData.id || one.object.userData.pile) ?? hits[0]
    if (!hit) return { id: null, building: null, pile: false }
    if (hit.object.userData.pile) return { id: hit.object.userData.pile, building: null, pile: true }
    if (hit.object.userData.id) return { id: hit.object.userData.id, building: null, pile: false }
    const bid = hit.object.userData.bid
    return { id: [...people.values()].find(p => p.building === bid && !p.ambient)?.id ?? null, building: bid ?? null, pile: false }
  }
  let down = null
  const onDown = (event) => { down = { x: event.clientX, y: event.clientY }; fly = null }
  const onUp = (event) => {
    if (!down) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    down = null
    if (moved > 6 || event.button !== 0) return
    const hit = pickAt(event)
    onSelect?.(hit.id, hit.building, hit.pile)
  }
  // The drag-and-drop asks the same question with plain coordinates.
  function pickClient(x, y) {
    return pickAt({ clientX: x, clientY: y })
  }
  const onMove = (event) => {
    if (event.buttons !== 0) return
    const hit = pickAt(event)
    setHover(hit.id)
    setPileHover(hit.pile ? hit.id : null)
    if (hit.pile) canvas.style.cursor = 'pointer'
  }
  const onDouble = (event) => { const hit = pickAt(event); if (hit.id) onOpen?.(hit.id) }
  const onLeave = () => { setHover(null); setPileHover(null) }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('dblclick', onDouble)
  canvas.addEventListener('pointerleave', onLeave)
  controls.addEventListener('start', () => { fly = null })

  // ---------------------------------------------------------------------------
  // Camera.
  let fly = null
  function glide(target, position, duration = 1.1) {
    render?.wake(2)
    if (still) {
      controls.target.copy(target)
      camera.position.copy(position)
      controls.update()
      return
    }
    fly = { t: 0, duration, fromTarget: controls.target.clone(), toTarget: target, fromPos: camera.position.clone(), toPos: position }
  }
  // The whole city from the south-east, a little further back in a narrow pane.
  function overview() {
    const far = camera.aspect < 1.25 ? 1.6 : 1.14
    return { target: new THREE.Vector3(0, 0, -14), position: new THREE.Vector3(92 * far, 96 * far, 112 * far) }
  }
  function frame(instant) {
    const { target, position } = overview()
    if (instant) { controls.target.copy(target); camera.position.copy(position); controls.update(); return }
    glide(target, position, 1.4)
  }
  // The three ways into the city: the whole board, the 内阁's halls, the 六部's 衙门.
  const VIEWS = {
    overview: () => overview(),
    cabinet: () => ({ target: new THREE.Vector3(37, 1.5, -8), position: new THREE.Vector3(64, 32, 26) }),
    six: () => ({ target: new THREE.Vector3(37, 1, 22), position: new THREE.Vector3(60, 29, 58) }),
  }
  function view(name) {
    const make = VIEWS[name]
    if (!make) return false
    const { target, position } = make()
    select(null)
    if (still) { controls.target.copy(target); camera.position.copy(position); controls.update(); return true }
    glide(target, position, 1.2)
    return true
  }
  // A leg of a scripted move (the 御驾巡视): the eye goes to `eye` looking at `target`.
  function glideTo(target, eye, seconds = 1.2) {
    if (!Array.isArray(target) || !Array.isArray(eye)) return
    render?.wake(seconds + 0.4)
    const to = new THREE.Vector3(target[0], target[1], target[2])
    const at = new THREE.Vector3(eye[0], eye[1], eye[2])
    if (still) {
      controls.target.copy(to)
      camera.position.copy(at)
      controls.update()
      return
    }
    glide(to, at, seconds)
  }
  // The minimap hands back a point on the ground: the eye keeps its height and angle.
  function lookAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return
    render?.wake(1.2)
    const target = new THREE.Vector3(x, controls.target.y, z)
    if (still) { controls.target.copy(target); controls.update(); return }
    const offset = camera.position.clone().sub(controls.target)
    glide(target, target.clone().add(offset), 0.8)
  }
  // Where everyone stands, for the minimap: meetings and walks included.
  function positions() {
    const out = []
    for (const p of people.values()) {
      const g = p.fig.g.position
      out.push({ id: p.id, x: g.x, y: g.y, z: g.z })
    }
    return out
  }
  function viewPoint() {
    const target = controls.target
    return {
      x: target.x, z: target.z,
      yaw: Math.atan2(camera.position.x - target.x, camera.position.z - target.z),
      distance: camera.position.distanceTo(target),
    }
  }
  // The halls as boxes, so a camera can be told it would shoot through a neighbour's roof.
  const HALL_BOXES = BUILDINGS.filter(b => b.id && b.type !== 'oct' && b.type !== 'tower').map(b => {
    const tiers = b.tiers ?? 1
    return {
      id: b.id,
      minX: b.x - (b.w + 3) / 2, maxX: b.x + (b.w + 3) / 2,
      minZ: b.z - (b.d + 3) / 2, maxZ: b.z + footOf(b) / 2,
      minY: 0,
      maxY: tiers * 0.7 + b.h + 0.7 + (b.d * 0.45 + 1.2) * (b.dbl ? 2.6 : 1) + 0.8,
    }
  })
  function crossesHall(from, to, skip) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    for (const hall of HALL_BOXES) {
      if (hall.id === skip) continue
      let t0 = 0
      let t1 = 1
      const lo = [hall.minX, hall.minY, hall.minZ]
      const hi = [hall.maxX, hall.maxY, hall.maxZ]
      const origin = [from.x, from.y, from.z]
      const step = [dx, dy, dz]
      let hit = true
      for (let axis = 0; axis < 3; axis += 1) {
        if (Math.abs(step[axis]) < 1e-6) {
          if (origin[axis] < lo[axis] || origin[axis] > hi[axis]) { hit = false; break }
          continue
        }
        let a = (lo[axis] - origin[axis]) / step[axis]
        let b = (hi[axis] - origin[axis]) / step[axis]
        if (a > b) { const swap = a; a = b; b = swap }
        t0 = Math.max(t0, a)
        t1 = Math.min(t1, b)
        if (t0 > t1) { hit = false; break }
      }
      if (hit) return true
    }
    return false
  }
  // Close on one official: the first of a few eye points from the courtyard side that
  // looks over his desk at him without a neighbour's roof cutting through the shot.
  const CLOSE_POINTS = [
    [10.5, 6, 3],
    [9, 8.5, 6],
    [11, 11.5, 9],
    [0, 20, 7],
  ]
  function pushIn(id) {
    const p = people.get(id)
    if (!p) return
    const at = p.fig.g.position
    const target = at.clone()
    target.y += 1.6
    let eye
    if (p.patrol) {
      // 锦衣卫 walks the wall top: the eye stands inside the city and looks out and up at
      // him, with the parapet behind — from outside, the wall itself would be the picture.
      const inward = new THREE.Vector3(-at.x, 0, -14 - at.z)
      if (inward.lengthSq() < 0.01) inward.set(0, 0, 1)
      eye = target.clone().add(inward.normalize().multiplyScalar(6)).add(new THREE.Vector3(0, 9, 0))
    } else {
      const side = at.x >= -4 && at.x <= 4 ? 1 : -Math.sign(at.x) || 1
      let chosen = CLOSE_POINTS[CLOSE_POINTS.length - 1]
      for (const point of CLOSE_POINTS) {
        const camera_ = target.clone().add(new THREE.Vector3(side * point[0], point[1], point[2]))
        if (!crossesHall(camera_, target, p.building)) { chosen = point; break }
      }
      eye = target.clone().add(new THREE.Vector3(side * chosen[0], chosen[1], chosen[2]))
    }
    // Never put the eye outside the wall: a man on the wall or the far rank is still seen
    // from inside the city, looking up at him.
    eye.x = Math.max(-56, Math.min(56, eye.x))
    eye.z = Math.max(-70, Math.min(37, eye.z))
    eye.y = Math.max(eye.y, target.y + 4)
    glide(target, eye, 1.1)
  }
  function flyTo(id) {
    pushIn(id)
  }

  let inset = 0
  let insetNow = 0
  const setInset = (px) => { inset = px }
  let width = 1
  let height = 1
  function resize() {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    camera.aspect = width / height
    applyInset()
  }
  function applyInset() {
    if (Math.abs(insetNow) < 0.5) camera.clearViewOffset()
    else camera.setViewOffset(width, height, -insetNow / 2, 0, width, height)
    camera.updateProjectionMatrix()
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  observer?.observe(container)
  resize()

  // ---------------------------------------------------------------------------
  // The loop.
  let running = false
  let frameId = 0
  let last = 0
  let tick = 0
  let clockTick = 0
  const tmp = new THREE.Vector3()
  const legs = []
  let patrolLength = 0
  for (let i = 0; i < PATROL.length - 1; i += 1) {
    const l = Math.hypot(PATROL[i + 1].x - PATROL[i].x, PATROL[i + 1].z - PATROL[i].z)
    legs.push(l)
    patrolLength += l
  }

  function patrolStep(p, dt) {
    p.patrol.s = (p.patrol.s + dt * 2.6) % (patrolLength * 2)
    let d = p.patrol.s < patrolLength ? p.patrol.s : 2 * patrolLength - p.patrol.s
    const dir = p.patrol.s < patrolLength ? 1 : -1
    for (let i = 0; i < legs.length; i += 1) {
      if (d <= legs[i] || i === legs.length - 1) {
        const a = PATROL[i]
        const b = PATROL[i + 1]
        const k = Math.min(1, d / legs[i])
        p.fig.g.position.set(a.x + (b.x - a.x) * k, WALL_TOP, a.z + (b.z - a.z) * k)
        p.rot = Math.atan2((b.x - a.x) * dir, (b.z - a.z) * dir)
        return
      }
      d -= legs[i]
    }
  }

  function animatePerson(p, dt, now) {
    if (p.ambient) {
      const next = claudeState(lastHour)
      if (next.kind !== p.state.kind) { p.state = next; paintTag(p) }
    }
    const st = p.state
    const kind = st.kind ?? 'idle'
    const g = p.fig.g
    const T2 = tick + p.phase
    const bowing = now < greetUntil && kind === 'idle' && p.mode === 'home'
    // The 锦衣卫 walks the wall while he is on his round.
    const patrolling = p.building === 'zhenfu' && kind === 'work' && p.mode === 'home' && !still && p.id !== selected
    if (patrolling && !p.patrol) p.patrol = { s: 4 }
    if (!patrolling && p.patrol) { p.patrol = null; g.position.copy(p.home) }

    let target = null
    let speed = 0
    if (p.patrol) patrolStep(p, dt)
    else if (p.path.length > 0) { target = p.path[0]; speed = WALK }
    else if (p.mode === 'home') {
      if (kind === 'idle' && !bowing && !still) {
        p.wt -= dt
        if (!p.wander || p.wt <= 0) {
          const a = Math.random() * Math.PI * 2
          const r = 0.8 + Math.random() * 1.6
          p.wander = p.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, -Math.abs(Math.sin(a)) * r * 0.8))
          p.wt = 3 + Math.random() * 4
        }
        target = p.wander
        speed = 1.3
      } else { target = p.home; speed = 2 }
    }
    let moving = !!p.patrol
    if (moving) render?.wake(0.4)
    if (target) {
      tmp.set(target.x - g.position.x, 0, target.z - g.position.z)
      const dl = tmp.length()
      if (dl > 0.05) {
        render?.wake(0.4)
        const step = Math.min(dl, speed * dt)
        g.position.addScaledVector(tmp.normalize(), step)
        g.position.y = 0
        moving = speed > 3 || dl > 0.3
        p.rot = angLerp(p.rot, Math.atan2(tmp.x, tmp.z), Math.min(1, dt * 10))
      } else if (p.path.length > 0) {
        p.path.shift()
        if (p.path.length === 0) p.mode = p.mode === 'toCourt' ? 'court' : 'home'
      }
    }
    const memorials = Math.max(0, Math.min(8, Number(st.memorials ?? ((kind === 'pending' || kind === 'question') ? 1 : 0)) || 0))
    for (let i = 0; i < p.pile.planks.length; i += 1) p.pile.planks[i].visible = i < memorials
    if (!moving) {
      let face = null
      if (p.mode === 'court') face = Math.PI
      else if (bowing || kind === 'work' || kind === 'pending' || kind === 'question' || kind === 'sleep' || kind === 'done') face = 0
      else if (kind === 'waiting' && st.towards && people.has(st.towards)) {
        const other = people.get(st.towards).fig.g.position
        face = Math.atan2(other.x - g.position.x, other.z - g.position.z)
      }
      if (face !== null) p.rot = angLerp(p.rot, face, Math.min(1, dt * 5))
    }
    g.rotation.y = p.rot

    const { body, head, armL, armR, eyes, ring, ringMat } = p.fig
    const run = moving && speed > 3
    let by = 0
    let hx = 0
    let hz = 0
    let rz = 0
    let arz = 0.08
    if (moving && !still) {
      by = Math.abs(Math.sin(T2 * (run ? 12 : 7))) * (run ? 0.16 : 0.08)
      rz = Math.sin(T2 * (run ? 12 : 7)) * 0.06
    } else if (kind === 'work') {
      hx = 0.22 + Math.sin(T2 * 2.5) * 0.05
      arz = 0.35 + Math.sin(T2 * 9) * 0.08
    } else if (kind === 'pending' || kind === 'question') {
      by = still ? 0 : Math.abs(Math.sin(T2 * 5)) * 0.18
      hz = Math.sin(T2 * 5) * 0.08
    } else if (kind === 'sleep') {
      hx = 0.38
      hz = 0.18
    } else if (p.mode === 'court') {
      hx = 0.12
      if (st.speaking && !still) by = Math.abs(Math.sin(T2 * 6)) * 0.1
    } else hz = Math.sin(T2 * 1.1) * 0.07
    if (p.hop > 0) {
      p.hop = Math.max(0, p.hop - dt * 1.8)
      by += Math.sin((1 - p.hop) * Math.PI) * 0.6
    }
    body.scale.y = kind === 'sleep' && !moving ? 1 + Math.sin(T2 * 1.4) * 0.025 : 1
    body.position.y = by
    body.rotation.z = rz
    body.rotation.x += ((bowing && !moving ? 0.5 : 0) - body.rotation.x) * Math.min(1, dt * 4)
    head.rotation.x += (hx - head.rotation.x) * Math.min(1, dt * 6)
    head.rotation.z += (hz - head.rotation.z) * Math.min(1, dt * 6)
    armR.position.z = bowing ? 0.4 : arz
    armR.position.y = 0.95 + (kind === 'work' && !moving ? Math.sin(T2 * 9) * 0.05 : 0)
    if (moving) {
      armR.position.z = 0.08 + Math.sin(T2 * 12) * 0.18
      armL.position.z = 0.08 - Math.sin(T2 * 12) * 0.18
    } else armL.position.z = bowing ? 0.4 : 0.08
    // Eyes shut in sleep, a blink now and then; the mouth and the brows say the rest.
    const blink = (T2 % 4.3) < 0.12
    for (const e of eyes) e.scale.y = kind === 'sleep' ? 0.2 : blink ? 0.15 : 1
    const expr = kind === 'work' ? 'work' : kind === 'pending' || kind === 'question' ? 'open' : kind === 'done' ? 'smile' : kind === 'sleep' ? 'flat' : 'neutral'
    const mouthMat = mouthMaterial(expr)
    if (p.fig.mouth.material !== mouthMat) p.fig.mouth.material = mouthMat
    p.fig.brows.forEach((brow, i) => {
      const side = i === 0 ? -1 : 1
      const tilt = kind === 'work' ? side * 0.24 : kind === 'pending' || kind === 'question' ? -side * 0.14 : -side * 0.06
      brow.rotation.z = tilt
      brow.position.y = 0.63 + (kind === 'pending' || kind === 'question' ? 0.03 : 0)
      brow.visible = kind !== 'sleep'
    })
    const colour = RING[p.mode === 'court' || p.mode === 'toCourt' ? 'court' : kind] ?? RING.idle
    ringMat.color.set(colour)
    const pulse = kind === 'pending' || kind === 'question'
    ringMat.opacity = pulse ? 0.55 + Math.sin(tick * 6) * 0.35 : kind === 'work' || kind === 'done' ? 0.85 : p.mode !== 'home' ? 0.6 : 0.35
    ring.scale.setScalar(pulse ? 1 + Math.sin(tick * 6) * 0.12 : 1)
    p.pick.position.set(g.position.x, g.position.y + 1.8, g.position.z)

    // The 衙门's own trades.
    if (p.easel) {
      const want = kind === 'work' && p.mode === 'home'
      const s = p.easel.scale.y + ((want ? 1 : 0.01) - p.easel.scale.y) * Math.min(1, dt * 6)
      p.easel.scale.set(1, s, 1)
      p.easel.visible = s > 0.05
    }
    if (p.desk.beads.length > 0) {
      const on = kind === 'work' && !still
      for (const b of p.desk.beads) b.bead.position.z = b.z0 + (on && b.j === 1 && (b.i + Math.floor(tick * 3)) % 3 === 0 ? Math.sin(tick * 12 + b.i) * 0.05 : 0)
    }
    if (p.building === 'sitian' && palace && !still) {
      const on = kind === 'work'
      const arm = palace.armillary
      arm.rotation.y += dt * (on ? 1.4 : 0.08)
      arm.children[1].rotation.z += dt * (on ? 2 : 0)
      arm.children[3].rotation.y += dt * (on ? 1.3 : 0)
    }
  }

  function tickFrame(time) {
    if (!running) return
    frameId = requestAnimationFrame(tickFrame)
    const dt = Math.min(0.05, last ? (time - last) / 1000 : 0.016)
    last = time
    tick += dt
    if (fly) {
      fly.t += dt
      const k = Math.min(1, fly.t / fly.duration)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e)
      camera.position.lerpVectors(fly.fromPos, fly.toPos, e)
      if (k >= 1) fly = null
    }
    if (Math.abs(insetNow - inset) > 0.5) {
      insetNow += (inset - insetNow) * Math.min(1, dt * 8)
      applyInset()
    }
    controls.target.x = Math.max(-80, Math.min(80, controls.target.x))
    controls.target.z = Math.max(-90, Math.min(70, controls.target.z))
    controls.target.y = Math.max(0, Math.min(12, controls.target.y))
    controls.update()
    if (palace) {
      let court = false
      for (const p of people.values()) if (p.mode === 'court' || p.mode === 'toCourt') { court = true; break }
      const halo = palace.halo
      halo.material.opacity += ((court || time < proclaimUntil ? 0.75 : 0) - halo.material.opacity) * Math.min(1, dt * 3)
      halo.rotation.z += dt * 0.4
      if (!still) for (const c of palace.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 190) c.position.x = -190 }
    }
    for (const p of people.values()) {
      if (p.say && p.say.until < time) { p.say = null; paintTag(p) }
      if (p.pile.ring.visible) p.pile.ring.scale.setScalar(1 + Math.sin(tick * 4) * 0.05)
      animatePerson(p, dt, time)
    }
    for (let i = runners.length - 1; i >= 0; i -= 1) {
      if (!stepRunner(runners[i], dt, tick)) { removeRunner(runners[i]); runners.splice(i, 1) }
    }
    if (selected && people.has(selected)) {
      const g = people.get(selected).fig.g.position
      marker.visible = true
      marker.position.set(g.x, g.y + 4.4 + Math.sin(tick * 3) * 0.2, g.z)
      marker.rotation.y += dt * 2
    } else marker.visible = false
    if (!proclaim.hidden && time > proclaimUntil) proclaim.hidden = true
    if (!render || render.shouldRender(dt)) {
      if (palace?.river) palace.river.material.map.offset.x = (palace.river.material.map.offset.x + dt * 0.02) % 1
      renderer.render(scene, camera)
      placeTags()
    }
    if (time - clockTick > 1000) {
      clockTick = time
      for (const p of people.values()) if (p.state.kind === 'work' && !p.ambient) p.tag.time.textContent = clock(p.state.since)
    }
  }

  // Tags follow their heads; one that falls behind a more urgent one steps back.
  const RANK = { pending: 1, question: 1, done: 2, work: 2, court: 2, waiting: 3 }
  const rank = p => (p.id === selected || p.id === hovered ? 0 : RANK[p.state.kind] ?? 4)
  const placed = []
  function placeTags() {
    const camDist = camera.position.distanceTo(controls.target)
    tagLayer.classList.toggle('cb-far', camDist > 150)
    placed.length = 0
    const list = []
    for (const p of people.values()) {
      const g = p.fig.g.position
      tmp.set(g.x, g.y + 3.7, g.z).project(camera)
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2
      list.push({ p, x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, depth: tmp.z, visible })
    }
    list.sort((a, b) => rank(a.p) - rank(b.p) || a.depth - b.depth)
    for (const item of list) {
      const { p } = item
      const el = p.tag.el
      if (!item.visible) { el.style.visibility = 'hidden'; continue }
      el.style.visibility = ''
      if (p.tag.w === 0) { p.tag.w = el.offsetWidth; p.tag.h = el.offsetHeight }
      const { w, h } = p.tag
      const important = p.id === selected || p.id === hovered
      const covered = !important && placed.some(r => Math.abs(r.x - item.x) < (r.w + w) / 2 - 20 && item.y > r.y - r.h + 8 && item.y - h < r.y - 8)
      el.classList.toggle('cb-behind', covered)
      if (!covered) placed.push({ x: item.x, y: item.y, w, h })
      el.style.transform = `translate(${Math.round(item.x - w / 2)}px, ${Math.round(item.y - h)}px)`
      el.style.zIndex = important ? '1000' : String(Math.round((1 - item.depth) * 900))
    }
    for (const r of runners) {
      tmp.copy(r.fig.g.position)
      tmp.y += 3.2
      tmp.project(camera)
      r.tag.style.transform = `translate(${Math.round((tmp.x * 0.5 + 0.5) * width)}px, ${Math.round((-tmp.y * 0.5 + 0.5) * height)}px) translate(-50%, -100%)`
      r.tag.style.visibility = tmp.z < 1 && r.done === 0 ? '' : 'hidden'
    }
    rooms.forEach((label) => {
      tmp.set(label.x, label.y, label.z).project(camera)
      label.el.style.transform = `translate(${Math.round((tmp.x * 0.5 + 0.5) * width)}px, ${Math.round((-tmp.y * 0.5 + 0.5) * height)}px) translate(-50%, -50%)`
      label.el.style.visibility = tmp.z < 1 ? '' : 'hidden'
    })
  }

  function start() {
    if (running) return
    running = true
    last = 0
    frameId = requestAnimationFrame(tickFrame)
  }
  function stop() {
    running = false
    cancelAnimationFrame(frameId)
  }

  function dispose() {
    stop()
    observer?.disconnect()
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('dblclick', onDouble)
    canvas.removeEventListener('pointerleave', onLeave)
    controls.dispose()
    for (const p of people.values()) removePerson(p)
    people.clear()
    for (const r of runners) removeRunner(r)
    runners.length = 0
    for (const label of rooms.values()) label.el.remove()
    rooms.clear()
    proclaim.remove()
    palace?.dispose()
    for (const m of kit.byColour.values()) m.dispose()
    kit.ramp.dispose()
    for (const thing of owned) thing.dispose?.()
    scene.clear()
    renderer.dispose()
    renderer.forceContextLoss?.()
    canvas.remove()
    container.style.background = containerBackground
  }

  frame(true)
  applySky(lastHour)

  return {
    setPeople,
    setPersonState,
    setTime,
    setGlow,
    setWeather,
    select,
    say,
    pickClient,
    flyTo,
    view,
    lookAt,
    glideTo,
    viewPoint,
    positions,
    frame: () => frame(false),
    setInset,
    start,
    stop,
    decree,
    send,
    greet,
    resize,
    dispose,
    isRunning: () => running,
  }
}
