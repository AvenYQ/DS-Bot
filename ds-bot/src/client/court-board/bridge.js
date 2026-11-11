// The court board's bridge to the Bot team: what an official has in hand right now, and
// the one guarded way to send him a word from the board. Reading is free; sending needs
// the user's confirmed press, and a call without it never reaches the sender.
import { courtStateOf } from './state.js'

// What an official with nothing in his own words is doing, in the board's voice.
const DEFAULT_WORDS = {
  pending: '有奏折待批',
  question: '有疑问待答',
  idle: '候旨',
  sleep: '歇息',
  done: '已办',
}

const TODOS_KEPT = 5

// The board's snapshot, wired by index.js: the roster, the live states it already derives,
// the host's work view, and the sender that turns a Bot id into its chat.
let view = null

/**
 * Point the bridge at the board's current snapshot. index.js calls this whenever its data
 * moves; the bridge keeps no copy of its own beyond this reference.
 * @param {object|null} next {roster, live, work, hour, phrase, words, send}
 */
export function wireBridge(next) {
  view = next && typeof next === 'object' ? next : null
}

/** Forget the snapshot, so a dispatch after the board closes cannot send. */
export function unwireBridge() {
  view = null
}

/**
 * The office a Bot holds right now, read only.
 * @param {string} botId the Bot's id
 * @returns {null | {status: string, task: string, todos: Array<object>}}
 *   status is the board's court state: work, pending, question, court, done, waiting,
 *   sleep or idle. task is one sentence. todos are at most five, newest first:
 *   {kind: 'approval', id, at, tool, reason, text} or {kind: 'wait', id, name, text}.
 */
export function readDuty(botId) {
  const current = view
  if (!current) return null
  const bot = current.roster?.byId?.[botId]
  const live = current.live?.get?.(botId) ?? null
  if (!bot || !live) return null
  const hour = Number.isFinite(current.hour) ? current.hour : 12
  const words = { ...DEFAULT_WORDS, ...current.words }
  const phrase = typeof current.phrase === 'function' ? current.phrase : () => ''
  const court = courtStateOf(live, hour, phrase, words)
  return {
    status: court.kind,
    task: court.text || words[court.kind] || '',
    todos: dutyTodos(current.work, botId, words),
  }
}

function dutyTodos(work, botId, words) {
  const todos = []
  for (const entry of work?.approvals ?? []) {
    if (!entry || entry.botId !== botId) continue
    const reason = String(entry.reason ?? '').slice(0, 120)
    const tool = String(entry.tool ?? '')
    todos.push({
      kind: 'approval',
      id: entry.id ?? '',
      at: Number(entry.at) || 0,
      tool,
      reason,
      text: reason || tool || words.pending,
    })
  }
  for (const wait of work?.waiting?.[botId]?.waits ?? []) {
    const name = String(wait?.name ?? '')
    todos.push({
      kind: 'wait',
      id: wait?.id ?? '',
      at: 0,
      name,
      text: name ? `等 ${name} 回话` : '等回话',
    })
  }
  return todos.sort((one, other) => other.at - one.at).slice(0, TODOS_KEPT)
}

/**
 * Send one Bot a word from the board. The user's press on the confirmation card is the
 * `confirmed` flag: anything but a literal true is refused and the sender is never called.
 * @param {string} botId the Bot's id
 * @param {string} text what to send
 * @param {boolean} confirmed true only after the user pressed 准奏
 * @returns {Promise<{ok: boolean, reason?: string, error?: Error}>}
 */
export async function dispatch(botId, text, confirmed) {
  if (confirmed !== true) return { ok: false, reason: 'not-confirmed' }
  const current = view
  if (!current) return { ok: false, reason: 'not-wired' }
  if (!current.roster?.byId?.[botId]) return { ok: false, reason: 'unknown-bot' }
  const message = typeof text === 'string' ? text.trim() : ''
  if (message === '') return { ok: false, reason: 'empty-message' }
  if (typeof current.send !== 'function') return { ok: false, reason: 'no-sender' }
  try {
    await current.send(botId, message)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'send-failed', error }
  }
}
