// The 宣旨 ceremony the board stages for the work the Main Bot has just given. Kept apart
// from index.js so the decision can be tested without React: the board only hands the
// result to scene.decree.
const WINDOW_MS = 10_000

/**
 * The ceremony the newest assignments call for, if any.
 * @param {Array<{from?:string,to?:string,room?:string,at?:number}>} assignments newest first
 * @param {string} mainBotId the Bot that proclaims
 * @param {{bots?:number,room?:number}} playedAt the newest `at` already staged for each shape
 * @param {number} now the clock the ten-second window is measured against
 * @returns {{kind:'bots',from:string,to:string[],at:number}|{kind:'room',from:string,to:string[],room:string,at:number}|null}
 */
export function decreeFor(assignments, mainBotId, playedAt = {}, now = Date.now()) {
  if (!Array.isArray(assignments) || typeof mainBotId !== 'string') return null
  const fresh = assignments
    .filter(entry => entry !== null && typeof entry === 'object' && entry.from === mainBotId
      && typeof entry.at === 'number' && now - entry.at <= WINDOW_MS)
    .sort((one, other) => other.at - one.at)

  // Group work is the bigger ceremony, so it goes before a batch of Bot-to-Bot work.
  const room = fresh.find(entry => typeof entry.room === 'string' && entry.room !== '')
  if (room !== undefined && room.at > (playedAt.room ?? 0)) {
    return { kind: 'room', from: mainBotId, to: [], room: room.room, at: room.at }
  }

  const newest = fresh.find(entry => typeof entry.to === 'string' && entry.to !== '')
  if (newest === undefined || newest.at <= (playedAt.bots ?? 0)) return null
  const to = []
  for (const entry of fresh) {
    if (typeof entry.to !== 'string' || entry.to === '') continue
    if (newest.at - entry.at > WINDOW_MS) continue
    if (!to.includes(entry.to)) to.push(entry.to)
  }
  if (to.length < 2) return null
  return { kind: 'bots', from: mainBotId, to, at: newest.at }
}
