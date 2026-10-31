// What a Bot is doing right now, read once for every place that shows it: its sidebar
// row, the court board's figures and its official card. One derivation keeps them in
// step; a second copy would drift the moment either side learns a new state.
import { useEffect, useRef, useState } from 'react'
import { botState } from './mark.js'
import { currentPart, previewOf } from './text.js'

// Whether an approval waits for the user: for a Bot, in any of its Sessions; for a group,
// from any of its members there.
export const approvalFor = (work, id) => (work?.approvals ?? []).some(entry => entry.botId === id)

// Picked as text so a row redraws only when what it shows changes.
const workKeys = text => JSON.parse(text)
const doingOf = ({ tool, said, note, target, switching }) => ({ tool, said, note, target, switching })

/** The group Sessions this Bot is working in, newest entry first. */
export const groupsOf = (rooms, id) => Object.entries(rooms ?? {})
  .flatMap(([roomId, entries]) => entries.filter(entry => entry.botId === id).map(entry => ({ id: roomId, ...doingOf(entry) })))

/**
 * The derivation both readers share, from state they already hold.
 * @param {{bot: object, roster: object, marked?: boolean, entry?: object, active?: boolean,
 *   doing?: object, approval?: boolean, rooms?: object, waiting?: object|null}} input
 *   `entry` is the Bot's own Session status row, `rooms` the group work map and `waiting`
 *   its handoff waiting row.
 * @returns {{part: string, running: boolean, unread: boolean, done: boolean, alert: boolean,
 *   approval: boolean, doing: object, groups: object[], away: boolean, waits: object|null,
 *   state: string}} `state` is the mascot's state (see mark.js); `away` is work in a group
 *   chat while the Bot's own chat is idle; `done` is finished work the user has not opened.
 */
export function liveStateOf({ bot, roster, marked = false, entry, active = false, doing, approval = false, rooms, groupWork, waiting = null, turn = null }) {
  const part = currentPart(bot)
  const running = entry?.running === true || turn != null
  const unread = entry?.completionUnread === true || entry?.pendingInteraction !== undefined || (marked && !active)
  const question = roster?.questions?.[part] != null || roster?.views?.[part] != null || entry?.pendingInteraction?.kind === 'question'
  const done = entry?.completionUnread === true && entry?.pendingInteraction === undefined && !active && !running && !question && !approval
  const alert = question || approval
  const seal = approval ? 'approval' : question ? 'question' : done ? 'done' : null
  const groups = groupWork ?? groupsOf(rooms, bot.id)
  const away = !running && groups.length > 0
  return {
    part, running, active, unread, done, alert, approval, question, seal, doing, groups, away, waits: waiting,
    state: botState(running || away, doing, alert),
  }
}

// Session status and roster arrive separately. Confirm with a fresh host snapshot before
// showing completion; an old request or a failed refresh must never release the seal.
export function createDoneHold(notify, confirm, schedule = setTimeout, cancel = clearTimeout) {
  const pending = new Map()
  const ready = new Set()
  const start = part => {
    const request = { timer: null }
    pending.set(part, request)
    const check = () => {
      Promise.resolve().then(() => confirm(part)).then(ok => {
        if (pending.get(part) !== request) return
        if (ok) { pending.delete(part); ready.add(part); notify(); return }
        request.timer = schedule(check, 1500)
      }, () => {
        if (pending.get(part) === request) request.timer = schedule(check, 1500)
      })
    }
    check()
  }
  return {
    ready,
    update(parts) {
      const wanted = new Set(parts)
      for (const [part, request] of pending) if (!wanted.has(part)) { if (request.timer !== null) cancel(request.timer); pending.delete(part) }
      for (const part of ready) if (!wanted.has(part)) ready.delete(part)
      for (const part of wanted) if (!pending.has(part) && !ready.has(part)) start(part)
    },
    dispose() { for (const request of pending.values()) if (request.timer !== null) cancel(request.timer); pending.clear(); ready.clear() },
  }
}

export function useDoneHold(states, confirm) {
  const [, redraw] = useState(0)
  const hold = useRef(null)
  if (hold.current === null) hold.current = createDoneHold(() => redraw(value => value + 1), part => confirm?.(part) ?? Promise.resolve(false))
  const parts = states.filter(state => state.done).map(state => state.part)
  const key = JSON.stringify(parts)
  useEffect(() => { hold.current.update(JSON.parse(key)) }, [key])
  useEffect(() => () => hold.current.dispose(), [])
  return states.map(state => state.done && !hold.current.ready.has(state.part)
    ? { ...state, done: false, seal: null }
    : state)
}

/** The same derivation for a row that subscribes to the stores itself. */
export function useBotLiveState({ bot, roster, marked = false, useSessions, useSessionStatus, useSessionRetainInfo, useActivity, useWork, confirmCompletion }) {
  const id = bot.id
  const part = currentPart(bot)
  const preview = useSessions(list => previewOf(list, part, roster.exchangeTurns[part]))
  const entry = useSessionStatus(map => map.get(part))
  const active = useSessionRetainInfo ? useSessionRetainInfo(part, info => (info?.retainedBy?.mainView ?? 0) > 0) : false
  const doing = useActivity(map => map[id])
  const approval = useWork ? useWork(work => approvalFor(work, id)) : false
  const rooms = useWork ? useWork(work => JSON.stringify(groupsOf(work.rooms ?? {}, id))) : '[]'
  const waits = workKeys(useWork ? useWork(work => JSON.stringify(work.waiting?.[id] ?? null)) : 'null')
  const turn = useWork ? useWork(work => work.turns?.[part] ?? null) : null
  const [state] = useDoneHold([liveStateOf({ bot, roster, marked, entry, active, doing, approval, groupWork: workKeys(rooms), waiting: waits, turn })], confirmCompletion)
  return { preview, ...state }
}
