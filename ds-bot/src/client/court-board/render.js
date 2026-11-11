// The court board's light, colour and frame budget. One kit owns what the camera shows:
// the colour pipeline, the sun and sky by the hour, the fall of rain or snow, and whether
// a frame is worth drawing at all. scene.js builds the world; this paints it.
import * as THREE from 'three'
import { CROWNS, ROOF_COLOURS } from './palace.js'
import { weatherLook } from './weather.js'

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mixColour = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)
const hexOf = (colour) => (typeof colour === 'number' ? colour : parseInt(String(colour).replace('#', ''), 16))

// The palette families the grade reaches: the roofs and crowns palace.js builds, the red
// walls and marble it paints, the lawn and the paving. The hexes are palace.js's own
// constants, copied here because that module keeps them private.
const FAMILY_FLAG = 'courtRenderFamily'
const ADOPTED_FLAG = 'courtRenderAdopted'
// The palette is built on first use, not at import: palace.js imports instanced() from
// this module, so the two form a cycle, and palace.js's colours are not ready while this
// file is first evaluated.
let FAMILIES = null
function palette() {
  if (FAMILIES) return FAMILIES
  FAMILIES = new Map()
  for (const colour of ROOF_COLOURS) FAMILIES.set(hexOf(colour), 'roof')
  for (const colour of CROWNS) FAMILIES.set(hexOf(colour), 'roof')
  for (const colour of ['#c4412e', '#b8573f', '#b3382a']) FAMILIES.set(hexOf(colour), 'wall')
  FAMILIES.set(hexOf('#f3efe6'), 'marble')
  FAMILIES.set(hexOf('#ffffff'), 'pave')
  FAMILIES.set(hexOf('#a9cf87'), 'grass')
  return FAMILIES
}

// How far each family leans to the dusk and the night, and to the snow.
const GRADE = {
  roof: { warm: 0.22, cool: 0.18, warmColour: '#ffb27a', coolColour: '#8fa0d6' },
  wall: { warm: 0.16, cool: 0.2, warmColour: '#ff9a6a', coolColour: '#6d7bb3' },
  marble: { warm: 0.24, cool: 0.22, warmColour: '#ffd9ae', coolColour: '#aeb8e0' },
}
const SNOW = { roof: 0.6, grass: '#e9eef1', pave: '#f1f3f5' }

// The lit windows and the hanging lanterns, found by the colours palace.js paints them.
// The kit's switch turns both off; on, they follow the night.
const GLOW = new Map([
  [hexOf('#f1d48d'), { low: 0.12, high: 0.9 }],
  [hexOf('#e2442e'), { low: 0.25, high: 1.1 }],
])

const QUALITY = {
  high: { ratio: 2, shadow: 2048, fall: 1 },
  low: { ratio: 1.25, shadow: 1024, fall: 0.5 },
}

/**
 * One draw call for many copies of the same geometry and material. It stands alone
 * because palace.js builds its roofs, railings and trees before the render kit exists.
 * @returns {THREE.InstancedMesh} the caller adds it to the scene
 */
export function instanced(geometry, material, matrices = []) {
  if (!geometry || !material) throw new TypeError('instanced() needs a geometry and a material')
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length))
  const matrix = new THREE.Matrix4()
  matrices.forEach((entry, index) => {
    if (entry?.isMatrix4) matrix.copy(entry)
    else matrix.fromArray(entry)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.count = matrices.length
  mesh.instanceMatrix.needsUpdate = true
  if (matrices.length > 0) mesh.computeBoundingSphere()
  return mesh
}

/** The centre of the city, for the weather volume. */
const COURT = new THREE.Vector3(0, 0, -14)

/**
 * Builds the render kit for one court scene.
 * @param {object} options
 * @param {THREE.WebGLRenderer} options.renderer the scene's renderer
 * @param {THREE.Scene} options.scene the built city
 * @param {THREE.Camera} [options.camera] the view, followed for camera motion
 * @param {boolean} [options.still] the reader asked for reduced motion
 * @param {boolean} [options.glow] lit windows and lanterns at night, on by default
 * @returns {{setClock: Function, wake: Function, shouldRender: Function,
 *   setQuality: Function, refresh: Function, setGlow: Function, instanced: Function,
 *   dispose: Function}}
 */
export function createRenderKit({ renderer, scene, camera, still = false, glow = true } = {}) {
  if (!renderer || !scene) throw new TypeError('createRenderKit needs a renderer and a scene')

  const materials = new Map()
  const glowMaterials = new Map()
  let glowOn = glow !== false
  let sun = null
  let hemi = null
  let quality = 'high'
  let fall = null
  let awake = 1.2
  let fps = 60
  let slow = 0
  let clock = { hour: 12, weather: { kind: 'clear' } }
  let lastGrade = { kind: 'clear', warm: 0, night: 0 }
  let disposed = false
  let lastCameraMatrix = camera ? new THREE.Matrix4().copy(camera.matrixWorld) : null
  let battery = null
  let batteryListener = null

  scene.traverse((object) => {
    if (object.isDirectionalLight && !sun) sun = object
    else if (object.isHemisphereLight && !hemi) hemi = object
  })

  // ---------------------------------------------------------------------------
  // Colour: r128 passed the board's colours straight through, so they were authored in
  // sRGB. Read them in that space, then move them and their canvas maps into the linear
  // working space that colour management expects.
  function materialsOf(object) {
    const material = object.material
    if (!material) return []
    return Array.isArray(material) ? material : [material]
  }

  function convert(material) {
    material.userData = material.userData || {}
    material.userData[ADOPTED_FLAG] = true
    material.color.convertSRGBToLinear()
    if (material.emissive?.isColor) material.emissive.convertSRGBToLinear()
    if (material.specular?.isColor) material.specular.convertSRGBToLinear()
    for (const map of [material.map, material.emissiveMap]) {
      if (map && !map.isDataTexture) map.colorSpace = THREE.SRGBColorSpace
    }
    const entry = materials.get(material.uuid)
    if (entry) entry.base.copy(material.color)
  }

  function adopt() {
    THREE.ColorManagement.enabled = false
    const pending = []
    scene.traverse((object) => {
      for (const material of materialsOf(object)) {
        if (!material.color || materials.has(material.uuid)) continue
        const family = material.userData?.[FAMILY_FLAG] ?? palette().get(material.color.getHex()) ?? null
        materials.set(material.uuid, { material, family, base: material.color.clone() })
        const lit = GLOW.get(material.color.getHex())
        if (lit) glowMaterials.set(material.uuid, { material, lit })
        if (!material.userData?.[ADOPTED_FLAG]) pending.push(material)
      }
    })
    THREE.ColorManagement.enabled = true
    for (const material of pending) convert(material)
  }

  adopt()

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  applyQuality()

  // ---------------------------------------------------------------------------
  // The hour: sun, sky, fog and the grade on roofs, walls and marble.
  function grade(kind, warm, night) {
    const snowing = kind === 'snow'
    for (const { material, family, base } of materials.values()) {
      if (!family) continue
      if (family === 'grass' || family === 'pave') {
        if (snowing) material.color.set(family === 'grass' ? SNOW.grass : SNOW.pave)
        else material.color.copy(base)
        continue
      }
      const gradeOf = GRADE[family]
      if (!gradeOf) continue
      material.color.copy(base)
        .lerp(new THREE.Color(gradeOf.warmColour), warm * gradeOf.warm)
        .lerp(new THREE.Color(gradeOf.coolColour), night * gradeOf.cool)
      if (family === 'roof' && snowing) material.color.lerp(new THREE.Color('#ffffff'), SNOW.roof)
    }
  }

  // Lit windows and lanterns follow the night, and the switch turns the whole glow off.
  function applyGlow(night) {
    for (const { material, lit } of glowMaterials.values()) {
      material.emissiveIntensity = glowOn ? lit.low + lit.high * night : 0
    }
  }

  function setGlow(on = true) {
    glowOn = on !== false
    applyGlow(lastGrade.night)
    wake(0.3)
  }

  function setClock(hour = 12, weather = { kind: 'clear' }) {
    if (disposed) return
    clock = { hour, weather }
    const look = weatherLook(weather)
    const day = smooth(5.6, 7.2, hour) * (1 - smooth(17.2, 18.9, hour))
    const dusk = Math.max(Math.exp(-((hour - 6.4) ** 2) / 0.5), Math.exp(-((hour - 17.9) ** 2) / 0.5))
    const overcast = look.overcast
    const night = Math.max(1 - day, overcast * 0.4)
    const warm = dusk * (1 - overcast)

    if (sun) {
      sun.intensity = (0.16 + 0.42 * day) * (1 - overcast * 0.55) * Math.PI
      sun.color.copy(mixColour('#8ea4e0', '#ffffff', day).lerp(new THREE.Color('#ffb27a'), warm * 0.6))
      const a = Math.min(1, Math.max(0, (hour - 6) / 12)) * Math.PI
      if (day > 0.05) sun.position.set(Math.cos(a) * 70, 32 + 50 * Math.sin(a), 50)
      else sun.position.set(-30, 80, 40)
    }
    if (hemi) {
      hemi.intensity = (0.3 + 0.2 * day) * (1 + overcast * 0.2) * Math.PI
      hemi.color.copy(mixColour('#6d7bb3', '#dff2ff', day))
      hemi.groundColor.copy(mixColour('#2c2a3d', '#b9a782', day))
    }
    renderer.toneMappingExposure = 1.08 + 0.16 * night

    const fogColour = mixColour('#33406e', '#eaf5f1', day)
      .lerp(new THREE.Color('#fcd9ae'), warm * 0.7)
      .lerp(mixColour('#1d2333', '#c5cdd3', day), overcast)
    if (!scene.fog) scene.fog = new THREE.Fog(fogColour, look.fogNear, look.fogFar)
    scene.fog.color.copy(fogColour)
    scene.fog.near = look.fogNear
    scene.fog.far = look.fogFar

    lastGrade = { kind: weather?.kind ?? 'clear', warm, night }
    grade(lastGrade.kind, warm, night)
    applyGlow(night)
    setFall(look)
    wake(0.4)
  }

  // ---------------------------------------------------------------------------
  // Rain and snow: one volume over the city, moved by shouldRender.
  function clearFall() {
    if (!fall) return
    scene.remove(fall.group)
    fall.geometry.dispose()
    fall.material.dispose()
    fall = null
  }

  function setFall(look, force = false) {
    const want = look.fall
    if (!want) {
      clearFall()
      return
    }
    const count = Math.max(120, Math.round(want.count * QUALITY[quality].fall))
    if (!force && fall && fall.kind === want.kind && fall.count === count) return
    clearFall()
    const group = new THREE.Group()
    group.name = 'court-fall'
    const positions = new Float32Array(count * (want.kind === 'snow' ? 3 : 6))
    for (let i = 0; i < count; i += 1) {
      const x = (Math.random() - 0.5) * 170 + COURT.x
      const y = Math.random() * 60
      const z = (Math.random() - 0.5) * 160 + COURT.z
      if (want.kind === 'snow') positions.set([x, y, z], i * 3)
      else positions.set([x, y, z, x - 0.16, y - 1.6, z + 0.12], i * 6)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = want.kind === 'snow'
      ? new THREE.PointsMaterial({ color: 0xffffff, size: want.size, transparent: true, opacity: want.opacity, depthWrite: false })
      : new THREE.LineBasicMaterial({ color: 0xc4d6e6, transparent: true, opacity: want.opacity })
    const object = want.kind === 'snow' ? new THREE.Points(geometry, material) : new THREE.LineSegments(geometry, material)
    object.frustumCulled = false
    group.add(object)
    scene.add(group)
    fall = {
      kind: want.kind,
      count,
      group,
      geometry,
      material,
      speed: want.speed,
      sway: want.sway ?? 0,
      phase: 0,
      positions,
      attribute: geometry.getAttribute('position'),
    }
    wake()
  }

  function advance(dt) {
    if (!fall) return
    const { positions, attribute, speed } = fall
    if (fall.kind === 'snow') {
      fall.phase += dt
      for (let i = 0; i < fall.count; i += 1) {
        const at = i * 3
        positions[at + 1] -= speed * dt
        positions[at] += Math.sin(fall.phase * 0.8 + i) * fall.sway * dt
        if (positions[at + 1] < 0) {
          positions[at + 1] += 60
          positions[at] = (Math.random() - 0.5) * 170 + COURT.x
        }
      }
    } else {
      const drop = speed * dt
      for (let i = 0; i < fall.count; i += 1) {
        const at = i * 6
        positions[at + 1] -= drop
        positions[at + 4] -= drop
        if (positions[at + 1] < 0) {
          positions[at + 1] += 60
          positions[at + 4] += 60
        }
      }
    }
    attribute.needsUpdate = true
  }

  // ---------------------------------------------------------------------------
  // Quality: pixels, shadow maps and how much fall to draw.
  function applyQuality() {
    const level = QUALITY[quality]
    const dpr = Math.min(globalThis.devicePixelRatio || 1, level.ratio)
    if (renderer.setPixelRatio) renderer.setPixelRatio(dpr)
    if (renderer.getSize && renderer.setSize) {
      const size = renderer.getSize(new THREE.Vector2())
      if (size.x > 0 && size.y > 0) renderer.setSize(size.x, size.y, false)
    }
    if (sun?.shadow) {
      if (sun.shadow.mapSize.x !== level.shadow) {
        sun.shadow.mapSize.set(level.shadow, level.shadow)
        sun.shadow.map?.dispose()
        sun.shadow.map = null
      }
    }
  }

  function setQuality(next) {
    if (next !== 'high' && next !== 'low') throw new RangeError("quality is 'high' or 'low'")
    if (next === quality) return
    quality = next
    applyQuality()
    setFall(weatherLook(clock.weather), true)
    wake()
  }

  // ---------------------------------------------------------------------------
  // Frames: the caller stops drawing while nothing moves.
  function wake(seconds = 1.2) {
    awake = Math.max(awake, seconds)
  }

  function cameraMoved() {
    if (!camera || !lastCameraMatrix) return false
    if (lastCameraMatrix.equals(camera.matrixWorld)) return false
    lastCameraMatrix.copy(camera.matrixWorld)
    return true
  }

  function shouldRender(dt = 0.016) {
    const step = Math.min(0.1, Math.max(0, Number(dt) || 0))
    if (step > 0) {
      fps += (1 / step - fps) * 0.12
      if (quality === 'high' && fps < 42) {
        slow += 1
        if (slow >= 45) setQuality('low')
      } else {
        slow = 0
      }
    }
    if (cameraMoved()) wake(0.3)
    const moving = fall !== null && !still
    if (moving) advance(step)
    awake = Math.max(0, awake - step)
    return moving || awake > 0
  }

  // ---------------------------------------------------------------------------
  // Materials built after the kit (a Bot's robe when the cast changes) are taken in by
  // refresh. They were authored with colour management already on, so they only have to
  // be registered, never converted a second time.
  function refresh() {
    if (disposed) return 0
    let added = 0
    scene.traverse((object) => {
      for (const material of materialsOf(object)) {
        if (!material.color || materials.has(material.uuid)) continue
        const family = material.userData?.[FAMILY_FLAG] ?? palette().get(material.color.getHex()) ?? null
        materials.set(material.uuid, { material, family, base: material.color.clone() })
        const lit = GLOW.get(material.color.getHex())
        if (lit) glowMaterials.set(material.uuid, { material, lit })
        material.userData = material.userData || {}
        material.userData[FAMILY_FLAG] = family
        material.userData[ADOPTED_FLAG] = true
        for (const map of [material.map, material.emissiveMap]) {
          if (map && !map.isDataTexture) map.colorSpace = THREE.SRGBColorSpace
        }
        added += 1
      }
    })
    if (added > 0) {
      grade(lastGrade.kind, lastGrade.warm, lastGrade.night)
      applyGlow(lastGrade.night)
    }
    return added
  }

  // ---------------------------------------------------------------------------
  // Long-lived listeners.
  function watchBattery() {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') return
    navigator.getBattery().then((manager) => {
      if (disposed) return
      battery = manager
      batteryListener = () => {
        if (!battery.charging && battery.level <= 0.35) setQuality('low')
      }
      battery.addEventListener?.('levelchange', batteryListener)
      battery.addEventListener?.('chargingchange', batteryListener)
      batteryListener()
    }).catch(() => {})
  }

  function dispose() {
    if (disposed) return
    disposed = true
    clearFall()
    if (battery && batteryListener) {
      battery.removeEventListener?.('levelchange', batteryListener)
      battery.removeEventListener?.('chargingchange', batteryListener)
    }
    battery = null
    batteryListener = null
    materials.clear()
  }

  watchBattery()

  return { setClock, wake, shouldRender, setQuality, refresh, setGlow, instanced, dispose }
}
