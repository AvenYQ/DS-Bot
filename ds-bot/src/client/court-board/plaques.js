// The words on each hall's 匾: the 衙门's own name, and the officials stationed in it.
// A hall with one official reads 「工部·曾国藩」; one with two reads
// 「文渊阁·张居正、王安石」. The palace halls keep their name alone — the 太和殿 has no
// official of its own — and a spare 衙门 takes the office of the Bot that moved in until
// it has a name of its own.
//
// Pure data: no three.js, no React, no copy from i18n.js. palace.js draws what this gives.
import { BUILDINGS } from './layout.js'

/** The hall's own name, by building id. Spare 衙门 carry none until a Bot moves in. */
export const PLAQUE_NAMES = Object.fromEntries(
  BUILDINGS.filter(hall => hall.name).map(hall => [hall.id, hall.name]),
)

/** What stands between the 部名 and the names on a plaque. */
export const PLAQUE_SEP = '·'

/** What stands between two officials' names on one plaque. */
export const NAME_SEP = '、'

// About ten characters fit on one line of a hall's 匾 (palace.js measures its canvas and
// shrinks the text to fit). Past that, the 部名 and the names want two lines.
export const PLAQUE_LINE_MAX = 10

const nameOf = (who) => (typeof who === 'string' ? who.trim() : String(who?.name ?? '').trim())
const officeOf = (who) => (typeof who === 'string' ? '' : String(who?.office ?? '').trim())

/**
 * The words on one hall's plaque.
 * @param {string} buildingId
 * @param {Array<string | {name?: string, office?: string}>} [officers] who is stationed
 *   there, in the order their names should read. Stable: the men whose 值房 it is, not
 *   whoever happens to be at work this minute.
 * @returns {{title: string, officers: string[], text: string}} `title` is the 部名 (or
 *   the office, for a hall with no name of its own); `text` is the whole plaque on one
 *   line, and wants two lines when it runs past PLAQUE_LINE_MAX characters.
 */
export function plaqueOf(buildingId, officers = []) {
  const names = []
  for (const who of officers ?? []) {
    const name = nameOf(who)
    if (name && !names.includes(name)) names.push(name)
  }
  let title = Object.hasOwn(PLAQUE_NAMES, buildingId) ? PLAQUE_NAMES[buildingId] : ''
  if (!title) title = (officers ?? []).map(officeOf).find(Boolean) ?? ''
  // A Bot whose office is its bare name would otherwise read 「Chief·Chief」.
  if (names.length === 1 && title === names[0]) title = ''
  const text = [title, names.join(NAME_SEP)].filter(Boolean).join(PLAQUE_SEP)
  return { title, officers: names, text }
}

/**
 * Every named hall's plaque, from the people the board draws.
 * @param {Array<{building?: string, name?: string, office?: string}>} [cast] in sidebar
 *   order; a person with no `building` is not in a hall of his own and is left out here
 * @returns {Map<string, {title: string, officers: string[], text: string}>} hall id → plaque
 */
export function plaquesFor(cast = []) {
  const byHall = new Map()
  for (const hall of BUILDINGS) {
    if (hall.name) byHall.set(hall.id, [])
  }
  for (const person of cast ?? []) {
    const hall = person?.building
    if (!hall) continue
    if (!byHall.has(hall)) byHall.set(hall, [])
    byHall.get(hall).push(person)
  }
  const plaques = new Map()
  for (const [hall, people] of byHall) plaques.set(hall, plaqueOf(hall, people))
  return plaques
}
