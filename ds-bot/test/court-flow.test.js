// The board's slow background motion is a function of the clock, not of how many frames
// were drawn: ten seconds of water or clouds must end in the same place whether the board
// ran at sixty frames a second or at the idle ten.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { driftX, flowOffset } from '../src/client/court-board/flow.js'

const near = (one, other, eps = 1e-9) => Math.abs(one - other) < eps
const sample = (fps, seconds, at) => {
  let value = 0
  const step = 1 / fps
  for (let t = step; t <= seconds + 1e-9; t += step) value = at(t)
  return value
}

test('the 金水河 sits in the same place after ten seconds at sixty frames or ten', () => {
  const full = sample(60, 10, flowOffset)
  const idle = sample(10, 10, flowOffset)
  assert.ok(near(full, idle), 'ten frames a second lands where sixty does')
  assert.ok(near(full, flowOffset(10)))
  assert.ok(full > 0.19 && full < 0.21, 'a tenth of a lap per ten seconds at 0.02 a second')
})

test('a cloud has drifted the same way at sixty frames or ten', () => {
  const full = sample(60, 10, t => driftX(0, 1.6, t))
  const idle = sample(10, 10, t => driftX(0, 1.6, t))
  assert.ok(near(full, idle), 'ten frames a second lands where sixty does')
  assert.ok(near(full, driftX(0, 1.6, 10)))
  // it comes round inside the span it crosses rather than running off forever
  assert.ok(Math.abs(driftX(0, 1.6, 1000)) <= 190)
})
