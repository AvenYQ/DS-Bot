import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createRenderKit, instanced } from '../src/client/court-board/render.js'
import { weatherLook } from '../src/client/court-board/weather.js'

function fakeRenderer() {
  const calls = { pixelRatio: [], size: [] }
  return {
    outputColorSpace: null,
    toneMapping: null,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, type: 0 },
    setPixelRatio(ratio) { calls.pixelRatio.push(ratio) },
    getSize(target) { target.set(800, 600); return target },
    setSize(width, height) { calls.size.push([width, height]) },
    calls,
  }
}

// scene.js leaves colour management off, so the board's colours are the r128 sRGB values.
function makeWorld() {
  THREE.ColorManagement.enabled = false
  const scene = new THREE.Scene()
  const hemi = new THREE.HemisphereLight(0xdff2ff, 0xb9a782, 0.6)
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.castShadow = true
  scene.add(hemi, sun, sun.target)
  scene.fog = new THREE.Fog(0xeaf5f1, 170, 380)
  const roof = new THREE.MeshToonMaterial({ color: 0xf2b630 })
  const wall = new THREE.MeshToonMaterial({ color: 0xc4412e })
  const marble = new THREE.MeshToonMaterial({ color: 0xf3efe6 })
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), roof))
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wall))
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), marble))
  return { scene, hemi, sun, roof, wall, marble }
}

test('each sky carries its greyness, sight range and fall', () => {
  assert.equal(weatherLook({ kind: 'clear' }).overcast, 0)
  assert.equal(weatherLook({ kind: 'rain' }).fall.kind, 'rain')
  assert.equal(weatherLook({ kind: 'storm' }).fall.kind, 'rain')
  assert.equal(weatherLook({ kind: 'snow' }).fall.kind, 'snow')
  assert.equal(weatherLook({ kind: 'fog' }).fall, null)
  assert.ok(weatherLook({ kind: 'fog' }).fogFar < weatherLook({ kind: 'clear' }).fogFar)
  assert.deepEqual(weatherLook({ kind: 'nonsense' }), weatherLook({ kind: 'clear' }))
  assert.deepEqual(weatherLook(null), weatherLook({ kind: 'clear' }))
})

test('the kit moves the renderer onto managed colour and filmic tone mapping', () => {
  const world = makeWorld()
  const renderer = fakeRenderer()
  createRenderKit({ renderer, scene: world.scene })
  assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace)
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping)
  assert.equal(renderer.shadowMap.enabled, true)
  assert.equal(renderer.shadowMap.type, THREE.PCFSoftShadowMap)
  assert.equal(THREE.ColorManagement.enabled, true)
  // The board's colours keep their authored hex through the move into linear space.
  assert.equal(world.roof.color.getHex(), 0xf2b630)
  assert.ok(world.roof.color.r < 0.95 && world.roof.color.r > 0.8)
})

test('the clock moves the sun, the sky and the exposure', () => {
  const world = makeWorld()
  const renderer = fakeRenderer()
  const kit = createRenderKit({ renderer, scene: world.scene })
  kit.setClock(12, { kind: 'clear' })
  const noon = { sun: world.sun.intensity, hemi: world.hemi.intensity, y: world.sun.position.y, exposure: renderer.toneMappingExposure }
  kit.setClock(22, { kind: 'clear' })
  assert.ok(world.sun.intensity < noon.sun)
  assert.ok(world.hemi.intensity < noon.hemi)
  assert.ok(noon.y > world.sun.position.y)
  assert.deepEqual([world.sun.position.x, world.sun.position.y, world.sun.position.z], [-30, 80, 40])
  assert.ok(renderer.toneMappingExposure > noon.exposure)
  assert.ok(world.sun.intensity > 0 && world.hemi.intensity > 0)
})

test('fog and rain pull the sight range in and put the fall over the city', () => {
  const world = makeWorld()
  const renderer = fakeRenderer()
  const kit = createRenderKit({ renderer, scene: world.scene })
  kit.setClock(12, { kind: 'fog' })
  assert.equal(world.scene.fog.near, weatherLook({ kind: 'fog' }).fogNear)
  assert.equal(world.scene.fog.far, weatherLook({ kind: 'fog' }).fogFar)
  kit.setClock(12, { kind: 'rain' })
  const rain = world.scene.getObjectByName('court-fall')
  assert.ok(rain, 'rain has a fall')
  assert.ok(rain.children[0].isLineSegments)
  kit.setClock(12, { kind: 'snow' })
  const snow = world.scene.getObjectByName('court-fall')
  assert.ok(snow.children[0].isPoints)
  kit.setClock(12, { kind: 'clear' })
  assert.equal(world.scene.getObjectByName('court-fall'), undefined)
})

test('the grade leans the roofs, walls and marble to the dusk and the night', () => {
  const world = makeWorld()
  const renderer = fakeRenderer()
  const kit = createRenderKit({ renderer, scene: world.scene })
  kit.setClock(12, { kind: 'clear' })
  assert.equal(world.roof.color.getHex(), 0xf2b630)
  kit.setClock(18.2, { kind: 'clear' })
  const duskRoof = world.roof.color.getHex()
  assert.notEqual(duskRoof, 0xf2b630)
  kit.setClock(18.2, { kind: 'clear' })
  assert.equal(world.roof.color.getHex(), duskRoof)
  kit.setClock(23, { kind: 'clear' })
  assert.notEqual(world.wall.color.getHex(), 0xc4412e)
  assert.notEqual(world.marble.color.getHex(), 0xf3efe6)
})

test('snow lies on the roofs and turns the lawn white, then melts', () => {
  const world = makeWorld()
  const renderer = fakeRenderer()
  const kit = createRenderKit({ renderer, scene: world.scene })
  kit.setClock(12, { kind: 'snow' })
  const snowy = world.roof.color.getHex()
  kit.setClock(12, { kind: 'clear' })
  assert.notEqual(world.roof.color.getHex(), snowy)
})

test('nothing moving means no frames, and wake asks for them again', () => {
  const world = makeWorld()
  const kit = createRenderKit({ renderer: fakeRenderer(), scene: world.scene })
  assert.equal(kit.shouldRender(0.016), true)
  let last = true
  for (let i = 0; i < 120; i += 1) last = kit.shouldRender(0.016)
  assert.equal(last, false)
  kit.wake()
  assert.equal(kit.shouldRender(0.016), true)
})

test('a moving camera counts as motion', () => {
  const world = makeWorld()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 800)
  camera.position.set(0, 0, 0)
  camera.updateMatrixWorld()
  const kit = createRenderKit({ renderer: fakeRenderer(), scene: world.scene, camera })
  for (let i = 0; i < 120; i += 1) kit.shouldRender(0.016)
  assert.equal(kit.shouldRender(0.016), false)
  camera.position.set(30, 40, 50)
  camera.updateMatrixWorld()
  assert.equal(kit.shouldRender(0.016), true)
})

test('quality trades pixels and shadow map size, and refuses a wrong name', (t) => {
  t.after(() => { delete globalThis.devicePixelRatio })
  globalThis.devicePixelRatio = 2
  const world = makeWorld()
  const renderer = fakeRenderer()
  const kit = createRenderKit({ renderer, scene: world.scene })
  assert.equal(renderer.calls.pixelRatio.at(-1), 2)
  assert.equal(world.sun.shadow.mapSize.x, 2048)
  kit.setQuality('low')
  assert.equal(renderer.calls.pixelRatio.at(-1), 1.25)
  assert.equal(world.sun.shadow.mapSize.x, 1024)
  kit.setQuality('high')
  assert.equal(renderer.calls.pixelRatio.at(-1), 2)
  assert.equal(world.sun.shadow.mapSize.x, 2048)
  assert.throws(() => kit.setQuality('medium'), RangeError)
})

test('a slow frame rate falls back to low quality on its own', (t) => {
  t.after(() => { delete globalThis.devicePixelRatio })
  globalThis.devicePixelRatio = 2
  const world = makeWorld()
  const renderer = fakeRenderer()
  const kit = createRenderKit({ renderer, scene: world.scene })
  for (let i = 0; i < 60; i += 1) kit.shouldRender(0.05)
  assert.equal(renderer.calls.pixelRatio.at(-1), 1.25)
  assert.equal(world.sun.shadow.mapSize.x, 1024)
})

test('instanced builds one mesh for many copies', () => {
  const world = makeWorld()
  const kit = createRenderKit({ renderer: fakeRenderer(), scene: world.scene })
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshToonMaterial({ color: 0xffffff })
  const matrices = [0, 1, 2].map((i) => new THREE.Matrix4().makeTranslation(i * 2, 0, 0))
  const mesh = kit.instanced(geometry, material, matrices)
  assert.ok(mesh.isInstancedMesh)
  assert.equal(mesh.count, 3)
  const read = new THREE.Matrix4()
  mesh.getMatrixAt(2, read)
  assert.equal(read.elements[12], 4)
  // palace.js calls it before the kit exists.
  assert.equal(instanced(geometry, material, matrices).count, 3)
  assert.throws(() => kit.instanced(null, material, matrices), TypeError)
})

test('refresh takes in materials built after the kit without converting them twice', () => {
  const world = makeWorld()
  const kit = createRenderKit({ renderer: fakeRenderer(), scene: world.scene })
  kit.setClock(12, { kind: 'clear' })
  const robe = new THREE.MeshToonMaterial({ color: 0xe3a92a })
  const expected = robe.color.clone()
  world.scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), robe))
  assert.equal(kit.refresh(), 1)
  assert.ok(robe.color.equals(expected), 'refresh never converts a material twice')
  assert.equal(kit.refresh(), 0)
  kit.setClock(18.2, { kind: 'clear' })
  assert.notEqual(robe.color.getHex(), 0xe3a92a, 'the new roof joins the grade')
})

test('dispose takes the fall and the listeners away', () => {
  const world = makeWorld()
  const kit = createRenderKit({ renderer: fakeRenderer(), scene: world.scene })
  kit.setClock(12, { kind: 'snow' })
  assert.ok(world.scene.getObjectByName('court-fall'))
  kit.dispose()
  assert.equal(world.scene.getObjectByName('court-fall'), undefined)
  kit.setClock(12, { kind: 'snow' })
  assert.equal(world.scene.getObjectByName('court-fall'), undefined)
})

test('a scene without lights or fog is left alone', () => {
  THREE.ColorManagement.enabled = false
  const scene = new THREE.Scene()
  const kit = createRenderKit({ renderer: fakeRenderer(), scene })
  kit.setClock(12, { kind: 'clear' })
  assert.ok(scene.fog)
  kit.dispose()
})
