import * as THREE from 'three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Batch in root-local coordinates. Layout moves the root after construction, so plaques
// and picking meshes must remain children of the same root as the rendered building.
export function batchRoot(root, castShadow = true) {
  root.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map()
  const retained = []
  const sourceGeometry = new Set()
  root.traverse(object => {
    if (!object.isMesh) return
    if (object.userData.noMerge) { retained.push(object); return }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld))
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
    }
    if (!buckets.has(object.material)) buckets.set(object.material, [])
    buckets.get(object.material).push(geometry)
    sourceGeometry.add(object.geometry)
  })
  for (const object of retained) root.attach(object)
  root.clear()
  for (const object of retained) root.add(object)
  for (const [material, geometries] of buckets) {
    const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    root.add(mesh)
    for (const source of geometries) source.dispose()
  }
  for (const geometry of sourceGeometry) geometry.dispose()
  return root
}
