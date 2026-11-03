// The 奏事簿's bookkeeping and the board's clock words, apart from React so they can be
// tested on their own.

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const QUARTERS = ['', '一刻', '二刻', '三刻']

/** The hour as a 时辰 with 初/正 and its 刻: 12:40 is 午正二刻. */
export function shichen(hour) {
  const minutes = Math.floor(((hour % 24) + 24) % 24 * 60)
  const shifted = (minutes + 60) % 1440
  const branch = BRANCHES[Math.floor(shifted / 120)]
  const half = (shifted % 120) < 60 ? '初' : '正'
  return `${branch}${half}${QUARTERS[Math.floor((shifted % 60) / 15)]}`
}

/** The day a moment falls on, in the officials' time zone; the log keeps one day. */
export const feedKey = (at = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(at))

// A Bot that changes what it is doing inside the same turn is logged at most this often.
const QUIET_MS = 8000

/**
 * The log entries a new cast calls for, against the one seen before.
 * @param {Map<string, {kind: string, text: string, at: number}>|null} before null the first
 *   time, when nothing is logged: the board only records what changes while it watches
 * @param {{bot: object, court: {kind: string, text: string}}[]} bots
 * @param {number} now
 * @param {Record<string, string>} words the interface's copy
 * @returns {{entries: object[], next: Map}} entries newest first
 */
export function feedEvents(before, bots, now, words) {
  const next = new Map()
  const entries = []
  for (const { bot, court } of bots) {
    const was = before?.get(bot.id)
    next.set(bot.id, { kind: court.kind, text: court.text ?? '', at: was?.at ?? 0 })
    if (before === null || was === undefined) continue
    const note = (text) => {
      entries.push({ at: now, id: bot.id, name: bot.name, kind: court.kind, text })
      next.get(bot.id).at = now
    }
    if (was.kind === court.kind) {
      if (court.kind === 'work' && court.text && court.text !== was.text && now - was.at >= QUIET_MS) note(court.text)
      continue
    }
    if (court.kind === 'work') note(court.text ? `${words.start} · ${court.text}` : words.start)
    else if (court.kind === 'done') note(words.finish)
    else if (court.kind === 'pending') note(words.pending)
    else if (court.kind === 'question') note(words.question)
    else if (court.kind === 'court') note(court.text ? `${words.court} · ${court.text}` : words.court)
    else if (court.kind === 'waiting') note(court.text || words.waiting)
    else if (was.kind === 'work' || was.kind === 'court') note(words.ended)
  }
  return { entries, next }
}
