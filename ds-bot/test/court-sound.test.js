import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSound } from '../src/client/court-board/sound.js'

function fakeAudio() {
  const log = { contexts: 0, oscillators: [], gains: [], resumed: 0 }
  class FakeAudioContext {
    constructor() {
      log.contexts += 1
      this.currentTime = 0
      this.state = 'running'
      this.destination = { name: 'destination' }
    }

    createGain() {
      const node = {
        peak: 0,
        gain: {
          value: 1,
          setValueAtTime(value) { node.peak = Math.max(node.peak, value) },
          exponentialRampToValueAtTime(value) { node.peak = Math.max(node.peak, value) },
          linearRampToValueAtTime(value) { node.peak = Math.max(node.peak, value) },
        },
      }
      node.connect = (target) => { node.target = target; return target }
      node.disconnect = () => {}
      log.gains.push(node)
      return node
    }

    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: {
          value: 0,
          setValueAtTime(value) { osc.frequencyAt = value },
          exponentialRampToValueAtTime(value) { osc.endFrequency = value },
          linearRampToValueAtTime(value) { osc.endFrequency = value },
        },
      }
      osc.connect = (target) => { osc.target = target; return target }
      osc.start = (at) => { osc.startedAt = at }
      osc.stop = (at) => { osc.stoppedAt = at }
      osc.disconnect = () => {}
      log.oscillators.push(osc)
      return osc
    }

    resume() {
      log.resumed += 1
      this.state = 'running'
      return Promise.resolve()
    }
  }
  return { log, FakeAudioContext }
}

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
  }
}

test('the sound box starts off, and off is silent without building an audio context', () => {
  const { log, FakeAudioContext } = fakeAudio()
  const sound = createSound({ storage: memoryStorage(), AudioContextClass: FakeAudioContext })
  assert.equal(sound.enabled(), false)
  assert.equal(sound.play('bell'), false)
  assert.equal(log.contexts, 0)
  assert.equal(log.oscillators.length, 0)
})

test('a stored switch brings the sounds back on', () => {
  const { log, FakeAudioContext } = fakeAudio()
  const storage = memoryStorage({ 'ds-bot:court-sound': 'on' })
  const sound = createSound({ storage, AudioContextClass: FakeAudioContext })
  assert.equal(sound.enabled(), true)
  assert.equal(log.contexts, 0, 'no context before the first sound')
  assert.equal(sound.play('bell'), true)
  assert.equal(log.contexts, 1)
  assert.equal(log.oscillators.length, 3, 'the bell is three tones')
  assert.equal(sound.play('bell'), true)
  assert.equal(log.contexts, 1, 'the context is built once')
  assert.equal(log.oscillators.length, 6)
})

test('all four sounds play and an unknown name stays quiet', () => {
  const { log, FakeAudioContext } = fakeAudio()
  const sound = createSound({ storage: memoryStorage(), AudioContextClass: FakeAudioContext })
  sound.setEnabled(true)
  for (const name of ['bell', 'drum', 'decree', 'runner']) assert.equal(sound.play(name), true, name)
  const played = log.oscillators.length
  assert.ok(played >= 8, `four sounds should schedule their tones, got ${played}`)
  assert.equal(sound.play('gong'), false)
  assert.equal(log.oscillators.length, played)
})

test('the switch is remembered when it moves', () => {
  const storage = memoryStorage()
  const sound = createSound({ storage, AudioContextClass: fakeAudio().FakeAudioContext })
  sound.setEnabled(true)
  assert.equal(storage.data['ds-bot:court-sound'], 'on')
  assert.equal(sound.enabled(), true)
  sound.setEnabled(false)
  assert.equal(storage.data['ds-bot:court-sound'], 'off')
  assert.equal(sound.enabled(), false)
  assert.equal(sound.play('drum'), false)
})

test('a turned-off box is silent even after it played', () => {
  const { log, FakeAudioContext } = fakeAudio()
  const sound = createSound({ storage: memoryStorage(), AudioContextClass: FakeAudioContext })
  sound.setEnabled(true)
  sound.play('drum')
  const before = log.oscillators.length
  sound.setEnabled(false)
  assert.equal(sound.play('drum'), false)
  assert.equal(log.oscillators.length, before)
})

test('the whole box stays quiet in volume', () => {
  const { log, FakeAudioContext } = fakeAudio()
  const sound = createSound({ storage: memoryStorage(), AudioContextClass: FakeAudioContext })
  sound.setEnabled(true)
  for (const name of ['bell', 'drum', 'decree', 'runner']) sound.play(name)
  const master = log.gains[0]
  assert.ok(master.gain.value <= 0.5, 'the master gain stays at half or lower')
  const peaks = log.gains.slice(1).map(node => node.peak)
  assert.ok(peaks.length > 0)
  assert.ok(Math.max(...peaks) <= 0.25, `no tone peaks above a quarter, got ${Math.max(...peaks)}`)
})

test('a suspended context is resumed before the sound is scheduled', () => {
  const { log, FakeAudioContext } = fakeAudio()
  class Suspended extends FakeAudioContext {
    constructor() {
      super()
      this.state = 'suspended'
    }
  }
  const sound = createSound({ storage: memoryStorage(), AudioContextClass: Suspended })
  sound.setEnabled(true)
  assert.equal(sound.play('decree'), true)
  assert.equal(log.resumed, 1)
})

test('no storage and no Web Audio leave a quiet, working switch', () => {
  const sound = createSound({ storage: { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } } })
  assert.equal(sound.enabled(), false)
  assert.equal(sound.play('bell'), false)
  sound.setEnabled(true)
  assert.equal(sound.enabled(), true)
  assert.equal(sound.play('bell'), false, 'no AudioContext in this environment')
})

test('an audio context that refuses to start does not throw at the player', () => {
  class Broken {
    constructor() { throw new Error('no audio here') }
  }
  const sound = createSound({ storage: memoryStorage(), AudioContextClass: Broken })
  sound.setEnabled(true)
  assert.equal(sound.play('bell'), false)
})

test('createSound works with nothing wired at all', () => {
  const sound = createSound()
  assert.equal(sound.enabled(), false)
  assert.equal(sound.play('bell'), false)
  sound.setEnabled(true)
  assert.equal(sound.enabled(), true)
})
