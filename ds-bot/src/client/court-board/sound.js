// The court board's sounds: the morning bell, the evening drum, a decree read out and a
// little eunuch's pattering feet. Every one is synthesised with Web Audio at the moment it
// plays, so the board ships no audio file, borrows nobody's recording and adds no weight
// beyond this module.

const STORAGE_KEY = 'ds-bot:court-sound'
// Everything below is mixed quietly: the board is a place to sit, not a firework.
const MASTER_VOLUME = 0.5

// One entry per sound: short tones in order, each with its own little envelope.
const VOICES = {
  // A temple bell: a low strike with two soft overtones ringing out.
  bell: [
    { type: 'sine', frequency: 174.6, decay: 1.5, gain: 0.12 },
    { type: 'sine', frequency: 349.2, decay: 1.1, gain: 0.045, delay: 0.01 },
    { type: 'sine', frequency: 523.2, decay: 0.8, gain: 0.022, delay: 0.02 },
  ],
  // The drum at dusk: a low thud that falls in pitch, with a wooden tap on top.
  drum: [
    { type: 'sine', frequency: 92, endFrequency: 54, decay: 0.42, gain: 0.24 },
    { type: 'triangle', frequency: 180, endFrequency: 120, decay: 0.07, gain: 0.05 },
  ],
  // A decree: two bright notes, one after the other, like a herald clearing his throat.
  decree: [
    { type: 'triangle', frequency: 659.25, decay: 0.22, gain: 0.09 },
    { type: 'triangle', frequency: 987.77, decay: 0.32, gain: 0.075, delay: 0.11 },
  ],
  // The runner: four quick steps over the stones, the last one lighter.
  runner: [
    { type: 'square', frequency: 1046.5, decay: 0.05, gain: 0.035 },
    { type: 'square', frequency: 1174.7, decay: 0.05, gain: 0.032, delay: 0.09 },
    { type: 'square', frequency: 1046.5, decay: 0.05, gain: 0.03, delay: 0.18 },
    { type: 'square', frequency: 1318.5, decay: 0.06, gain: 0.026, delay: 0.28 },
  ],
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readStored(storage) {
  try {
    return storage?.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function writeStored(storage, on) {
  try {
    storage?.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Private windows and full disks refuse the write; the switch still works this session.
  }
}

function schedule(context, master, voice, at) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  oscillator.type = voice.type
  oscillator.frequency.setValueAtTime(voice.frequency, at)
  if (voice.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, at + voice.decay)
  }
  // An exponential ramp cannot touch zero, so the envelope starts and ends just above it.
  envelope.gain.setValueAtTime(0.0001, at)
  envelope.gain.exponentialRampToValueAtTime(voice.gain, at + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + voice.decay)
  oscillator.connect(envelope)
  envelope.connect(master)
  oscillator.start(at)
  oscillator.stop(at + voice.decay + 0.02)
}

/**
 * The board's sound box. Off until the reader turns it on; the choice is kept in local
 * storage, and while it is off no AudioContext is built at all.
 * @param {object} [options]
 * @param {Storage} [options.storage] where the switch is kept
 * @param {typeof AudioContext} [options.AudioContextClass] the Web Audio class to use
 * @returns {{play: (name: string) => boolean, setEnabled: (on: boolean) => void, enabled: () => boolean}}
 */
export function createSound({ storage = defaultStorage(), AudioContextClass } = {}) {
  let on = readStored(storage)
  let context = null
  let master = null

  function audioContext() {
    if (context) return context
    const Ctor = AudioContextClass ?? globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (typeof Ctor !== 'function') return null
    try {
      context = new Ctor()
      master = context.createGain()
      master.gain.value = MASTER_VOLUME
      master.connect(context.destination)
      return context
    } catch {
      context = null
      master = null
      return null
    }
  }

  function play(name) {
    if (!on) return false
    const voices = VOICES[name]
    if (!voices) return false
    const audio = audioContext()
    if (!audio) return false
    try {
      if (audio.state === 'suspended') audio.resume?.()
      const at = audio.currentTime + 0.01
      for (const voice of voices) schedule(audio, master, voice, at + (voice.delay ?? 0))
      return true
    } catch {
      return false
    }
  }

  function setEnabled(next) {
    on = next === true
    writeStored(storage, on)
  }

  return { play, setEnabled, enabled: () => on }
}
