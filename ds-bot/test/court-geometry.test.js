import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

const bundle = await build({
  stdin: { contents: "export * as THREE from 'three'; export { batchRoot } from './src/client/court-board/geometry.js'", resolveDir: process.cwd() },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, console })
const { THREE, batchRoot } = module.exports
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`)

test('a batched hall, its plaque and picking target move together after yard layout', () => {
  const scene = new THREE.Scene()
  const hall = new THREE.Group()
  hall.position.set(44, 0, -24)
  scene.add(hall)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 8), new THREE.MeshBasicMaterial())
  roof.position.y = 6
  hall.add(roof)
  const nested = new THREE.Group()
  nested.position.set(0, 2, 4)
  hall.add(nested)
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), new THREE.MeshBasicMaterial())
  plaque.userData.noMerge = true
  nested.add(plaque)
  const pick = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 6), new THREE.MeshBasicMaterial({ visible: false }))
  pick.userData.noMerge = true
  hall.add(pick)
  scene.updateMatrixWorld(true)
  const before = new THREE.Box3().setFromObject(hall)
  const plaqueBefore = plaque.getWorldPosition(new THREE.Vector3())
  batchRoot(hall)
  scene.updateMatrixWorld(true)
  const after = new THREE.Box3().setFromObject(hall)
  for (const axis of ['x', 'y', 'z']) {
    close(before.min[axis], after.min[axis])
    close(before.max[axis], after.max[axis])
    close(plaque.getWorldPosition(new THREE.Vector3())[axis], plaqueBefore[axis])
  }
  assert.equal(hall.parent, scene)
  assert.equal(plaque.parent, hall)
  assert.equal(pick.parent, hall)
  hall.position.set(-36, 0, 16)
  scene.updateMatrixWorld(true)
  const moved = new THREE.Box3().setFromObject(hall)
  close(moved.min.x - after.min.x, -80)
  close(moved.min.z - after.min.z, 40)
  close(plaque.getWorldPosition(new THREE.Vector3()).x, -36)
  close(plaque.getWorldPosition(new THREE.Vector3()).z, 20)
  close(pick.getWorldPosition(new THREE.Vector3()).x, -36)
})

test('batching a fixed backdrop does not detach dynamic courts or movable halls', () => {
  const scene = new THREE.Scene()
  const backdrop = new THREE.Group(), courts = new THREE.Group(), hall = new THREE.Group()
  scene.add(backdrop, courts, hall)
  backdrop.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()))
  batchRoot(backdrop)
  assert.equal(courts.parent, scene)
  assert.equal(hall.parent, scene)
  courts.add(new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshBasicMaterial()))
  assert.equal(courts.children[0].parent.parent, scene)
})
