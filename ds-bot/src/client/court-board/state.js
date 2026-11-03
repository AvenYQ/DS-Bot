// Who stands where, and what each of them is doing: the bridge between the Bot team's
// own state (live-state.js) and the court board's figures. Kept free of React and of the
// interface's copy, so the mapping can be tested on its own.
import { DEFAULT_ROBE, OFFICIALS } from './data.js'

const HATS = ['wusha', 'nei', 'jyw', 'fj', 'dao']

/** The official whose name this Bot carries, if the table knows one. */
export function officialFor(bot) {
  const name = bot?.name ?? ''
  return OFFICIALS.find(official => name.includes(official.name)) ?? null
}

/** The words on a Bot's hall plaque: its office, as its name or the table gives it. */
export function officeOf(bot, official) {
  const name = String(bot?.name ?? '')
  const cut = name.indexOf('·')
  if (cut > 0) return name.slice(0, cut)
  return official?.title ?? (String(bot?.role ?? '').trim() || name)
}

// A Bot with no official still needs a face: his avatar's colour dresses him.
export function ownLook(bot) {
  const robe = typeof bot?.avatar?.color === 'string' ? bot.avatar.color : DEFAULT_ROBE
  return { robe, hat: HATS[(bot?.name ?? '').length % HATS.length] }
}

// Night, when nothing is running: the court sleeps.
export const sleepsAt = hour => hour < 6.5 || hour >= 22.5

/**
 * What a Bot's figure shows.
 * @param {object} live one entry from live-state.js, with the board's own extras
 * @param {number} hour the hour of the day, 0..24
 * @param {(live: object) => string} [phrase] the words for a Bot at work, from the
 *   interface's copy; the caller supplies them so this module stays copy-free
 * @param {{done?: string}} [words]
 * @returns {{kind: string, text: string, since?: number, motion?: string, room?: string, speaking?: boolean}}
 *   `kind` is one the scene paints: work, idle, sleep, waiting, done, pending, question,
 *   court. `motion` says how a Bot at work moves: thinking, searching, sending, working.
 */
export function courtStateOf(live, hour, phrase = () => '', words = {}) {
  if (live.approval) return { kind: 'pending', text: '' }
  if (live.alert) return { kind: 'question', text: '' }
  if (live.away) return { kind: 'court', text: live.roomName ?? '', room: live.groups?.[0]?.id ?? '', speaking: live.speaking === true, since: live.since }
  if (live.running) return { kind: 'work', text: phrase(live), since: live.since, motion: motionOf(live.activity ?? live.doing) }
  if (live.done) return { kind: 'done', text: words.done ?? '' }
  if (live.state === 'waiting') return { kind: 'waiting', text: live.waitsFor ?? '' }
  if (sleepsAt(hour)) return { kind: 'sleep', text: '' }
  return { kind: 'idle', text: '' }
}

const MOTIONS = ['thinking', 'searching', 'sending', 'working']
function motionOf(doing) {
  if (typeof doing === 'string') return MOTIONS.includes(doing) ? doing : doing === 'orbit' ? 'sending' : 'working'
  return 'working'
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
    const own = ownLook(bot)
    const state = live.get(bot.id) ?? { bot, state: 'idle' }
    const court = courtStateOf(state, hour, phrase, words)
    people.push({
      id: bot.id,
      name: official?.name ?? nameOf(bot),
      office: officeOf(bot, official),
      title: bot.name,
      section: group,
      robe: official?.robe ?? own.robe,
      hat: official?.hat ?? own.hat,
      side: official?.side ?? 'E',
      main: bot.id === roster?.mainBotId,
      state: court,
    })
    cards.push({ bot, official, court, group })
  }
  return { people, bots: cards }
}

// The person in 「官职·人名」, or the whole name.
const nameOf = bot => {
  const name = String(bot?.name ?? '')
  const cut = name.lastIndexOf('·')
  return cut >= 0 && cut < name.length - 1 ? name.slice(cut + 1) : name
}
