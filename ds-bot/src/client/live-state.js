// What a Bot is doing right now, read once for every place that shows it: its sidebar
// row, the court board's figures and its official card. One derivation keeps them in
// step; a second copy would drift the moment either side learns a new state.
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
export function liveStateOf({ bot, roster, marked = false, entry, active = false, doing, approval = false, rooms, waiting = null }) {
  const part = currentPart(bot)
  const running = entry?.running === true
  const unread = entry?.completionUnread === true || entry?.pendingInteraction !== undefined || (marked && !active)
  // Finished work not yet seen is sealed 办 instead of the plain dot; a question waiting
  // for the user keeps the dot.
  const done = entry?.completionUnread === true && entry?.pendingInteraction === undefined && !active && !running
  const alert = roster?.questions?.[part] !== undefined || approval
  const groups = groupsOf(rooms, bot.id)
  const away = !running && groups.length > 0
  return {
    part, running, active, unread, done, alert, approval, doing, groups, away, waits: waiting,
    state: botState(running || away, doing, alert),
  }
}

/** The same derivation for a row that subscribes to the stores itself. */
export function useBotLiveState({ bot, roster, marked = false, useSessions, useSessionStatus, useSessionRetainInfo, useActivity, useWork }) {
  const id = bot.id
  const part = currentPart(bot)
  const preview = useSessions(list => previewOf(list, part, roster.exchangeTurns[part]))
  const entry = useSessionStatus(map => map.get(part))
  const active = useSessionRetainInfo ? useSessionRetainInfo(part, info => (info?.retainedBy?.mainView ?? 0) > 0) : false
  const doing = useActivity(map => map[id])
  const approval = useWork ? useWork(work => approvalFor(work, id)) : false
  const rooms = useWork ? useWork(work => JSON.stringify(groupsOf(work.rooms ?? {}, id))) : '[]'
  const waits = workKeys(useWork ? useWork(work => JSON.stringify(work.waiting?.[id] ?? null)) : 'null')
  return { preview, ...liveStateOf({ bot, roster, marked, entry, active, doing, approval, rooms: workKeys(rooms), waiting: waits }) }
}
