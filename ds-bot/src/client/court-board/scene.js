// The 值房图: the court as a small white terrace floating over a sea of cloud. No palace
// to wade through — a 议事亭 in the north, the 御道 down the middle, one pale slab per
// sidebar section, and on it every official at his own desk. What each of them is doing
// shows in light and small motions rather than in words: a turning ring while he works,
// a raised 笏 when he waits on the Emperor, a seal stamped on his desk when he is done,
// closed eyes at night, and the lamp on his desk lit while he is still at it after dark.
//
// The module owns the canvas, the sky behind it and the floating tags; the title bar,
// the card, the feed and the roster are the React shell's. One factory call builds the
// world; the returned object drives it and tears it down.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PALETTE as P, SEALS, glazeFor } from './data.js'
import { LANE, meetingCentre, meetingSpots, planCourt, sectionsOf, walkPath } from './layout.js'

export const CEREMONY_MS = 5200
const WALK = 4.4
const FIG = 1.25
const HEAD_Y = 2.25 * FIG

// The sky through the day: the page behind the canvas and the light on the terrace.
const SKY = [
  { h: 0, top: '#0f1630', bottom: '#27304f', haze: '#3a4468', sun: '#9fb2ff', sunI: 0.3, hemi: 0.42, night: 1 },
  { h: 5.2, top: '#141c3a', bottom: '#333c60', haze: '#46507a', sun: '#9fb2ff', sunI: 0.3, hemi: 0.42, night: 1 },
  { h: 6.4, top: '#8e9fc8', bottom: '#f3cdb2', haze: '#f0c0a0', sun: '#ffc08e', sunI: 0.56, hemi: 0.48, night: 0.35 },
  { h: 8, top: '#c3d9e6', bottom: '#f5eee2', haze: '#efe6d6', sun: '#fff3df', sunI: 0.72, hemi: 0.54, night: 0 },
  { h: 12.5, top: '#b8d5e4', bottom: '#f4efe6', haze: '#ece6da', sun: '#fffaf0', sunI: 0.76, hemi: 0.56, night: 0 },
  { h: 16.6, top: '#bcd0df', bottom: '#f6e6cd', haze: '#f0dcc0', sun: '#ffe6bd', sunI: 0.72, hemi: 0.54, night: 0 },
  { h: 18.1, top: '#727bb0', bottom: '#f0ad8a', haze: '#e7a080', sun: '#ffa06a', sunI: 0.52, hemi: 0.46, night: 0.45 },
  { h: 19.5, top: '#18213f', bottom: '#38406a', haze: '#4a5280', sun: '#9fb2ff', sunI: 0.3, hemi: 0.42, night: 1 },
  { h: 24, top: '#0f1630', bottom: '#27304f', haze: '#3a4468', sun: '#9fb2ff', sunI: 0.3, hemi: 0.42, night: 1 },
]

// What each state's ring under a figure looks like.
const AURA = {
  work: { color: '#e0962a', arc: true },
  court: { color: '#c0392b' },
  pending: { color: '#d9a21b', pulse: true },
  question: { color: '#3f8fae', pulse: true },
  done: { color: '#b83b2c' },
  waiting: { color: '#8193b8', arc: true },
}

// The trees at the terrace's corners wear the season.
const SEASON = [
  ['#f2b8c6', '#f7d3dc'], ['#f2b8c6', '#f7d3dc'], ['#f2b8c6', '#f7d3dc'], // 春: blossom
  ['#7fb26a', '#9cc58a'], ['#7fb26a', '#9cc58a'], ['#7fb26a', '#9cc58a'], // 夏
  ['#e6a93a', '#f0c45a'], ['#e6a93a', '#f0c45a'], ['#df8a3c', '#eeb04f'], // 秋: ginkgo
  ['#e9eef2', '#ffffff'], ['#e9eef2', '#ffffff'], ['#e9eef2', '#ffffff'], // 冬: snow
]
// Months are 1..12 in the officials' time zone; the table above starts at 春 = 3.
const seasonOf = () => {
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', month: 'numeric' }).format(new Date()))
  return SEASON[(month + 9) % 12]
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
const smooth = t => t * t * (3 - 2 * t)
const ease = t => 1 - Math.pow(1 - t, 3)
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)
const css = colour => `#${colour.getHexString()}`
const prefersStill = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const angleTo = (from, to) => {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function skyAt(hour) {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < SKY.length - 2 && SKY[i + 1].h <= h) i += 1
  const a = SKY[i]
  const b = SKY[i + 1]
  const t = smooth(clamp((h - a.h) / (b.h - a.h), 0, 1))
  const lerp = key => a[key] + (b[key] - a[key]) * t
  return {
    top: mix(a.top, b.top, t), bottom: mix(a.bottom, b.bottom, t), haze: mix(a.haze, b.haze, t), sun: mix(a.sun, b.sun, t),
    sunI: lerp('sunI'), hemi: lerp('hemi'), night: lerp('night'),
  }
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif'

// A rounded rectangle lying flat, `h` tall, its top at y = h.
function slabGeometry(w, d, h, r) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  const radius = Math.min(r, w / 2, d / 2)
  shape.moveTo(x + radius, y)
  shape.lineTo(x + w - radius, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + radius)
  shape.lineTo(x + w, y + d - radius)
  shape.quadraticCurveTo(x + w, y + d, x + w - radius, y + d)
  shape.lineTo(x + radius, y + d)
  shape.quadraticCurveTo(x, y + d, x, y + d - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  const bevel = Math.min(0.14, h / 3)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: h - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, bevel, 0)
  return geometry
}

// A pavilion roof: a concave sweep from the eaves up to the finial, eight-sided.
function roofGeometry(radius, height) {
  const points = []
  const steps = 10
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    points.push(new THREE.Vector2(radius * (1 - t) + 0.05 * t, height * Math.pow(t, 1.8)))
  }
  points.unshift(new THREE.Vector2(radius * 0.92, -0.12))
  const geometry = new THREE.LatheGeometry(points, 8)
  geometry.computeVertexNormals()
  return geometry
}

export function createCourtScene({ container, tags, onSelect, onOpen, words = {}, rendererFactory = options => new THREE.WebGLRenderer(options) }) {
  const still = prefersStill()
  const renderer = rendererFactory({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.position = 'relative'
  canvas.style.touchAction = 'none'
  const containerBackground = container.style.background

  // The sky is the page behind the canvas: a gradient, a sun or moon on its arc, stars.
  const sky = document.createElement('div')
  sky.className = 'cb-sky'
  sky.setAttribute('aria-hidden', 'true')
  const orb = document.createElement('i')
  orb.className = 'cb-orb'
  const stars = document.createElement('i')
  stars.className = 'cb-stars'
  sky.append(stars, orb)
  container.append(sky, canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(22, 1, 1, 600)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minPolarAngle = 0.3
  controls.maxPolarAngle = 1.25
  controls.minDistance = 12
  controls.maxDistance = 190
  controls.screenSpacePanning = false
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.9

  const hemi = new THREE.HemisphereLight(0xf4f1ea, 0xc9bca4, 0.8)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfffaf0, 1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.02
  sun.shadow.radius = 3
  scene.add(sun, sun.target)

  // ---------------------------------------------------------------------------
  // Materials, shared by colour so one pass at the end frees them all.
  const materials = new Map()
  const mat = (colour, extra = {}) => {
    const key = `${colour}|${JSON.stringify(extra)}`
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.82, metalness: 0, ...extra }))
    return materials.get(key)
  }
  const own = (material) => { materials.set(`own-${materials.size}`, material); return material }
  const geometries = new Map()
  const geo = (key, make) => {
    if (!geometries.has(key)) geometries.set(key, make())
    return geometries.get(key)
  }
  const textures = []
  const keep = texture => { textures.push(texture); return texture }
  const blob = keep(canvasTexture(64, 64, (g, w, h) => {
    const gradient = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,.55)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, w, h)
  }))
  const mesh = (geometry, material, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geometry, material)
    m.castShadow = cast
    m.receiveShadow = receive
    return m
  }

  // ---------------------------------------------------------------------------
  // The fixed world: clouds round the terrace, rebuilt only when the terrace changes.
  const world = new THREE.Group()
  scene.add(world)
  const clouds = new THREE.Group()
  scene.add(clouds)
  const cloudMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.94 }))
  const cloudGeo = geo('cloud', () => new THREE.SphereGeometry(1, 18, 12))
  const cloudList = []
  {
    const seededCloud = [0.1, 0.9, 1.7, 2.6, 3.3, 4.2, 5.0, 5.8]
    seededCloud.forEach((angle, index) => {
      const puff = new THREE.Group()
      const parts = 3 + (index % 3)
      for (let i = 0; i < parts; i += 1) {
        const ball = mesh(cloudGeo, cloudMat, { cast: false, receive: false })
        const s = 1.0 + ((index * 7 + i * 3) % 5) * 0.25
        ball.scale.set(s * 1.35, s * 0.62, s)
        ball.position.set((i - parts / 2) * 1.3, ((i * 5) % 3) * 0.25, ((i * 3) % 2) * 0.9)
        puff.add(ball)
      }
      clouds.add(puff)
      cloudList.push({ puff, angle, speed: 0.008 + (index % 3) * 0.003, lift: -2.6 - (index % 3) * 0.9, wobble: index })
    })
  }

  // The lamplight pool and the glow sprites share one soft texture.
  const glow = (colour, opacity = 0) => {
    const material = own(new THREE.SpriteMaterial({ map: blob, color: new THREE.Color(colour), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }))
    return new THREE.Sprite(material)
  }

  let plan = { slabs: [], seats: new Map(), pavilion: { x: 0, z: -11, r: 3.1, moon: { x: 0, z: -2.5, r: 3.5 } }, bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } }
  const nightBits = [] // emissive materials and sprites that light up after dark
  const smoke = []
  let meetingOn = false
  let lastSky = skyAt(12)

  function buildWorld() {
    world.clear()
    nightBits.length = 0
    const { bounds, pavilion } = plan
    const w = bounds.maxX - bounds.minX
    const d = bounds.maxZ - bounds.minZ
    const cx = (bounds.minX + bounds.maxX) / 2
    const cz = (bounds.minZ + bounds.maxZ) / 2

    // The terrace: a white slab on a narrower, darker plinth.
    const top = mesh(slabGeometry(w, d, 1.3, 2.4), [mat('#eee6d6'), mat('#d8ccb6')])
    top.position.set(cx, -1.3, cz)
    world.add(top)
    const plinth = mesh(slabGeometry(w - 3, d - 3, 1.4, 2), mat(P.plinth))
    plinth.position.set(cx, -2.6, cz)
    world.add(plinth)
    // A faint shadow under the floating terrace, to set it in the air.
    const under = new THREE.Mesh(geo('plane', () => new THREE.PlaneGeometry(1, 1)), own(new THREE.MeshBasicMaterial({ map: blob, color: 0x3a3226, transparent: true, opacity: 0.18, depthWrite: false })))
    under.rotation.x = -Math.PI / 2
    under.scale.set(w * 1.3, d * 1.3, 1)
    under.position.set(cx, -7, cz)
    world.add(under)

    // The 御道: a pale strip edged in gold, from the 议事亭 to the south rim.
    const { moon } = pavilion
    const roadN = moon.z + moon.r - 0.2
    const roadS = bounds.maxZ - 0.6
    const road = mesh(new THREE.BoxGeometry(2.4, 0.04, roadS - roadN), mat('#e4d8c1'), { cast: false })
    road.position.set(0, 0.02, (roadN + roadS) / 2)
    world.add(road)
    for (const side of [-1, 1]) {
      const edge = mesh(new THREE.BoxGeometry(0.16, 0.05, roadS - roadN), mat(P.gold, { roughness: 0.4, metalness: 0.3 }), { cast: false })
      edge.position.set(side * 1.28, 0.03, (roadN + roadS) / 2)
      world.add(edge)
    }
    // Two 华表 at the south end of the 御道.
    for (const side of [-1, 1]) {
      const post = new THREE.Group()
      post.add(mesh(geo('hb-base', () => new THREE.CylinderGeometry(0.42, 0.5, 0.3, 8)), mat(P.marbleShade)))
      const shaft = mesh(geo('hb-shaft', () => new THREE.CylinderGeometry(0.17, 0.2, 3.2, 12)), mat(P.marble))
      shaft.position.y = 1.75
      post.add(shaft)
      const plate = mesh(geo('hb-plate', () => new THREE.BoxGeometry(1.05, 0.12, 0.22)), mat(P.marble))
      plate.position.y = 2.8
      post.add(plate)
      const cap = mesh(geo('hb-cap', () => new THREE.SphereGeometry(0.26, 14, 10)), mat(P.marble))
      cap.position.y = 3.45
      post.add(cap)
      post.position.set(side * 2.4, 0, roadS - 1.6)
      world.add(post)
    }

    // A 日晷 by the south gate. Its shadow is the sun's own, so it tells the real time.
    {
      const dial = new THREE.Group()
      const stand = mesh(geo('dial-stand', () => new THREE.CylinderGeometry(0.42, 0.55, 0.9, 10)), mat(P.marbleShade))
      stand.position.y = 0.45
      dial.add(stand)
      const face = mesh(geo('dial-face', () => new THREE.CylinderGeometry(0.85, 0.85, 0.12, 40)), mat('#f7f2e8'))
      face.position.y = 1.15
      face.rotation.x = 0.62
      dial.add(face)
      const gnomon = mesh(geo('dial-pin', () => new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6)), mat(P.ink))
      gnomon.position.set(0, 1.15, 0)
      gnomon.rotation.x = 0.62
      dial.add(gnomon)
      dial.position.set(LANE + 2.2, 0, roadS - 1.4)
      dial.rotation.y = 0
      world.add(dial)
    }

    // Trees at the four corners, in this month's colours.
    const [leafDeep, leafLight] = seasonOf()
    const corners = [[bounds.minX + 2.2, bounds.minZ + 2.2], [bounds.maxX - 2.2, bounds.minZ + 2.2], [bounds.minX + 2.2, bounds.maxZ - 2.2], [bounds.maxX - 2.2, bounds.maxZ - 2.2]]
    corners.forEach(([x, z], index) => {
      const tree = new THREE.Group()
      const trunk = mesh(geo('trunk', () => new THREE.CylinderGeometry(0.12, 0.18, 1.6, 7)), mat(P.woodDark))
      trunk.position.y = 0.8
      tree.add(trunk)
      const crowns = [[0, 2.1, 0, 1.05, leafDeep], [0.55, 2.5, 0.2, 0.75, leafLight], [-0.5, 2.35, -0.25, 0.7, leafLight]]
      for (const [px, py, pz, r, colour] of crowns) {
        const crown = mesh(geo('crown', () => new THREE.IcosahedronGeometry(1, 1)), mat(colour, { flatShading: true }))
        crown.scale.setScalar(r)
        crown.position.set(px, py, pz)
        tree.add(crown)
      }
      tree.position.set(x, 0, z)
      tree.rotation.y = index * 1.3
      world.add(tree)
    })

    // The 议事亭: an eight-sided pavilion on a round dais.
    const pav = new THREE.Group()
    const step = mesh(geo('pav-step', () => new THREE.CylinderGeometry(pavilion.r + 0.5, pavilion.r + 0.7, 0.22, 8)), mat(P.marbleShade))
    step.position.y = 0.11
    pav.add(step)
    const dais = mesh(geo('pav-dais', () => new THREE.CylinderGeometry(pavilion.r, pavilion.r + 0.15, 0.24, 8)), mat(P.marble))
    dais.position.y = 0.34
    pav.add(dais)
    const pillarGeo = geo('pav-pillar', () => new THREE.CylinderGeometry(0.13, 0.15, 2.9, 10))
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      const pillar = mesh(pillarGeo, mat(P.pillar))
      pillar.position.set(Math.sin(a) * (pavilion.r - 0.45), 0.46 + 1.45, Math.cos(a) * (pavilion.r - 0.45))
      pav.add(pillar)
    }
    const beam = mesh(geo('pav-beam', () => new THREE.CylinderGeometry(pavilion.r - 0.2, pavilion.r - 0.2, 0.32, 8, 1, true)), mat('#2f7f86', { side: THREE.DoubleSide }))
    beam.position.y = 3.25
    pav.add(beam)
    const roof = mesh(geo('pav-roof', () => roofGeometry(pavilion.r + 0.7, 2.2)), mat(P.gold, { roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide }))
    roof.position.y = 3.45
    pav.add(roof)
    const finial = mesh(geo('pav-finial', () => new THREE.SphereGeometry(0.28, 16, 12)), mat(P.goldDeep, { roughness: 0.3, metalness: 0.5 }))
    finial.position.y = 5.75
    pav.add(finial)
    // The 总册 on a round table in the middle.
    const table = mesh(geo('pav-table', () => new THREE.CylinderGeometry(0.75, 0.6, 0.62, 20)), mat(P.woodDark))
    table.position.y = 0.46 + 0.31
    pav.add(table)
    const book = mesh(geo('pav-book', () => new THREE.BoxGeometry(0.62, 0.1, 0.44)), mat('#2f5d8a'))
    book.position.y = 1.13
    book.rotation.y = 0.3
    pav.add(book)
    // A lantern under the eaves that lights at dusk.
    const lamp = mesh(geo('pav-lamp', () => new THREE.SphereGeometry(0.32, 16, 12)), own(new THREE.MeshStandardMaterial({ color: P.lantern, emissive: new THREE.Color(P.lanternGlow), emissiveIntensity: 0, roughness: 0.6 })), { cast: false })
    lamp.scale.y = 1.25
    lamp.position.y = 2.9
    pav.add(lamp)
    const lampGlow = glow(P.lanternGlow)
    lampGlow.scale.setScalar(5)
    lampGlow.position.y = 2.9
    pav.add(lampGlow)
    nightBits.push({ material: lamp.material, sprite: lampGlow, always: true, strength: 0.8 })
    pav.position.set(pavilion.x, 0, pavilion.z)
    world.add(pav)
    // A short flight of steps from the 月台 up to the pavilion.
    const stair = mesh(new THREE.BoxGeometry(1.8, 0.36, 1.2), mat(P.marbleShade))
    stair.position.set(pavilion.x, 0.18, pavilion.z + pavilion.r + 0.3)
    world.add(stair)

    // The 月台, where a meeting stands in a ring round the incense burner. Smoke rises
    // from the burner only while a meeting is on.
    const terrace = new THREE.Group()
    const ring0 = mesh(geo('moon-step', () => new THREE.CylinderGeometry(moon.r + 0.45, moon.r + 0.6, 0.14, 64)), mat(P.marbleShade))
    ring0.position.y = 0.07
    terrace.add(ring0)
    const disc = mesh(geo('moon-disc', () => new THREE.CylinderGeometry(moon.r, moon.r + 0.1, 0.18, 64)), mat(P.marble))
    disc.position.y = 0.2
    terrace.add(disc)
    const inlay = mesh(geo('moon-inlay', () => new THREE.RingGeometry(moon.r - 0.42, moon.r - 0.32, 64)), mat(P.gold, { roughness: 0.4, metalness: 0.3 }), { cast: false })
    inlay.rotation.x = -Math.PI / 2
    inlay.position.y = 0.3
    terrace.add(inlay)
    const bronze = mat('#7d6038', { roughness: 0.45, metalness: 0.45 })
    const pot = mesh(geo('ding-pot', () => new THREE.CylinderGeometry(0.42, 0.34, 0.42, 20)), bronze)
    pot.position.y = 0.72
    terrace.add(pot)
    const lid = mesh(geo('ding-lid', () => new THREE.SphereGeometry(0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), bronze)
    lid.scale.y = 0.6
    lid.position.y = 0.93
    terrace.add(lid)
    const knob = mesh(geo('ding-knob', () => new THREE.SphereGeometry(0.09, 10, 8)), mat(P.goldDeep))
    knob.position.y = 1.2
    terrace.add(knob)
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2
      const leg = mesh(geo('ding-leg', () => new THREE.CylinderGeometry(0.05, 0.04, 0.32, 6)), bronze)
      leg.position.set(Math.sin(a) * 0.26, 0.42, Math.cos(a) * 0.26)
      terrace.add(leg)
    }
    smoke.length = 0
    for (let i = 0; i < 5; i += 1) {
      const puff = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: blob, color: 0xf3efe8, transparent: true, opacity: 0, depthWrite: false })))
      puff.position.y = 1.3
      terrace.add(puff)
      smoke.push({ puff, phase: i / 5 })
    }
    terrace.position.set(moon.x, 0, moon.z)
    world.add(terrace)

    // The 班: one pale slab per section, a coloured lip along its front, its name written
    // on the floor in front of its officials.
    for (const slab of plan.slabs) {
      const glaze = glazeFor(slab.name, slab.index)
      const tint = css(mix('#eee6d6', glaze, 0.16))
      const base = mesh(slabGeometry(slab.w, slab.d, 0.16, 0.9), [mat(tint), mat(css(mix(P.marbleShade, glaze, 0.2)))], { cast: false })
      base.position.set(slab.x, 0, slab.z)
      world.add(base)
      const lip = mesh(new THREE.BoxGeometry(slab.w - 1.4, 0.04, 0.09), mat(glaze), { cast: false })
      lip.position.set(slab.x, 0.17, slab.z + slab.d / 2 - 0.22)
      world.add(lip)
      if (slab.name) {
        const ink = css(mix(glaze, P.ink, 0.35))
        const text = String(slab.name)
        const texture = keep(canvasTexture(64 + 120 * text.length, 160, (g, cw, ch) => {
          g.fillStyle = ink
          g.font = `700 104px ${SERIF}`
          g.textBaseline = 'middle'
          g.textAlign = 'center'
          const step = (cw - 64) / text.length
          ;[...text].forEach((char, i) => g.fillText(char, 32 + step * (i + 0.5), ch / 2 + 4))
        }))
        const height = 1.0
        const width = height * (64 + 120 * text.length) / 160
        const label = new THREE.Mesh(geo('plane', () => new THREE.PlaneGeometry(1, 1)), own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.9, depthWrite: false })))
        label.rotation.x = -Math.PI / 2
        label.scale.set(width, height, 1)
        const outer = slab.side < 0 ? slab.x - slab.w / 2 + width / 2 + 0.5 : slab.x + slab.w / 2 - width / 2 - 0.5
        label.position.set(outer, 0.17, slab.z + slab.d / 2 - 0.75)
        world.add(label)
      }
    }

    // The sun's shadow box follows the terrace.
    const reach = Math.max(w, d) * 0.62
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 260 })
    sun.shadow.camera.updateProjectionMatrix()
    sun.target.position.set(cx, 0, cz)
    applySky(lastSky)
  }

  // ---------------------------------------------------------------------------
  // People.
  const people = new Map()
  const tagLayer = tags ?? document.createElement('div')
  const proclaim = document.createElement('div')
  proclaim.className = 'cb-proclaim'
  proclaim.hidden = true
  tagLayer.appendChild(proclaim)
  const rooms = new Map()
  let selected = null
  let hovered = null

  function buildFigure(person) {
    const robe = person.robe
    const dark = css(mix(robe, '#1d1712', 0.35))
    const fig = new THREE.Group()
    const body = new THREE.Group()
    fig.add(body)
    const robeGeo = geo('robe', () => new THREE.LatheGeometry([
      [0, 0], [0.56, 0], [0.56, 0.08], [0.48, 0.45], [0.38, 0.86], [0.3, 1.02], [0.16, 1.1], [0, 1.12],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 28))
    body.add(mesh(robeGeo, mat(robe, { roughness: 0.7 })))
    // The 补子 on the chest marks the rank; the 首辅's is gold.
    const badge = mesh(geo('badge', () => new THREE.BoxGeometry(0.3, 0.28, 0.03)), mat(person.main ? P.gold : css(mix(robe, '#fff6e2', 0.55))), { cast: false })
    badge.position.set(0, 0.72, 0.4)
    badge.rotation.x = -0.18
    body.add(badge)
    const belt = mesh(geo('belt', () => new THREE.TorusGeometry(0.45, 0.04, 6, 28)), mat(person.main ? P.goldDeep : dark))
    belt.rotation.x = Math.PI / 2
    belt.position.y = 0.48
    body.add(belt)
    const hands = mesh(geo('hands', () => new THREE.SphereGeometry(0.14, 14, 10)), mat(dark))
    hands.scale.set(1.5, 1, 1)
    hands.position.set(0, 0.62, 0.44)
    body.add(hands)
    // The 笏 he holds before him, raised over his head when he waits on the Emperor.
    const plank = mesh(geo('plank', () => new THREE.BoxGeometry(0.13, 0.52, 0.035)), mat('#f4ead2'))
    plank.position.set(0, 0.86, 0.52)
    plank.rotation.x = -0.25
    body.add(plank)

    const head = new THREE.Group()
    head.position.y = 1.42
    body.add(head)
    head.add(mesh(geo('head', () => new THREE.SphereGeometry(0.34, 24, 18)), mat(P.skin, { roughness: 0.65 })))
    const eyes = []
    for (const side of [-1, 1]) {
      const eye = mesh(geo('eye', () => new THREE.SphereGeometry(0.038, 10, 8)), mat(P.ink, { roughness: 0.3 }), { cast: false })
      eye.position.set(side * 0.115, 0.02, 0.31)
      head.add(eye)
      eyes.push(eye)
      const cheek = mesh(geo('cheek', () => new THREE.SphereGeometry(0.06, 10, 8)), own(new THREE.MeshBasicMaterial({ color: P.blush, transparent: true, opacity: 0.55 })), { cast: false })
      cheek.scale.set(1, 0.6, 0.4)
      cheek.position.set(side * 0.2, -0.07, 0.28)
      head.add(cheek)
    }
    // Hair on the back of the head, so a figure seen from behind reads as his back.
    const hair = mesh(geo('hair', () => new THREE.SphereGeometry(0.352, 24, 14, Math.PI * 1.08, Math.PI * 0.84, 0, Math.PI * 0.68)), mat(P.hatInk, { roughness: 0.6 }), { cast: false })
    head.add(hair)
    head.add(hatFor(person.hat, robe))

    // The thought he is turning over: a small warm light above his head.
    const thought = glow('#ffd28a')
    thought.scale.setScalar(0.9)
    thought.position.y = 2.08
    fig.add(thought)

    fig.scale.setScalar(FIG)
    return { fig, body, head, eyes, plank, thought }
  }

  function hatFor(kind, robe) {
    const hat = new THREE.Group()
    const ink = mat(P.hatInk, { roughness: 0.45 })
    if (kind === 'nei') {
      const cap = mesh(geo('nei-cap', () => new THREE.CylinderGeometry(0.3, 0.27, 0.36, 20)), ink)
      cap.position.y = 0.3
      hat.add(cap)
      const band = mesh(geo('nei-band', () => new THREE.CylinderGeometry(0.305, 0.305, 0.07, 20)), mat(robe))
      band.position.y = 0.16
      hat.add(band)
    } else if (kind === 'jyw') {
      const brim = mesh(geo('jyw-brim', () => new THREE.CylinderGeometry(0.56, 0.56, 0.04, 28)), ink)
      brim.position.y = 0.2
      hat.add(brim)
      const dome = mesh(geo('jyw-dome', () => new THREE.SphereGeometry(0.27, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), ink)
      dome.position.y = 0.2
      hat.add(dome)
      const tassel = mesh(geo('jyw-tassel', () => new THREE.SphereGeometry(0.07, 10, 8)), mat('#c0392b'))
      tassel.position.y = 0.5
      hat.add(tassel)
    } else if (kind === 'fj') {
      const cap = mesh(geo('fj-cap', () => new THREE.BoxGeometry(0.5, 0.3, 0.5)), ink)
      cap.position.y = 0.3
      cap.rotation.y = Math.PI / 4
      hat.add(cap)
    } else if (kind === 'dao') {
      const hair = mesh(geo('dao-hair', () => new THREE.SphereGeometry(0.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2)), ink)
      hair.position.y = 0.02
      hat.add(hair)
      const bun = mesh(geo('dao-bun', () => new THREE.SphereGeometry(0.15, 14, 10)), ink)
      bun.position.y = 0.4
      hat.add(bun)
      const pin = mesh(geo('dao-pin', () => new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6)), mat(P.gold))
      pin.position.y = 0.42
      pin.rotation.z = Math.PI / 2
      hat.add(pin)
    } else {
      // 乌纱帽: a round crown, a raised back and two wings.
      const crown = mesh(geo('ws-crown', () => new THREE.CylinderGeometry(0.29, 0.31, 0.24, 22)), ink)
      crown.position.y = 0.24
      hat.add(crown)
      const back = mesh(geo('ws-back', () => new THREE.SphereGeometry(0.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), ink)
      back.position.set(0, 0.35, -0.08)
      hat.add(back)
      for (const side of [-1, 1]) {
        const wing = mesh(geo('ws-wing', () => new THREE.BoxGeometry(0.46, 0.035, 0.11)), ink)
        wing.position.set(side * 0.47, 0.28, -0.14)
        wing.rotation.z = side * 0.1
        hat.add(wing)
      }
    }
    return hat
  }

  // The desk, the mat and the lamp at a seat; they stay when the official walks away.
  function buildDesk(person, seat) {
    const desk = new THREE.Group()
    const matTile = mesh(slabGeometry(1.7, 1.6, 0.07, 0.3), mat(person.main ? '#f1dfae' : '#e8dcc4'), { cast: false })
    desk.add(matTile)
    const top = mesh(slabGeometry(1.75, 0.68, 0.1, 0.12), mat('#4a2f22', { roughness: 0.55 }))
    top.position.set(0, 0.46, 1.05)
    desk.add(top)
    for (const side of [-1, 1]) {
      const leg = mesh(geo('desk-leg', () => new THREE.BoxGeometry(0.12, 0.46, 0.5)), mat('#3a241a'))
      leg.position.set(side * 0.72, 0.23, 1.05)
      desk.add(leg)
    }
    const paper = mesh(geo('desk-paper', () => new THREE.BoxGeometry(0.62, 0.02, 0.42)), mat(P.paper), { cast: false })
    paper.position.set(-0.12, 0.57, 1.05)
    paper.rotation.y = 0.08
    desk.add(paper)
    const inkstone = mesh(geo('desk-ink', () => new THREE.BoxGeometry(0.26, 0.06, 0.2)), mat('#2c2a2a'))
    inkstone.position.set(0.42, 0.59, 0.98)
    desk.add(inkstone)
    const brush = new THREE.Group()
    const shaft = mesh(geo('desk-brush', () => new THREE.CylinderGeometry(0.022, 0.022, 0.46, 6)), mat(P.wood))
    shaft.rotation.z = Math.PI / 2
    brush.add(shaft)
    const tip = mesh(geo('desk-tip', () => new THREE.ConeGeometry(0.035, 0.1, 6)), mat(P.ink))
    tip.rotation.z = Math.PI / 2
    tip.position.x = -0.27
    brush.add(tip)
    brush.position.set(-0.1, 0.6, 1.24)
    desk.add(brush)
    // The lamp: a paper shade that lights at night while its official is awake.
    const shade = own(new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: new THREE.Color(P.lanternGlow), emissiveIntensity: 0, roughness: 0.8 }))
    const lamp = mesh(geo('desk-lamp', () => new THREE.CylinderGeometry(0.11, 0.13, 0.26, 12)), shade, { cast: false })
    lamp.position.set(0.72, 0.68, 0.9)
    desk.add(lamp)
    const lampGlow = glow(P.lanternGlow)
    lampGlow.scale.setScalar(2.4)
    lampGlow.position.set(0.72, 0.7, 0.9)
    desk.add(lampGlow)
    // The seal that comes down on his paper when the work is done.
    const stamp = new THREE.Group()
    const block = mesh(geo('stamp-block', () => new THREE.BoxGeometry(0.22, 0.2, 0.22)), mat(P.vermilion))
    stamp.add(block)
    const knob = mesh(geo('stamp-knob', () => new THREE.SphereGeometry(0.09, 10, 8)), mat(P.goldDeep))
    knob.position.y = 0.14
    stamp.add(knob)
    stamp.position.set(-0.12, 0.69, 1.05)
    stamp.visible = false
    desk.add(stamp)
    const mark = mesh(geo('stamp-mark', () => new THREE.PlaneGeometry(0.2, 0.2)), own(new THREE.MeshBasicMaterial({ color: P.vermilion, transparent: true, opacity: 0, depthWrite: false })), { cast: false })
    mark.rotation.x = -Math.PI / 2
    mark.rotation.z = 0.12
    mark.position.set(0.04, 0.585, 1.12)
    desk.add(mark)
    // Sheets that rise from the desk while he sends things off.
    const sheets = []
    for (let i = 0; i < 3; i += 1) {
      const sheet = mesh(geo('sheet', () => new THREE.PlaneGeometry(0.26, 0.34)), own(new THREE.MeshBasicMaterial({ color: P.paper, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })), { cast: false })
      sheet.position.set(0, 0.6, 1.05)
      desk.add(sheet)
      sheets.push({ sheet, phase: i / 3 })
    }
    desk.position.set(seat.x, 0.16, seat.z)
    nightBits.push({ material: shade, sprite: lampGlow, person: person.id, strength: 0.75 })
    return { desk, brush, stamp, mark, sheets }
  }

  const ringGeo = geo('ring', () => new THREE.RingGeometry(0.92, 1.06, 56))
  const arcGeo = geo('arc', () => new THREE.RingGeometry(0.92, 1.06, 56, 1, 0, Math.PI * 1.35))
  function buildAura() {
    const material = own(new THREE.MeshBasicMaterial({ color: '#e0962a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
    const ring = new THREE.Mesh(ringGeo, material)
    ring.rotation.x = -Math.PI / 2
    const arc = new THREE.Mesh(arcGeo, material)
    arc.rotation.x = -Math.PI / 2
    const select = new THREE.Mesh(geo('sel-ring', () => new THREE.RingGeometry(1.18, 1.26, 64)), own(new THREE.MeshBasicMaterial({ color: P.vermilion, transparent: true, opacity: 0, depthWrite: false })))
    select.rotation.x = -Math.PI / 2
    return { ring, arc, material, select }
  }

  function buildTag(person) {
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
    el.addEventListener('click', (event) => { event.stopPropagation(); onSelect?.(person.id) })
    el.addEventListener('dblclick', (event) => { event.stopPropagation(); onOpen?.(person.id) })
    el.addEventListener('pointerenter', () => setHover(person.id))
    el.addEventListener('pointerleave', () => setHover(null))
    tagLayer.appendChild(el)
    return { el, bub, seal, txt, time, office, name, w: 0, h: 0 }
  }

  function paintTag(p) {
    const { tag, data, state } = p
    const kind = state.kind ?? 'idle'
    const seal = SEALS[kind]
    tag.el.dataset.kind = kind
    tag.el.dataset.motion = state.motion ?? ''
    tag.el.classList.toggle('main', data.main === true)
    tag.office.textContent = data.office && data.office !== data.name ? data.office : ''
    tag.name.textContent = data.name
    tag.seal.textContent = seal ? seal.word : ''
    tag.seal.hidden = !seal
    const line = kind === 'work' ? state.text
      : kind === 'court' ? (state.speaking ? words.speaking : '')
        : kind === 'pending' ? words.pending
          : kind === 'question' ? words.question
            : kind === 'done' ? words.done
              : kind === 'waiting' ? state.text
                : ''
    tag.txt.textContent = line ?? ''
    tag.bub.hidden = !line && !seal
    tag.time.textContent = kind === 'work' ? clock(state.since) : ''
    tag.w = 0
  }

  const clock = (since) => {
    if (!since) return ''
    const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000))
    const m = Math.floor(seconds / 60)
    if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    return `${m}:${String(seconds % 60).padStart(2, '0')}`
  }

  function removePerson(p) {
    scene.remove(p.fig)
    world.remove(p.deskParts.desk)
    scene.remove(p.aura.ring, p.aura.arc, p.aura.select, p.pick)
    p.tag.el.remove()
    if (p.line) { scene.remove(p.line); p.line.geometry.dispose() }
  }

  const pickGeo = geo('pick', () => new THREE.CylinderGeometry(0.8, 0.8, 2.6, 8))
  const pickMat = own(new THREE.MeshBasicMaterial({ visible: false }))

  function setPeople(list) {
    const cast = Array.isArray(list) ? list : []
    const before = new Map([...people].map(([id, p]) => [id, p.state]))
    for (const p of people.values()) removePerson(p)
    people.clear()
    nightBits.length = 0
    plan = planCourt(sectionsOf(cast, words.unfiled ?? ''))
    buildWorld()
    for (const data of cast) {
      const seat = plan.seats.get(data.id)
      if (!seat) continue
      const parts = buildFigure(data)
      const deskParts = buildDesk(data, seat)
      world.add(deskParts.desk)
      const aura = buildAura()
      scene.add(parts.fig, aura.ring, aura.arc, aura.select)
      const pick = new THREE.Mesh(pickGeo, pickMat)
      pick.userData.id = data.id
      scene.add(pick)
      const p = {
        id: data.id, data, seat, ...parts, deskParts, aura, pick,
        tag: buildTag(data),
        state: before.get(data.id) ?? data.state ?? { kind: 'idle', text: '' },
        pos: new THREE.Vector3(seat.x, 0.16, seat.z),
        yaw: 0, goalYaw: 0, path: [], away: false, spot: null,
        blink: 2 + Math.random() * 4, hop: 0, stampT: -1, line: null, seed: Math.random() * 10,
      }
      people.set(p.id, p)
      paintTag(p)
    }
    // A Bot already away in a meeting is placed there at once, not walked from his desk.
    placeMeetings(true)
    for (const p of people.values()) applyState(p, null, true)
    select(selected)
    frame(true)
  }

  // ---------------------------------------------------------------------------
  // States.
  function setPersonState(id, state) {
    const p = people.get(id)
    if (!p || !state) return
    const was = p.state
    p.state = state
    if (was && was.kind === state.kind && was.text === state.text && was.room === state.room && was.speaking === state.speaking && was.towards === state.towards && was.since === state.since && was.motion === state.motion) return
    paintTag(p)
    if (!was || was.kind !== state.kind || was.room !== state.room) placeMeetings(false)
    applyState(p, was, false)
  }

  function applyState(p, was, instant) {
    const kind = p.state.kind
    const aura = AURA[kind]
    if (aura) p.aura.material.color.set(aura.color)
    // A new seal comes down when the work is done.
    if (kind === 'done' && was?.kind !== 'done') p.stampT = instant || still ? 1 : 0
    if (kind !== 'done') { p.stampT = -1; p.deskParts.stamp.visible = false; p.deskParts.mark.material.opacity = 0 }
    if (!instant && was && was.kind !== kind && aura) ripple(p.pos.x, p.pos.z, aura.color)
    // A waiting official looks toward the one he waits on, and a faint thread joins them.
    if (p.line) { scene.remove(p.line); p.line.geometry.dispose(); p.line = null }
    if (kind === 'waiting' && p.state.towards && people.has(p.state.towards)) p.line = threadBetween(p, people.get(p.state.towards))
  }

  const threadMat = own(new THREE.LineDashedMaterial({ color: '#8193b8', dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.75 }))
  function threadBetween(a, b) {
    const from = new THREE.Vector3(a.seat.x, 2.4, a.seat.z)
    const to = new THREE.Vector3(b.seat.x, 2.4, b.seat.z)
    const mid = from.clone().lerp(to, 0.5)
    mid.y += 1.5 + from.distanceTo(to) * 0.18
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), threadMat)
    line.computeLineDistances()
    scene.add(line)
    return line
  }

  // Who stands where in each meeting. Rooms take the 议事亭 in the order their first
  // member comes in the sidebar.
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
      if (p.state.kind === 'court') continue
      if (p.away) goHome(p, instant)
    }
    order.forEach((room, index) => {
      const list = members.get(room)
      const spots = meetingSpots(plan.pavilion, index, list.length)
      list.forEach((p, i) => {
        const spot = spots[i]
        if (p.spot && Math.hypot(p.spot.x - spot.x, p.spot.z - spot.z) < 0.05) return
        p.spot = spot
        if (instant || still) {
          p.pos.set(spot.x, index === 0 ? 0.29 : 0.04, spot.z)
          p.yaw = p.goalYaw = spot.face
          p.path = []
        } else if (p.away) {
          p.path = [{ x: spot.x, z: spot.z }]
        } else {
          p.path = walkPath(p.seat, spot).slice(1)
        }
        p.away = true
      })
    })
    meetingOn = order.length > 0
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
      const centre = meetingCentre(plan.pavilion, index)
      label.x = centre.x
      label.z = centre.z
      label.y = 0.3
      label.z = centre.z + (index === 0 ? plan.pavilion.moon.r + 0.9 : 2.4)
      const name = list[0].state.text ?? ''
      label.el.textContent = `${words.court ?? ''}${name ? ` · ${name}` : ''} · ${list.length}${words.people ?? ''}`
    })
  }

  function goHome(p, instant) {
    p.spot = null
    p.away = false
    if (instant || still) {
      p.pos.set(p.seat.x, 0.16, p.seat.z)
      p.path = []
      p.yaw = p.goalYaw = 0
      return
    }
    const path = walkPath(p.seat, { x: p.pos.x, z: p.pos.z }).reverse().slice(1)
    p.path = path
  }

  // ---------------------------------------------------------------------------
  // Passing effects: a ring of light spreading on the floor, and the 宣旨 scrolls.
  const effects = []
  const rippleGeo = geo('ripple', () => new THREE.RingGeometry(0.9, 1.05, 56))
  function ripple(x, z, colour, size = 1.5) {
    if (still) return
    const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, depthWrite: false })
    const ring = new THREE.Mesh(rippleGeo, material)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, 0.2, z)
    scene.add(ring)
    effects.push({ t: 0, duration: 1.1, tick: (k) => {
      ring.scale.setScalar(1 + size * ease(k))
      material.opacity = 0.7 * (1 - k)
    }, end: () => { scene.remove(ring); material.dispose() } })
  }

  let proclaimUntil = 0
  function decree({ from, to, room }) {
    const giver = people.get(from)
    if (!giver) return
    const targets = room
      ? [{ x: plan.pavilion.moon.x, z: plan.pavilion.moon.z, y: 1.3, id: null }]
      : (to ?? []).map(id => people.get(id)).filter(Boolean).map(p => ({ x: p.pos.x, z: p.pos.z, y: HEAD_Y, id: p.id }))
    const names = room ? '' : (to ?? []).map(id => people.get(id)?.data.name).filter(Boolean).join('、')
    proclaim.textContent = `${words.decree ?? ''}${names ? ` · ${names}` : ''}`
    proclaim.hidden = false
    proclaimUntil = performance.now() + CEREMONY_MS
    giver.hop = 1
    if (still) return
    targets.forEach((target, index) => {
      const scroll = new THREE.Group()
      const roll = mesh(geo('scroll', () => new THREE.CylinderGeometry(0.13, 0.13, 0.8, 14)), mat(P.gold, { roughness: 0.35, metalness: 0.3 }), { cast: false })
      roll.rotation.z = Math.PI / 2
      scroll.add(roll)
      for (const side of [-1, 1]) {
        const end = mesh(geo('scroll-end', () => new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14)), mat(P.vermilion), { cast: false })
        end.rotation.z = Math.PI / 2
        end.position.x = side * 0.42
        scroll.add(end)
      }
      const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: blob, color: new THREE.Color(P.gold), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))
      shine.scale.setScalar(1.6)
      scroll.add(shine)
      scroll.visible = false
      scene.add(scroll)
      const start = new THREE.Vector3(giver.pos.x, HEAD_Y + 0.4, giver.pos.z)
      const end = new THREE.Vector3(target.x, target.y, target.z)
      const mid = start.clone().lerp(end, 0.5)
      mid.y += 4 + start.distanceTo(end) * 0.25
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      effects.push({ t: -0.22 * index - 0.35, duration: 1.5, tick: (k) => {
        scroll.visible = true
        scroll.position.copy(curve.getPoint(ease(k)))
        scroll.rotation.y = k * 6
      }, end: () => {
        scene.remove(scroll)
        shine.material.dispose()
        ripple(target.x, target.z, P.gold, 2.2)
        if (target.id) { const p = people.get(target.id); if (p) p.hop = 1 }
      } })
    })
  }

  // ---------------------------------------------------------------------------
  // Selection, hover, picking.
  function setHover(id) {
    if (hovered === id) return
    if (hovered) people.get(hovered)?.tag.el.classList.remove('hover')
    hovered = id
    if (id) people.get(id)?.tag.el.classList.add('hover')
    canvas.style.cursor = id ? 'pointer' : ''
  }

  function select(id) {
    selected = id && people.has(id) ? id : null
    for (const p of people.values()) p.tag.el.classList.toggle('sel', p.id === selected)
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pickAt = (event) => {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects([...people.values()].map(p => p.pick), false)[0]
    return hit?.object.userData.id ?? null
  }
  let down = null
  const onDown = (event) => { down = { x: event.clientX, y: event.clientY }; flight = null }
  const onUp = (event) => {
    if (!down) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    down = null
    if (moved > 5 || event.button !== 0) return
    onSelect?.(pickAt(event))
  }
  const onMove = (event) => { if (event.buttons === 0) setHover(pickAt(event)) }
  const onDouble = (event) => { const id = pickAt(event); if (id) onOpen?.(id) }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('dblclick', onDouble)
  canvas.addEventListener('pointerleave', () => setHover(null))
  controls.addEventListener('start', () => { flight = null })

  // ---------------------------------------------------------------------------
  // Camera.
  let flight = null
  const view = { azimuth: -0.14, polar: 0.84 }
  function aim(target, distance, instant, keepAngles = false) {
    const offset = new THREE.Vector3().setFromSphericalCoords(distance, view.polar, view.azimuth)
    if (!instant && keepAngles && camera.position.lengthSq() > 0) {
      const keepAngle = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(keepAngle)
      offset.setFromSphericalCoords(distance, clamp(spherical.phi, 0.55, 1.1), spherical.theta)
    }
    const position = target.clone().add(offset)
    if (instant || still) {
      controls.target.copy(target)
      camera.position.copy(position)
      controls.update()
      return
    }
    flight = { t: 0, fromTarget: controls.target.clone(), fromPos: camera.position.clone(), toTarget: target, toPos: position }
  }

  // The view that just holds the whole terrace: the camera backs off until every corner
  // of the terrace's box falls inside the frame.
  function frame(instant) {
    const { bounds } = plan
    const target = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2 + 0.5)
    const corners = []
    for (const x of [bounds.minX, bounds.maxX]) for (const y of [-1.3, 6]) for (const z of [bounds.minZ, bounds.maxZ]) corners.push(new THREE.Vector3(x, y, z))
    const probe = camera.clone()
    probe.clearViewOffset()
    probe.aspect = camera.aspect
    probe.updateProjectionMatrix()
    const offset = new THREE.Vector3()
    const fits = (distance) => {
      offset.setFromSphericalCoords(distance, view.polar, view.azimuth)
      probe.position.copy(target).add(offset)
      probe.lookAt(target)
      probe.updateMatrixWorld()
      return corners.every(c => {
        const v = c.clone().project(probe)
        return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.9 && v.z < 1
      })
    }
    let low = 10
    let high = 400
    for (let i = 0; i < 24; i += 1) {
      const mid = (low + high) / 2
      if (fits(mid)) high = mid
      else low = mid
    }
    const saved = { ...view }
    aim(target, high, instant)
    Object.assign(view, saved)
  }

  function flyTo(id) {
    const p = people.get(id)
    if (!p) return
    aim(new THREE.Vector3(p.pos.x, 1.2, p.pos.z + 0.6), 24, false, true)
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
  // Time of day.
  let minutesNow = 12 * 60
  function setTime(minutes) {
    minutesNow = minutes
    lastSky = skyAt(minutes / 60)
    applySky(lastSky)
  }

  function applySky(s) {
    const hour = minutesNow / 60
    container.style.background = `radial-gradient(120% 70% at 50% 108%, ${css(s.haze)} 0%, transparent 62%), linear-gradient(180deg, ${css(s.top)} 0%, ${css(s.bottom)} 100%)`
    sky.style.setProperty('--cb-night', s.night.toFixed(3))
    // The sun climbs from the left of the frame at six to the right at six; the moon
    // takes the night shift on the same arc.
    const day = hour >= 6 && hour < 18
    const k = day ? (hour - 6) / 12 : (((hour - 18) % 24 + 24) % 24) / 12
    orb.style.left = `${8 + k * 84}%`
    orb.style.top = `${30 - Math.sin(k * Math.PI) * 22}%`
    orb.dataset.moon = day ? 'false' : 'true'

    const sunAngle = clamp((hour - 6) / 12, -0.1, 1.1) * Math.PI
    const r = 80
    if (day) sun.position.set(Math.cos(sunAngle) * r, Math.max(0.25, Math.sin(sunAngle)) * r, 30 + Math.sin(sunAngle) * 30)
    else sun.position.set(-40, 70, 50)
    sun.position.add(sun.target.position)
    sun.color.copy(s.sun)
    sun.intensity = s.sunI
    hemi.intensity = s.hemi
    hemi.color.copy(mix('#f4f1ea', '#8ea0d8', s.night))
    hemi.groundColor.copy(mix('#c9bca4', '#3a3a52', s.night))
    cloudMat.color.copy(mix('#ffffff', '#9aa6cc', s.night * 0.8))
    lightLamps()
  }

  function lightLamps() {
    const night = lastSky.night
    for (const bit of nightBits) {
      let on = bit.always ? 1 : 0
      if (bit.person) {
        const kind = people.get(bit.person)?.state.kind
        on = kind === 'sleep' || kind === 'idle' ? 0.08 : 1
      }
      const level = night * on * bit.strength
      bit.material.emissiveIntensity = level * 1.4
      bit.sprite.material.opacity = level * 0.9
    }
  }

  // ---------------------------------------------------------------------------
  // The loop.
  let running = false
  let frameId = 0
  let last = 0
  let clockTick = 0
  const projected = new THREE.Vector3()

  function tick(now) {
    if (!running) return
    frameId = requestAnimationFrame(tick)
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
    last = now
    const t = now / 1000

    if (flight) {
      flight.t = Math.min(1, flight.t + dt / 0.9)
      const k = ease(flight.t)
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k)
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k)
      if (flight.t >= 1) flight = null
    }
    if (Math.abs(insetNow - inset) > 0.5) {
      insetNow += (inset - insetNow) * Math.min(1, dt * 8)
      applyInset()
    }
    controls.update()

    for (const c of cloudList) {
      if (!still) c.angle += c.speed * dt
      const { bounds } = plan
      const rx = (bounds.maxX - bounds.minX) / 2 + 6
      const rz = (bounds.maxZ - bounds.minZ) / 2 + 6
      c.puff.position.set(Math.cos(c.angle) * rx, c.lift + Math.sin(t * 0.3 + c.wobble) * 0.3, (bounds.minZ + bounds.maxZ) / 2 + Math.sin(c.angle) * rz)
      c.puff.rotation.y = -c.angle
    }

    lightLamps()
    for (const s of smoke) {
      if (!still) s.phase = (s.phase + dt * 0.22) % 1
      const k = s.phase
      s.puff.position.set(Math.sin(k * 7 + s.phase * 3) * 0.25 * k, 1.3 + k * 3.2, Math.cos(k * 5) * 0.15 * k)
      s.puff.scale.setScalar(0.5 + k * 1.6)
      const target = meetingOn ? Math.sin(k * Math.PI) * 0.55 : 0
      s.puff.material.opacity += (target - s.puff.material.opacity) * Math.min(1, dt * 3)
    }
    for (const p of people.values()) animatePerson(p, dt, t)

    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const e = effects[i]
      e.t += dt / e.duration
      if (e.t < 0) continue
      e.tick(Math.min(1, e.t))
      if (e.t >= 1) { e.end?.(); effects.splice(i, 1) }
    }
    if (!proclaim.hidden && now > proclaimUntil) proclaim.hidden = true

    renderer.render(scene, camera)
    placeTags()
    if (now - clockTick > 1000) {
      clockTick = now
      for (const p of people.values()) if (p.state.kind === 'work') p.tag.time.textContent = clock(p.state.since)
    }
  }

  function animatePerson(p, dt, t) {
    const kind = p.state.kind
    const motion = p.state.motion
    // Walking.
    if (p.path.length > 0) {
      const next = p.path[0]
      const dx = next.x - p.pos.x
      const dz = next.z - p.pos.z
      const dist = Math.hypot(dx, dz)
      const stepLen = WALK * dt
      if (dist <= stepLen) {
        p.pos.x = next.x
        p.pos.z = next.z
        p.path.shift()
      } else {
        p.pos.x += (dx / dist) * stepLen
        p.pos.z += (dz / dist) * stepLen
      }
      if (dist > 0.01) p.goalYaw = Math.atan2(dx, dz)
      const onDais = Math.hypot(p.pos.x - plan.pavilion.moon.x, p.pos.z - plan.pavilion.moon.z) < plan.pavilion.moon.r
      const onSlab = !p.away || Math.hypot(p.pos.x - p.seat.x, p.pos.z - p.seat.z) < 1.4
      p.pos.y = onDais ? 0.29 : onSlab && !p.away ? 0.16 : 0.04
      p.body.position.y = Math.abs(Math.sin(t * 11)) * 0.12
      p.body.rotation.z = Math.sin(t * 11) * 0.06
    } else {
      p.body.rotation.z *= 0.8
      // Facing: south at the desk, the ring's middle in a meeting, the one he waits on.
      if (p.away && p.spot) p.goalYaw = p.spot.face
      else if (kind === 'waiting' && p.state.towards && people.has(p.state.towards)) {
        const other = people.get(p.state.towards)
        p.goalYaw = clamp(Math.atan2(other.pos.x - p.pos.x, other.pos.z - p.pos.z), -1.1, 1.1)
      } else p.goalYaw = 0
      if (!p.away && Math.hypot(p.pos.x - p.seat.x, p.pos.z - p.seat.z) < 0.01) p.pos.y = 0.16
      // Breathing, and a little more life for some states.
      const breath = Math.sin(t * 1.6 + p.seed) * 0.012
      p.body.scale.set(1, 1 + breath, 1)
      let bob = 0
      if (kind === 'court' && p.state.speaking) bob = Math.abs(Math.sin(t * 6)) * 0.08
      if (kind === 'pending' || kind === 'question') bob = Math.abs(Math.sin(t * 2.6)) * 0.05
      p.body.position.y = bob
    }
    if (p.hop > 0) {
      p.hop = Math.max(0, p.hop - dt * 1.6)
      p.body.position.y += Math.sin((1 - p.hop) * Math.PI) * 0.5
    }
    p.yaw += angleTo(p.yaw, p.goalYaw) * Math.min(1, dt * 7)
    p.fig.position.copy(p.pos)
    p.fig.rotation.y = p.yaw

    // Leaning to the desk while working; a nod while asleep.
    const working = kind === 'work' && !p.away
    const lean = working ? 0.12 : kind === 'sleep' ? 0.22 : 0
    p.body.rotation.x += (lean - p.body.rotation.x) * Math.min(1, dt * 4)
    p.head.rotation.y = working && motion === 'searching' ? Math.sin(t * 2.4 + p.seed) * 0.55 : p.head.rotation.y * 0.9
    p.head.rotation.x = kind === 'sleep' ? 0.18 + Math.sin(t * 1.2 + p.seed) * 0.04 : p.head.rotation.x * 0.9

    // Eyes: closed asleep, a blink now and then otherwise.
    p.blink -= dt
    let eye = kind === 'sleep' ? 0.15 : 1
    if (kind !== 'sleep' && p.blink < 0.12) eye = 0.12
    if (p.blink < 0) p.blink = 2.5 + Math.random() * 4
    for (const e of p.eyes) e.scale.y = eye

    // The 笏: before him, or held high when he waits on the Emperor.
    const raised = kind === 'pending' || kind === 'question'
    const plankY = raised ? 2.15 : 0.86
    p.plank.position.y += (plankY - p.plank.position.y) * Math.min(1, dt * 6)
    p.plank.position.z += ((raised ? 0.3 : 0.52) - p.plank.position.z) * Math.min(1, dt * 6)
    p.plank.rotation.x += ((raised ? 0 : -0.25) - p.plank.rotation.x) * Math.min(1, dt * 6)

    // A thinking light above him.
    const thinking = working && (motion === 'thinking' || motion === 'working')
    const thoughtTarget = thinking ? 0.55 + Math.sin(t * 2.2 + p.seed) * 0.25 : 0
    p.thought.material.opacity += (thoughtTarget - p.thought.material.opacity) * Math.min(1, dt * 4)
    p.thought.position.y = 2.1 + Math.sin(t * 1.4 + p.seed) * 0.06

    // The brush writes while he works.
    const { brush, sheets, stamp, mark } = p.deskParts
    brush.rotation.y = working ? Math.sin(t * 9 + p.seed) * 0.35 : brush.rotation.y * 0.9
    brush.position.y = working ? 0.62 + Math.abs(Math.sin(t * 9 + p.seed)) * 0.04 : 0.6
    for (const s of sheets) {
      if (working && motion === 'sending' && !still) {
        s.phase = (s.phase + dt * 0.45) % 1
        const k = s.phase
        s.sheet.position.set(-0.1 + Math.sin(k * 6 + p.seed) * 0.25, 0.7 + k * 2.4, 1.05 - k * 0.6)
        s.sheet.rotation.set(k * 2, k * 4, k)
        s.sheet.material.opacity = Math.sin(k * Math.PI) * 0.95
      } else {
        s.sheet.material.opacity *= 0.85
      }
    }

    // The seal: it drops, presses, and leaves its mark.
    if (p.stampT >= 0 && p.stampT < 1.6) {
      p.stampT = Math.min(1.6, p.stampT + dt)
      const k = p.stampT
      stamp.visible = true
      if (k < 0.45) stamp.position.y = 0.69 + (1 - ease(k / 0.45)) * 1.4
      else if (k < 0.6) { stamp.position.y = 0.66; mark.material.opacity = 0.9 }
      else stamp.position.y = 0.69 + Math.min(1, (k - 0.6) / 0.4) * 0.12
      stamp.scale.y = k > 0.42 && k < 0.6 ? 0.82 : 1
      stamp.position.x = k < 0.6 ? -0.12 : -0.12 + Math.min(1, (k - 0.6) / 0.4) * 0.18
    }

    // The ring under him.
    const aura = AURA[kind]
    const { ring, arc, material, select: sel } = p.aura
    ring.position.set(p.pos.x, p.pos.y + 0.02, p.pos.z)
    arc.position.copy(ring.position)
    sel.position.copy(ring.position)
    ring.visible = !!aura && !aura.arc
    arc.visible = !!aura && aura.arc
    const speed = motion === 'searching' ? 3.2 : 1.4
    if (arc.visible && !still) arc.rotation.z -= dt * (kind === 'waiting' ? 0.6 : speed)
    let alpha = aura ? 0.85 : 0
    if (aura?.pulse) alpha = 0.45 + Math.abs(Math.sin(t * 2.6)) * 0.5
    material.opacity += (alpha - material.opacity) * Math.min(1, dt * 6)
    sel.material.opacity += ((p.id === selected ? 0.9 : p.id === hovered ? 0.35 : 0) - sel.material.opacity) * Math.min(1, dt * 10)

    p.pick.position.set(p.pos.x, 1.3, p.pos.z + 0.3)
  }

  // Which tag keeps its place when two meet: the one the Emperor is looking at, then the
  // one waiting on him, then the busy, then the rest.
  const RANK = { pending: 1, question: 1, done: 2, work: 2, court: 2, waiting: 3 }
  const rank = p => (p.id === selected || p.id === hovered ? 0 : RANK[p.state.kind] ?? 4)

  // Tags follow their heads. A tag that would cover a nearer one is lifted above it.
  const placed = []
  function placeTags() {
    const far = camera.position.distanceTo(controls.target) > 120
    tagLayer.classList.toggle('cb-far', far)
    placed.length = 0
    const list = []
    for (const p of people.values()) {
      projected.set(p.pos.x, p.pos.y + HEAD_Y + 0.15, p.pos.z).project(camera)
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.3 && Math.abs(projected.y) < 1.3
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height
      list.push({ p, x, y, depth: projected.z, visible })
    }
    list.sort((a, b) => rank(a.p) - rank(b.p) || a.depth - b.depth)
    for (const item of list) {
      const { p } = item
      const el = p.tag.el
      if (!item.visible) { el.style.visibility = 'hidden'; continue }
      el.style.visibility = ''
      if (p.tag.w === 0) { p.tag.w = el.offsetWidth; p.tag.h = el.offsetHeight }
      const y = item.y
      const w = p.tag.w
      const h = p.tag.h
      const important = p.id === selected || p.id === hovered
      // A tag that falls behind a nearer one steps back instead of moving off its head.
      const covered = !important && placed.some(r => Math.abs(r.x - item.x) < (r.w + w) / 2 - 20 && y > r.y - r.h + 8 && y - h < r.y - 8)
      el.classList.toggle('cb-behind', covered)
      if (!covered) placed.push({ x: item.x, y, w, h })
      el.style.transform = `translate(${Math.round(item.x - w / 2)}px, ${Math.round(y - h)}px)`
      el.style.zIndex = important ? 1000 : String(Math.round((1 - item.depth) * 900))
    }
    rooms.forEach((label) => {
      projected.set(label.x, label.y, label.z).project(camera)
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height
      label.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`
      label.el.style.visibility = projected.z < 1 ? '' : 'hidden'
    })
  }

  function start() {
    if (running) return
    running = true
    last = 0
    frameId = requestAnimationFrame(tick)
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
    controls.dispose()
    for (const p of people.values()) removePerson(p)
    people.clear()
    for (const label of rooms.values()) label.el.remove()
    rooms.clear()
    proclaim.remove()
    for (const e of effects) e.end?.()
    effects.length = 0
    const owned = new Set()
    scene.traverse((object) => { if (object.geometry) owned.add(object.geometry) })
    for (const g of owned) g.dispose()
    for (const g of geometries.values()) g.dispose()
    for (const m of materials.values()) m.dispose()
    for (const texture of textures) texture.dispose()
    scene.clear()
    renderer.dispose()
    renderer.forceContextLoss?.()
    canvas.remove()
    sky.remove()
    container.style.background = containerBackground
  }

  setTime(minutesNow)
  frame(true)

  return {
    setPeople,
    setPersonState,
    setTime,
    select,
    flyTo,
    frame: () => frame(false),
    setInset,
    start,
    stop,
    decree,
    resize,
    dispose,
    isRunning: () => running,
  }
}
