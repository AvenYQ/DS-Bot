// Who stands where, and what each of them is doing: the bridge between the Bot team's
// own state (live-state.js) and the court board's figures. Kept free of React and of the
// interface's copy, so the mapping can be tested on its own.
import { DEFAULT_ROBE, OFFICIALS, buildingFor } from './data.js'

const HATS = ['wusha', 'nei', 'jyw', 'fj', 'dao']

/** The official whose name this Bot carries, if the table knows one. */
export function officialFor(bot) {
  const name = bot?.name ?? ''
  return OFFICIALS.find(official => name.includes(official.name)) ?? null
}

// A Bot with no official still needs a face: his avatar's colour dresses him, and the
// words in his name pick the 值房 he lodges in.
export function ownLook(bot, group) {
  const robe = typeof bot?.avatar?.color === 'string' ? bot.avatar.color : DEFAULT_ROBE
  return { robe, hat: HATS[(bot?.name ?? '').length % HATS.length], building: buildingFor(bot, group) }
}

// Night, when nothing is running: the court sleeps, as the source page did.
export const sleepsAt = hour => hour < 6.5 || hour >= 22.5

/**
 * What a Bot's figure shows.
 * @param {object} live one entry from live-state.js
 * @param {number} hour the hour of the day, 0..24
 * @param {(live: object) => string} [phrase] the words for a Bot at work, from the
 *   interface's copy; the caller supplies them so this module stays copy-free
 * @param {{done?: string, waiting?: string}} [words]
 * @returns {{kind: string, text: string}} `kind` is one the scene paints: work, idle,
 *   sleep, alert, waiting, done, pending, court.
 */
export function courtStateOf(live, hour, phrase = () => '', words = {}) {
  if (live.alert) return { kind: 'pending', text: '' }
  if (live.away) return { kind: 'court', text: live.roomName ?? '' }
  if (live.running) return { kind: 'work', text: phrase(live) }
  if (live.done) return { kind: 'done', text: words.done ?? '' }
  if (live.state === 'waiting') return { kind: 'waiting', text: live.waitsFor ?? '' }
  if (sleepsAt(hour)) return { kind: 'sleep', text: '' }
  return { kind: 'idle', text: '' }
}

/** The Bots in sidebar order: each section's Bots, then the ones filed under no heading. */
export function castOrder(roster) {
  const bots = (roster?.bots ?? []).filter(bot => bot && !bot.hidden)
  const filed = new Set()
  const ordered = []
  for (const section of roster?.sections ?? []) {
    for (const bot of bots) {
      if (bot.section === section.name) { ordered.push(bot); filed.add(bot.id) }
    }
  }
  for (const bot of bots) if (!filed.has(bot.id)) ordered.push(bot)
  return ordered
}

/**
 * The cast the scene draws, in sidebar order.
 * @param {{roster: object, live: Map<string, object>, hour: number,
 *   phrase?: (live: object) => string, words?: object}} input
 * @returns {{people: object[], bots: object[]}} `bots` carries what the card and the
 *   roster list need, in the same order.
 */
export function castOf({ roster, live, hour, phrase, words }) {
  const people = []
  const cards = []
  for (const bot of castOrder(roster)) {
    const official = officialFor(bot)
    const group = bot.section ?? ''
    const own = ownLook(bot, group)
    const state = live.get(bot.id) ?? { bot, state: 'idle' }
    const court = courtStateOf(state, hour, phrase, words)
    people.push({
      id: bot.id,
      name: official?.name ?? bot.name,
      title: official ? `${official.title}·${official.name}` : bot.name,
      dept: official?.dept ?? group,
      building: official?.b ?? own.building,
      offset: official?.off ?? 0,
      robe: official?.robe ?? own.robe,
      hat: official?.hat ?? own.hat,
      side: official?.side ?? 'E',
      state: court,
    })
    cards.push({ bot, official, court, group })
  }
  return { people, bots: cards }
}
