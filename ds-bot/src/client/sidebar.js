import { createElement as h, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { FishLogo } from './dsh-primitives.js'
import { isMainOf, isPinned } from './sources.js'
import { useDragSort } from './drag-sort.js'
import { currentPart, previewOf, relativeShort } from './text.js'
import { ChevronRightIcon, DotsIcon, ImageIcon, PencilIcon, PlusIcon, SearchIcon, SidebarIcon, GaugeIcon, ClockIcon, GearIcon, PinMarkIcon, ConnectorIcon, SwitchIcon, CloudDownloadIcon, SignOutIcon } from './icons.js'
import { MAIN_LOOK } from './characters.js'
import { botState, BotMark, BotAvatar, RoomAvatar, warmPhoto } from './mark.js'
import { reducedMotion } from './activity-row.js'
import { avatarImage } from './avatar-library.js'
import { Shimmer, workPhrase } from './cells.js'
import { springEasing, SPRING_SHAPE, useViewport, viewBottom } from './motion.js'
import { hostText, t } from './i18n.js'
import { showsDshRow } from './dsh-offer.js'

// -------------------------------------------------------------------------
// Sidebar

// Manual "Mark as Unread" lasts until the conversation is opened again.
function useMarkedUnread(id, active, marked, actions) {
  useEffect(() => {
    if (active && marked) actions.clearUnread(id)
  }, [active, marked])
}

const PinMark = () => h('span', { className: 'bt-pin', 'aria-hidden': true }, h(PinMarkIcon))

// Whether an approval waits for the user: for a Bot, in any of its Sessions; for a group,
// from any of its members there.
const useApproval = (useWork, match) => (useWork ? useWork(work => (work.approvals ?? []).some(match)) : false)

// Work running in group Sessions, as "botId|tool" keys so a row redraws only when it
// changes: the groups one Bot works in, or the members at work in one group.
// Picked as text, so a row redraws only when what it shows changes.
const useGroupWork = (useWork, pick) => (useWork ? useWork(work => JSON.stringify(pick(work.rooms ?? {}))) : '[]')
const workKeys = text => JSON.parse(text)
const doingOf = ({ tool, said, note, target, switching }) => ({ tool, said, note, target, switching })
const workLine = (lead, doing, more) => h(Shimmer, null, `${lead} · ${workPhrase(doing)}…${more > 0 ? ` +${more}` : ''}`)
// The row already names the Bot; its own-chat preview is just what it is doing.
const doingLine = (doing, bot) => h(Shimmer, null, `${workPhrase(doing, bot)}…`)
// The Bots and groups a Bot waits for (handoffs.js), by the names they have now.
const waitingFor = (roster, waits) => {
  const names = [...(waits?.bots ?? []).map(id => roster.byId[id]?.name), ...(waits?.rooms ?? []).map(id => roster.roomsById[id]?.name)].filter(Boolean)
  return names.length === 0 ? '' : t('Waiting for {names}', { names: names.join(t(' and ')) })
}

function BotRow({ bot, roster, actions, useSessions, useSessionStatus, useSessionRetainInfo, useActivity, useWork, wide, marked, folded = false }) {
  const id = bot.id
  const part = currentPart(bot)
  // The chat's copy of the photo is made ahead, so opening the chat shows it at once.
  warmPhoto(bot.avatar?.image)
  const preview = useSessions(list => previewOf(list, part, roster.exchangeTurns[part]))
  const running = useSessionStatus(map => map.get(part)?.running === true)
  const active = useSessionRetainInfo(part, info => (info?.retainedBy?.mainView ?? 0) > 0)
  const unread = useSessionStatus(map => map.get(part)?.completionUnread === true || map.get(part)?.pendingInteraction !== undefined) || (marked && !active)
  // Finished work not yet seen is sealed 办 instead of the plain dot; a question waiting
  // for the user keeps the dot.
  const finished = useSessionStatus(map => map.get(part)?.completionUnread === true && map.get(part)?.pendingInteraction === undefined)
  const done = finished && !active && !running
  useMarkedUnread(id, active, marked, actions)
  const main = isMainOf(roster, id)
  const tile = isPinned(roster, bot)
  const approval = useApproval(useWork, entry => entry.botId === id)
  const alert = roster.questions?.[part] !== undefined || approval
  const doing = useActivity(map => map[id])
  // Work in a group runs in a Session of its own, so the Bot's chat stays idle meanwhile.
  const groups = workKeys(useGroupWork(useWork, rooms => Object.entries(rooms).flatMap(([roomId, entries]) => entries.filter(entry => entry.botId === id).map(entry => ({ id: roomId, ...doingOf(entry) })))))
  const away = !running && groups.length > 0
  const state = botState(running || away, doing, alert)
  // A Bot running in its own chat previews what it is doing, like a group's row.
  const runningLine = running && doing ? doingLine(doing, bot) : null
  const awayLine = away ? workLine(roster.roomsById[groups[0].id]?.name ?? t('a group chat'), groups[0], groups.length - 1) : null
  const waits = workKeys(useWork ? useWork(work => JSON.stringify(work.waiting?.[id] ?? null)) : 'null')
  const waitsFor = state === 'waiting' ? waitingFor(roster, waits) : ''
  if ((bot.hidden || folded) && !active && !main) return null
  const onContextMenu = (event) => {
    event.preventDefault()
    actions.openMenu({ kind: 'bot', id, x: event.clientX, y: event.clientY })
  }
  const pinned = false
  const label = [bot.name, main ? t('Main Bot') : '', pinned ? t('Pinned') : '', running || away ? t('Working') : '', waitsFor, approval ? t('Waiting for your approval') : alert ? t('Waiting for your answer') : '', unread ? t('Unread activity') : ''].filter(Boolean).join(', ')
  if (tile && wide) {
    return h('div', { className: 'bt-tile-wrap' }, h('button', {
      type: 'button', className: 'bt-tile', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
      'data-bot-id': id, title: preview || bot.name, onClick: () => actions.openSession(id), onContextMenu,
    },
    h(BotAvatar, { bot, size: 60, state, main, shared: true }),
    h('span', { className: 'bt-tile-name' }, bot.name),
    bot.role ? h('span', { className: 'bt-chip' }, bot.role) : null))
  }
  return h('button', {
    type: 'button', className: 'bt-row', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
    'data-bot-id': id, title: wide ? undefined : bot.name, onClick: () => actions.openSession(id), onContextMenu,
  },
  h(BotAvatar, { bot, size: 36, state, main, shared: true }),
  pinned && !wide ? h(PinMark) : null,
  // The rail has no line for what a Bot is doing: a bubble of dots says it is at work.
  !wide && (running || away) ? h('span', { className: 'bt-busy', 'aria-hidden': true }, h('i'), h('i'), h('i')) : null,
  !wide && done ? h('span', { className: 'bt-done', 'aria-hidden': true }, '办') : null,
  wide ? h('span', { className: 'bt-row-body' },
    h('span', { className: 'bt-row-name' }, h('span', { className: 'bt-row-title' }, bot.name), pinned ? h(PinMark) : null),
    runningLine ? h('span', { className: 'bt-row-preview' }, runningLine)
      : awayLine ? h('span', { className: 'bt-row-preview' }, awayLine)
        : waitsFor ? h('span', { className: 'bt-row-preview' }, waitsFor)
          : preview ? h('span', { className: 'bt-row-preview' }, preview) : null) : null,
  wide && done ? h('span', { className: 'bt-done', 'aria-hidden': true }, '办')
    : wide && unread && !active ? h('span', { className: 'bt-unread', 'aria-hidden': true }) : null)
}

function RoomRow({ room, roster, actions, useSessions, useSessionStatus, useSessionRetainInfo, useWork, wide, marked, folded = false }) {
  const id = room.id
  const fallback = useSessions(list => previewOf(list, id))
  const preview = room.preview?.replace(/\s+/g, ' ').trim() || fallback
  const active = useSessionRetainInfo(id, info => (info?.retainedBy?.mainView ?? 0) > 0)
  const unread = useSessionStatus(map => map.get(id)?.completionUnread === true) || (marked && !active)
  useMarkedUnread(id, active, marked, actions)
  const approval = useApproval(useWork, entry => entry.roomId === id)
  const members = workKeys(useGroupWork(useWork, rooms => (rooms[id] ?? []).map(entry => ({ id: entry.botId, ...doingOf(entry) }))))
  const first = roster.byId[members[0]?.id]
  const workingLine = first ? workLine(first.name, members[0], members.length - 1) : null
  if ((room.hidden || folded) && !active) return null
  const pinned = room.pinned === true
  const label = [room.name, pinned ? t('Pinned') : '', members.length > 0 ? t('Working') : '', approval ? t('Waiting for your approval') : ''].filter(Boolean).join(', ')
  return h('button', {
    type: 'button', className: 'bt-row', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
    'data-room-id': id, onClick: () => actions.openSession(id),
    onContextMenu: (event) => { event.preventDefault(); actions.openMenu({ kind: 'room', id, x: event.clientX, y: event.clientY }) },
  },
  h(RoomAvatar, { room, roster, size: 36 }),
  pinned && !wide ? h(PinMark) : null,
  wide ? h('span', { className: 'bt-row-body' },
    h('span', { className: 'bt-row-name' }, h('span', { className: 'bt-row-title' }, room.name), pinned ? h(PinMark) : null),
    workingLine ? h('span', { className: 'bt-row-preview' }, workingLine) : preview ? h('span', { className: 'bt-row-preview' }, preview) : null) : null,
  wide && approval && !active ? h('span', { className: 'bt-unread bt-unread-wait', 'aria-hidden': true })
    : wide && unread && !active ? h('span', { className: 'bt-unread', 'aria-hidden': true }) : null)
}

// One expanded DSH Agent Session row: title, relative stamp, rename field, and a
// context menu for rename/archive.
function AgentSessionRow({ session, agent, actions, renaming, index }) {
  const input = useRef(null)
  useLayoutEffect(() => {
    if (!renaming) return
    input.current?.focus()
    input.current?.select()
  }, [renaming])
  if (renaming) {
    const commit = (keep) => {
      const value = input.current?.value ?? ''
      if (!keep || value.trim() === '' || value.trim() === session.title) { actions.endAgentRename(); return }
      // The editor closes only after the rename landed; a failure keeps it open.
      void (async () => {
        try {
          await actions.renameAgentSession(agent.id, session.id, value)
          actions.endAgentRename()
        } catch (error) {
          actions.reportError(error, 'agent-rename')
        }
      })()
    }
    return h('div', { className: 'bt-agent-sub-row bt-agent-edit', style: { '--i': index } },
      h('input', {
        ref: input, defaultValue: session.title, 'aria-label': t('Rename'),
        onKeyDown: (event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Enter') commit(true)
          else if (event.key === 'Escape') commit(false)
        },
        onBlur: () => commit(true),
      }))
  }
  return h('button', {
    type: 'button', className: 'bt-agent-sub-row', 'aria-current': session.active ? 'page' : undefined, style: { '--i': index },
    onClick: () => actions.openAgentSession(session.id),
    onContextMenu: (event) => {
      event.preventDefault()
      event.stopPropagation()
      actions.openMenu({ kind: 'agent-session', id: session.id, agentId: agent.id, x: event.clientX, y: event.clientY })
    },
  },
  h('span', { className: 'bt-agent-sub-title' }, session.title),
  h('span', { className: 'bt-agent-sub-time' }, session.at > 0 ? relativeShort(session.at) : ''))
}

// The DSH Agent row: a plain dsh Session list lives in the Bot workspace, so it
// sits among the Bots with the harness's own whale mark.
function AgentRow({ agent, actions, useSessions, useSessionStatus, useUi, wide, marked }) {
  const info = useSessions(list => JSON.stringify(agent.sessions.map((id) => {
    const row = list.byId[id]
    return {
      id,
      // A blank Session's title is the workspace folder name; show the label instead.
      title: row?.blank === true ? '' : (row?.displayTitle ?? row?.title ?? ''),
      at: row?.updatedAt ?? 0,
      running: row?.running === true,
      active: (row?.retainedBy?.mainView ?? 0) > 0,
    }
  }).sort((a, b) => b.at - a.at)))
  const statusInfo = useSessionStatus(map => JSON.stringify(agent.sessions.map(id => ({
    id, running: map.get(id)?.running === true, unread: map.get(id)?.completionUnread === true,
  }))))
  const statuses = Object.fromEntries(JSON.parse(statusInfo).map(entry => [entry.id, entry]))
  const sessions = JSON.parse(info).map(session => ({
    ...session,
    running: statuses[session.id]?.running ?? session.running,
    unread: statuses[session.id]?.unread ?? false,
    title: session.title === '' ? t('New session') : session.title,
  }))
  const renaming = useUi(value => value.renameAgent)
  const active = sessions.some(session => session.active)
  const running = sessions.some(session => session.running)
  const unread = sessions.some(session => session.unread) || (marked && !active)
  useMarkedUnread(agent.id, active, marked, actions)
  const preview = sessions[0]?.title ?? t('New session')
  const label = ['DSH Agent', running ? t('Working') : '', unread ? t('Unread activity') : ''].filter(Boolean).join(', ')
  const open = active && wide
  return h('div', { className: 'bt-agent' },
    h('button', {
      type: 'button', className: 'bt-row', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
      'data-agent-id': agent.id, title: wide ? undefined : 'DSH Agent', onClick: () => actions.openAgent(agent.id),
      onContextMenu: (event) => { event.preventDefault(); actions.openMenu({ kind: 'agent', id: agent.id, x: event.clientX, y: event.clientY }) },
    },
    h('span', { className: `bt-agent-ava${running ? ' bt-run' : ''}` }, h(FishLogo, { size: 22 })),
    wide ? h('span', { className: 'bt-row-body' },
      h('span', { className: 'bt-row-name' }, 'DSH Agent'),
      preview ? h('span', { className: 'bt-row-preview' }, preview) : null) : null,
    wide && unread && !active ? h('span', { className: 'bt-unread', 'aria-hidden': true }) : null),
    h('div', { className: 'bt-agent-sub', 'data-open': open || undefined },
      h('div', { className: 'bt-agent-sub-in' },
        h('button', { type: 'button', className: 'bt-agent-sub-row bt-agent-new', style: { '--i': 0 }, onClick: () => { void actions.newAgentSession(agent.id).catch(error => actions.reportError(error, 'agent-session')) } },
          h(PlusIcon), h('span', { className: 'bt-agent-sub-title' }, t('New session'))),
        sessions.map((session, index) => h(AgentSessionRow, {
          key: session.id, session, agent, actions, index: index + 1,
          renaming: renaming === session.id,
        })))))
}

// List rows glide to new places on a spring.
const GLIDE = springEasing(1000, 63)

function useListGlide(listRef, layout, key, handoff) {
  const tops = useRef({ layout, map: new Map() })
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    // A drop hands over where it left every row: the lifted rows let go here, and the
    // list glides from there.
    const dropped = handoff?.current
    if (dropped) {
      handoff.current = null
      dropped.settle()
      tops.current = { layout, map: dropped.seen }
    }
    const next = new Map()
    const still = reducedMotion() || tops.current.layout !== layout
    for (const row of list.querySelectorAll('[data-bot-id],[data-room-id],[data-agent-id],.bt-sec[data-section]')) {
      const id = row.dataset.botId ?? row.dataset.roomId ?? row.dataset.agentId ?? `section:${row.dataset.section}`
      // offsetTop ignores transforms, so a glide in flight does not skew the next one.
      const top = row.offsetTop
      next.set(id, top)
      const before = tops.current.map.get(id)
      if (!still && before !== undefined && Math.abs(before - top) > 0.5) {
        row.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], GLIDE)
      }
    }
    tops.current = { layout, map: next }
  }, [layout, key])
}

export function TeamSidebar(props) {
  const { wide, expandSidebar, useRoster, useUi, useSessions, actions } = props
  const listRef = useRef(null)
  const closing = useRef(false)
  useLayoutEffect(() => { closing.current = false })
  const roster = useRoster(value => value)
  const markedUnread = useUi(value => value.unread)
  props.useRegistry(value => value)
  const updated = useSessions(list => {
    const stamps = {}
    for (const id of list.ids) stamps[id] = list.byId[id]?.updatedAt ?? 0
    return JSON.stringify(stamps)
  })
  const order = useMemo(() => {
    const stamps = JSON.parse(updated)
    const entries = [
      ...roster.bots.map(bot => ({ kind: 'bot', item: bot, at: stamps[currentPart(bot)] ?? bot.createdAt })),
      ...roster.rooms.map(room => ({ kind: 'room', item: room, at: stamps[room.id] ?? room.createdAt })),
      // The Agent sorts by its most recent Session, falling back to when it was added.
      ...(roster.agents ?? []).map(agent => ({ kind: 'agent', item: agent, at: Math.max(0, ...agent.sessions.map(id => stamps[id] ?? 0)) || agent.createdAt })),
    ]
    // Rows the user arranged keep that order; the rest follow, newest activity first.
    const rank = entry => (Number.isFinite(entry.item.rank) ? entry.item.rank : Infinity)
    return entries.sort((a, b) => rank(a) - rank(b) || b.at - a.at)
  }, [roster, updated])
  const groups = useMemo(() => sectionGroups(order, roster.sections ?? [], roster), [order, roster])
  const handoff = useRef(null)
  const listKey = `${order.map(entry => `${entry.item.id}${isPinned(roster, entry.item) ? '*' : ''}:${entry.item.section ?? ''}`).join(',')}|${(roster.sections ?? []).map(section => `${section.name}${section.collapsed ? '-' : '+'}`).join(',')}`
  useListGlide(listRef, wide, listKey, handoff)
  useDragSort(listRef, { enabled: wide && !roster.readOnly, actions, onLand: (seen, settle) => { handoff.current = { seen, settle } } })
  useLandOnMainBot(roster, useSessions, actions)
  // The shell keeps wide content during its collapse fade. Normalize through its
  // public expansion action before toggling; coalesce synchronous activations
  // until React commits the result.
  const navigate = (open, id) => {
    const result = open(id)
    if (wide && window.innerWidth < 1024 && !closing.current) {
      closing.current = true
      expandSidebar?.()
      actions.toggleSidebar()
    }
    return result
  }
  const rowActions = {
    ...actions,
    openSession: id => navigate(actions.openSession, id),
    openAgent: id => navigate(actions.openAgent, id),
    openAgentSession: id => navigate(actions.openAgentSession, id),
    newAgentSession: id => navigate(actions.newAgentSession, id),
  }
  const rowProps = { roster, actions: rowActions, useSessions, useUi, useSessionStatus: props.useSessionStatus, useSessionRetainInfo: props.useSessionRetainInfo, useActivity: props.useActivity, useWork: props.useWork, wide }
  // Typing while the sidebar has focus starts a search.
  const typeToSearch = (event) => {
    if (event.defaultPrevented || event.key.length !== 1 || event.key === ' ' || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return
    if (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]')) return
    event.preventDefault()
    actions.openPalette(event.key)
  }
  return h('div', { className: wide ? 'bt-side' : 'bt-side bt-rail', onKeyDown: typeToSearch },
    wide ? h('div', { className: 'bt-side-top' },
      h('span', { className: 'bt-brand' }, h(BrandMark, { size: 22 }), h(BrandName)),
      h(UpdateButton, { useUpdate: props.useUpdate, actions }),
      h('button', { type: 'button', className: 'bt-round', 'aria-label': t('Search'), title: t('Search'), onClick: () => actions.openPalette() }, h(SearchIcon)),
      h('button', { type: 'button', className: 'bt-round', 'aria-label': t('New…'), title: t('New…'), onClick: () => actions.openNewChat('new') }, h(PlusIcon)),
      h('button', { type: 'button', className: 'bt-round bt-side-collapse', 'aria-label': t('Collapse sidebar'), title: t('Collapse sidebar'), onClick: () => actions.toggleSidebar() }, h(SidebarIcon)))
      : h(Fragment, null,
          h(UpdateButton, { useUpdate: props.useUpdate, actions }),
          h('button', { type: 'button', className: 'bt-round', 'aria-label': t('New…'), title: t('New…'), onClick: () => actions.openNewChat('new') }, h(PlusIcon))),
    wide && roster.readOnly ? h('div', { className: 'bt-hint bt-read-only', role: 'status' }, hostText(roster.readOnly)) : null,
    h('div', { ref: listRef, className: 'bt-list', role: 'region', 'aria-label': t('Bot list') },
      roster.ready || roster.byId[roster.mainBotId] ? null : h('div', { className: 'bt-hint' }, t('Setting up your Main Bot…')),
      groups.tiles.length > 0 ? h('div', { className: 'bt-tiles' }, groups.tiles.map(entry => rowOf(entry))) : null,
      groups.pinned.map(entry => rowOf(entry)),
      groups.sections.map(({ section, entries }) => h(Fragment, { key: `section:${section.name}` },
        // In the rail an empty section draws no rule, so rules never double up.
        wide || entries.some(entry => !entry.item.hidden) ? h(SectionHeader, { section, count: entries.filter(entry => !entry.item.hidden).length, wide, actions }) : null,
        // A rail has no room for headings, so it shows every row under a thin rule.
        entries.map(entry => rowOf(entry, wide && section.collapsed === true)))),
      groups.sections.length > 0 && groups.loose.length > 0 && wide ? h('div', { className: 'bt-sec-rest', role: 'separator' }) : null,
      groups.loose.map(entry => rowOf(entry))))

  function rowOf(entry, folded = false) {
    const marked = markedUnread[entry.item.id] === true
    return entry.kind === 'bot'
      ? h(BotRow, { key: entry.item.id, ...rowProps, bot: entry.item, marked, folded })
      : entry.kind === 'room'
        ? h(RoomRow, { key: entry.item.id, ...rowProps, room: entry.item, marked, folded })
        : h(AgentRow, { key: entry.item.id, ...rowProps, agent: entry.item, marked })
  }
}

// Pinned rows stay on top whatever their section; then each section in the user's
// order, its rows by recent activity; then the rows in no section. The DSH Agent
// is in no section.
export function sectionGroups(order, sections, roster = {}) {
  const key = name => String(name).toLocaleLowerCase()
  const slots = new Map(sections.map(section => [key(section.name), { section, entries: [] }]))
  const tiles = []
  const pinned = []
  const loose = []
  for (const entry of order) {
    const slot = entry.kind !== 'agent' && typeof entry.item.section === 'string' ? slots.get(key(entry.item.section)) : undefined
    if (entry.kind === 'bot' && isPinned(roster, entry.item)) tiles.push(entry)
    else if (entry.item.pinned === true) pinned.push(entry)
    else if (slot) slot.entries.push(entry)
    else loose.push(entry)
  }
  // Tiles keep the order they were pinned in, the first Main Bot first.
  const rank = entry => (entry.item.id === roster.mainBotId ? -Infinity : entry.item.pinnedAt ?? entry.item.createdAt ?? 0)
  tiles.sort((a, b) => rank(a) - rank(b))
  return { tiles, pinned, sections: [...slots.values()], loose }
}

// A section's heading: a click folds or opens it, and its menu renames, moves or
// deletes it.
function SectionHeader({ section, count, wide, actions }) {
  if (!wide) return h('div', { className: 'bt-sec-rule', role: 'separator', title: section.name })
  const folded = section.collapsed === true
  const openMenu = (x, y) => actions.openMenu({ kind: 'section', id: section.name, x, y })
  const fold = () => { void Promise.resolve(actions.arrangeSection(section.name, { collapsed: !folded })).catch(error => actions.reportError?.(error, 'section')) }
  return h('div', { className: 'bt-sec', 'data-section': section.name, 'data-folded': folded || undefined, onContextMenu: (event) => { event.preventDefault(); openMenu(event.clientX, event.clientY) } },
    h('button', { type: 'button', className: 'bt-sec-head', 'aria-expanded': !folded, onClick: fold },
      h('span', { className: 'bt-sec-caret', 'aria-hidden': true }, h(ChevronRightIcon)),
      h('span', { className: 'bt-sec-name' }, section.name),
      folded && count > 0 ? h('span', { className: 'bt-sec-count' }, count) : null),
    h('button', {
      type: 'button', className: 'bt-sec-more', 'aria-label': t('{name} actions', { name: section.name }),
      onClick: (event) => { const box = event.currentTarget.getBoundingClientRect(); openMenu(box.left, box.bottom + 4) },
    }, h(DotsIcon)))
}

// The update button at the sidebar's top right: a cloud while a newer DS Bot —
// or a newer verified DSH — is available, then the install's progress and
// result. Its card has one row each for the bot and DSH, with their versions,
// the release notes link, and each row's own button.
function UpdateButton({ useUpdate, actions }) {
  const update = useUpdate(value => value)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState(null)
  const [error, setError] = useState('')
  const [dshError, setDshError] = useState('')
  const button = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (event.target instanceof Element && (event.target.closest('.bt-update-pop') || button.current?.contains(event.target))) return
      setOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus() } }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  const phase = update?.phase ?? 'idle'
  const dsh = update?.dsh
  const dshPhase = dsh?.phase ?? 'idle'
  const dshRow = showsDshRow(dsh, update?.app)
  // Hooks first: an update that turns visible after the sidebar mounted would
  // otherwise add hooks on a later render and crash the slot.
  const tick = useViewport()
  useLayoutEffect(() => {
    if (!open) return
    const rect = button.current?.getBoundingClientRect()
    if (rect) setBox({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)), top: rect.bottom + 6 })
  }, [open, tick])
  if (!update?.available && !dshRow && phase === 'idle' && dshPhase === 'idle') return null
  const cloudPhase = phase === 'installing' || dshPhase === 'installing' ? 'installing' : phase !== 'idle' ? phase : dshPhase
  const toggle = () => setOpen(value => !value)
  const start = () => {
    setError('')
    void actions.installUpdate().catch(failure => setError(hostText(failure?.message ?? String(failure))))
  }
  const startDsh = () => {
    setDshError('')
    void actions.installDshUpdate().catch(failure => setDshError(hostText(failure?.message ?? String(failure))))
  }
  const label = phase === 'installing' ? t('Updating DS Bot…')
    : dshPhase === 'installing' ? t('Updating DSH…')
      : phase === 'installed' ? t('DS Bot {version} is installed. Restart DSH to use it.', { version: update.installed ?? update.latest })
        : phase === 'updated' ? t('DS Bot {version} is installed.', { version: update.installed ?? update.latest })
        : dshPhase === 'installed' ? t('Restart DSH to start using DSH {version}.', { version: dsh.installed ?? dsh.verified })
          : update?.available ? t('DS Bot {version} is available', { version: update.latest })
            : t('DSH {version} is available', { version: dsh?.verified })
  const message = error || (phase === 'failed' ? update.error : '')
  const dshMessage = dshError || (dshPhase === 'failed' ? dsh?.error : '')
  const dshText = dshPhase === 'installed'
    ? t('Restart DSH to start using DSH {version}.', { version: dsh.installed ?? dsh.verified })
    : dsh?.available === false && dsh?.blockedBy
      ? t('Update DS Bot {version} first.', { version: dsh.blockedBy })
      : t('You have {version}.', { version: dsh?.current })
  return h(Fragment, null,
    h('button', {
      ref: button, type: 'button', className: 'bt-round bt-update', 'data-phase': cloudPhase, 'aria-label': label, title: label,
      'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: toggle,
    }, h(CloudDownloadIcon, { done: phase === 'installed' || phase === 'updated' }), phase === 'failed' || dshPhase === 'failed' ? h('span', { className: 'bt-update-dot', 'aria-hidden': true }) : null),
    open && box ? createPortal(h('div', { className: 'bt-update-pop', role: 'dialog', 'aria-label': update?.available || phase !== 'idle' ? t('DS Bot update') : t('DSH update'), style: box },
      update?.available || phase !== 'idle' ? h(Fragment, null,
        h('div', { className: 'bt-update-title' }, phase === 'installed' || phase === 'updated' ? t('Update installed') : t('DS Bot {version}', { version: update.latest })),
        h('div', { className: 'bt-update-text' }, phase === 'installed'
          ? t('Restart DSH to start using DS Bot {version}.', { version: update.installed ?? update.latest })
          : phase === 'updated' ? t('DS Bot {version} is installed.', { version: update.installed ?? update.latest })
            : t('You have {version}.', { version: update.current })),
        message ? h('div', { className: 'bt-update-error', role: 'alert' }, t('The update did not finish: {reason}', { reason: message })) : null,
        h('div', { className: 'bt-update-actions' },
          update.notesUrl ? h('a', { className: 'bt-update-notes', href: update.notesUrl, target: '_blank', rel: 'noopener noreferrer' }, t("What's new")) : null,
          phase === 'installed' || phase === 'updated' ? null : h('button', {
            type: 'button', className: 'bt-update-go', disabled: phase === 'installing', onClick: start,
          }, phase === 'installing' ? t('Updating…') : phase === 'failed' ? t('Try again') : t('Update')))) : null,
      dshRow ? h('div', { className: 'bt-update-dsh' },
        h('div', { className: 'bt-update-title' }, t('DSH {version}', { version: dsh.verified })),
        h('div', { className: 'bt-update-text' }, dshText),
        dshMessage ? h('div', { className: 'bt-update-error', role: 'alert' }, t('The update did not finish: {reason}', { reason: dshMessage })) : null,
        h('div', { className: 'bt-update-actions' },
          dsh.kind === 'app' ? (dsh.available
            ? h('button', { type: 'button', className: 'bt-update-go', onClick: () => void actions.openAppUpdates(dsh.verified).catch(() => {}) }, t('Open updates'))
            : null)
            : !dsh.available && dshPhase === 'idle' ? null
              : dshPhase === 'installed' ? null
                : h('button', {
                  type: 'button', className: 'bt-update-go', disabled: dshPhase === 'installing', onClick: startDsh,
                }, dshPhase === 'installing' ? t('Updating…') : dshPhase === 'failed' ? t('Try again') : t('Update')))) : null), document.body) : null)
}

// Account seat of the Settings trigger: the visible label stays for assistive tech only.
// The user's face: the picture they chose, else the whale.
function YouFace({ useRoster }) {
  const image = useRoster ? useRoster(value => value.prefs?.you?.image) : undefined
  const [broken, setBroken] = useState('')
  if (typeof image === 'string' && image !== '' && image !== broken) {
    return h('span', { className: 'bt-you bt-you-photo', 'aria-hidden': true }, h('img', { src: image, alt: '', draggable: false, onError: () => setBroken(image) }))
  }
  return h('span', { className: 'bt-you', 'aria-hidden': true }, h(BotMark, { look: MAIN_LOOK, size: 24 }))
}

export function YouAvatar({ useRoster } = {}) {
  return h('span', { className: 'bt-you-wrap' },
    h(YouFace, { useRoster }),
    h('span', { style: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }, t('Settings')))
}

let openShellSettings = null
let openShellOnboarding = null
let shellShortcuts = null

export function holdShellShortcuts(shortcuts) {
  shellShortcuts = shortcuts
  return () => { if (shellShortcuts === shortcuts) shellShortcuts = null }
}

// DeepSeek Harness hands its settings opener only to the settings.launcher seat. When
// the Desktop's account menu holds that seat, its first item (Settings) is the way in;
// the Desktop on Windows and macOS takes shortcuts natively, so a synthetic key press
// reaches the shell only where the page delivers them (the Web, Linux).
export function openHarnessSettings() {
  // A frame first, so a Bot dialog that closes on this click leaves the modal stack.
  requestAnimationFrame(() => {
    if (openShellSettings) { openShellSettings(); return }
    const desktop = document.querySelector('button[aria-haspopup="menu"][data-signed-out]')
    if (desktop) openThroughMenu(desktop)
    else pressSettingsShortcut()
  })
}

// Opens one of the shell's own onboarding editors, such as the DeepSeek API key form.
export function openHarnessOnboarding(id) {
  requestAnimationFrame(() => {
    if (openShellOnboarding) openShellOnboarding(id)
    else openHarnessSettings()
  })
}

function openThroughMenu(trigger) {
  const before = new Set(document.querySelectorAll('[role="menu"]'))
  trigger.click()
  let frames = 0
  const look = () => {
    const menu = [...document.querySelectorAll('[role="menu"]')].find(node => !before.has(node))
    const item = menu?.querySelector('button[role="menuitem"]')
    if (item) item.click()
    else if (++frames < 30) requestAnimationFrame(look)
    else pressSettingsShortcut()
  }
  requestAnimationFrame(look)
}

function pressSettingsShortcut() {
  const binding = shellShortcuts?.catalog.getSnapshot().find(row => row.id === 'settings.open')?.binding
  if (!binding) return
  const held = new Set(binding.modifiers)
  window.dispatchEvent(new KeyboardEvent('keydown', {
    code: binding.code, key: binding.code === 'Comma' ? ',' : '', bubbles: true, cancelable: true,
    ctrlKey: held.has('control'), altKey: held.has('alt'), shiftKey: held.has('shift'), metaKey: held.has('meta'),
  }))
}

const NO_SUBSCRIBE = () => () => {}
const NO_SNAPSHOT = () => null

// The footer avatar opens an account menu above itself, with Bot settings as one
// entry. Shell panels hidden from the Bot sidebar (plugins, automation) live here too.
// `seat` is the shell's settings.launcher seat: at priority -10 the whale wins it
// over a shell account plugin's own launcher (the Desktop's "··· More"), which comes
// back in Agent mode; FooterAccount stands in while no seat exists at all.
export function AccountLauncher({ seat = true, settingsOpen, openSettings, openOnboarding, actions, useRoster }) {
  const picker = useRef(null)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    if (!seat) return undefined
    actions.seatAccount(true)
    return () => actions.seatAccount(false)
  }, [seat])
  const [box, setBox] = useState(null)
  const button = useRef(null)
  useEffect(() => { if (settingsOpen) setOpen(false) }, [settingsOpen])
  // The settings dialog links back to the shell's own settings (models, providers).
  useEffect(() => {
    if (!openSettings) return undefined
    openShellSettings = openSettings
    return () => { if (openShellSettings === openSettings) openShellSettings = null }
  }, [openSettings])
  useEffect(() => {
    if (!openOnboarding) return undefined
    openShellOnboarding = openOnboarding
    return () => { if (openShellOnboarding === openOnboarding) openShellOnboarding = null }
  }, [openOnboarding])
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (event.target instanceof Element && (event.target.closest('.bt-account-menu') || button.current?.contains(event.target))) return
      setOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus() } }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  // The shell's account plugin lends its sign-out operation; the item shows only
  // when the plugin's entry is there and its account snapshot says signed in. The
  // entry can arrive after this mounts, so its operations follow the entry.
  const signIn = actions.signInEntry?.() ?? null
  const ops = useMemo(() => signIn?.inject?.() ?? {}, [signIn])
  const accountSource = ops.hooks?.account
  const account = useSyncExternalStore(accountSource?.subscribe ?? NO_SUBSCRIBE, accountSource ? () => accountSource.getSnapshot() : NO_SNAPSHOT)
  const signedIn = signIn !== null && typeof ops.signOut === 'function' && account?.view?.status === 'credential-stored'
  const accountT = actions.accountT?.() ?? (key => key)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const askSignOut = async () => {
    setSignOutError('')
    let state = 'none'
    try {
      if (await ops.hasRunningAccountTasks?.()) state = 'running'
    } catch { state = 'unknown' }
    setConfirm(state)
  }
  const cancelSignOut = () => { setConfirm(null); setSignOutError('') }
  const runSignOut = async () => {
    setBusy(true)
    setSignOutError('')
    try {
      await ops.signOut()
      setConfirm(null)
      setOpen(false)
    } catch (error) {
      setSignOutError(String(error?.message ?? error))
    } finally {
      setBusy(false)
    }
  }
  const tick = useViewport()
  const anchor = () => {
    const rect = button.current?.getBoundingClientRect()
    if (rect) setBox({ left: rect.left, bottom: viewBottom() - rect.top + 5 })
  }
  useLayoutEffect(() => { if (open) anchor() }, [open, tick])
  const toggle = () => { if (!open) anchor(); setOpen(value => !value) }
  // Closing the menu drops a half-finished sign-out confirm with it.
  useEffect(() => {
    if (open) return
    setConfirm(null)
    setSignOutError('')
    setBusy(false)
  }, [open])
  const hasPhoto = Boolean(useRoster?.(value => value.prefs?.you?.image))
  const myName = useRoster?.(value => value.prefs?.you?.name) ?? ''
  // The profile: the menu's first row shows the picture and the name; it opens one panel
  // that changes both.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  useEffect(() => { if (!open) setEditing(false) }, [open])
  const editProfile = () => { setDraft(myName); setEditing(true) }
  const saveProfile = (event) => {
    event?.preventDefault()
    setOpen(false)
    if (draft.trim() !== myName) void Promise.resolve(actions.setPrefs({ youName: draft })).catch(error => actions.reportError(error, 'menu'))
  }
  const groups = [
    [
      [t('Usage'), GaugeIcon, () => actions.openSettings('usage')],
      [t('Connectors'), ConnectorIcon, () => actions.openConnectors()],
      [t('Automation tasks'), ClockIcon, () => actions.selectPanel('schedules')],
      [t('Bot settings'), GearIcon, () => actions.openSettings('general')],
    ],
    [
      [t('Switch to classic Agent mode'), SwitchIcon, () => actions.setSurface('agent')],
    ],
  ]
  if (signedIn) groups.push([[accountT('signOut'), SignOutIcon, askSignOut, undefined, true]])
  return h(Fragment, null,
    h('button', { ref: button, type: 'button', className: 'bt-account', 'aria-label': t('Account'), 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: toggle },
      h(YouFace, { useRoster }),
      h('span', { className: 'bt-you-name' }, myName || t('Me'))),
    h('input', { ref: picker, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true, onChange: (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void avatarImage(file).then(image => actions.setPrefs({ youImage: image })).catch(error => actions.reportError(error, 'menu'))
    } }),
    open && box ? createPortal(h('div', { className: 'bt-menu bt-menu-up bt-account-menu', role: 'menu', 'aria-label': t('Account'), style: box },
      editing ? h('form', { className: 'bt-profile', onSubmit: saveProfile },
        h('button', { type: 'button', className: 'bt-profile-face', 'aria-label': t('Change my picture'), title: t('Change my picture'), onClick: () => picker.current?.click() },
          h(YouFace, { useRoster }), h('span', { className: 'bt-profile-cam', 'aria-hidden': true }, h(ImageIcon))),
        hasPhoto ? h('button', { type: 'button', className: 'bt-profile-reset', onClick: () => { void Promise.resolve(actions.setPrefs({ youImage: null })).catch(error => actions.reportError(error, 'menu')) } }, t('Use the default picture')) : h('span', { className: 'bt-profile-tip' }, t('Click the picture to change it')),
        h('input', { autoFocus: true, value: draft, maxLength: 24, placeholder: t('Your name'), 'aria-label': t('Your name'), onChange: event => setDraft(event.target.value) }),
        h('div', { className: 'bt-confirm-row' },
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => setEditing(false) }, t('Cancel')),
          h('button', { type: 'submit', className: 'bt-confirm-go' }, t('Save'))))
      : confirm !== null ? h('div', { className: 'bt-confirm', role: 'alertdialog', 'aria-label': accountT('signOut') },
        h('p', { className: 'bt-confirm-text' }, accountT(confirm === 'running' ? 'signOutRunningDescription' : confirm === 'unknown' ? 'signOutUnknownDescription' : 'signOutDescription')),
        signOutError !== '' ? h('p', { className: 'bt-confirm-error', role: 'alert' }, signOutError) : null,
        h('div', { className: 'bt-confirm-row' },
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: cancelSignOut }, t('Cancel')),
          h('button', { type: 'button', className: 'bt-confirm-go', disabled: busy, onClick: () => { void runSignOut() } }, accountT('signOut'))))
        : [h('button', { key: 'profile', type: 'button', role: 'menuitem', className: 'bt-profile-row', onClick: editProfile },
          h(YouFace, { useRoster }),
          h('span', { className: 'bt-profile-text' }, h('span', { className: 'bt-profile-name' }, myName || t('Me')), h('span', { className: 'bt-profile-hint' }, t('Edit picture and name'))),
          h(PencilIcon)),
        ...groups.map((group, index) => h(Fragment, { key: index },
          h('div', { className: 'bt-menu-sep', role: 'separator' }),
          group.map(([label, Icon, run, hint, stay]) => h('button', {
            key: label, type: 'button', role: 'menuitem',
            onClick: () => { if (stay !== true) setOpen(false); void Promise.resolve(run()).catch(error => actions.reportError(error, 'menu')) },
          }, h(Icon), h('span', { className: 'bt-menu-label' }, label), hint ? h('span', { className: 'bt-menu-hint' }, hint) : null))))]), document.body) : null)
}

// Opens the Main Bot whenever the main view holds no Bot conversation, the way
// The view always lands on a Bot rather than an empty New Session page.
// When a Bot's chat moves on to a fresh part, the shell clears the view of the part
// it archived; the chat then goes on in the Bot's current part instead.
function useLandOnMainBot(roster, useSessions, actions) {
  const mainView = useSessions((list) => {
    const row = Object.values(list.byId).find(session => (session?.retainedBy?.mainView ?? 0) > 0)
    return row ? `${row.id}|${row.blank ? 1 : 0}` : ''
  })
  const lastBot = useRef(null)
  useEffect(() => {
    if (!roster.ready || !roster.mainBotId) return undefined
    const [id, blank] = mainView.split('|')
    const bot = id === '' ? undefined : roster.byId[id]
    if (bot !== undefined) {
      lastBot.current = { botId: bot.id, sessionId: id }
      if (currentPart(bot) !== id) actions.landOn(bot.id)
      return undefined
    }
    // A DSH Agent Session, blank or not, is a real destination: it stays.
    if (id !== '' && (roster.roomsById[id] || (actions.isAgentSession?.(id) ?? roster.agentOf[id] !== undefined) || blank !== '1')) {
      lastBot.current = null
      return undefined
    }
    const last = lastBot.current
    const timer = setTimeout(() => actions.landOn(roster.mainBotId, last), last ? 0 : 400)
    return () => clearTimeout(timer)
  }, [mainView, roster])
}

export function FooterAccount(props) {
  const seated = props.useUi(value => value.accountSeated === true)
  if (seated) return null
  return h('span', { className: 'bt-foot-account' }, h(AccountLauncher, { ...props, seat: false }))
}

// The only entry registered in every mode: in Agent mode the whole Bot surface is
// withdrawn, and this button in the shell's own footer is the way back.
export function BotReturn({ wide, useSurface, actions }) {
  const mode = useSurface(value => value.mode)
  if (mode !== 'agent') return null
  return h('button', { type: 'button', className: 'bt-return', 'aria-label': t('DS Bot'), title: t('DS Bot'), onClick: () => actions.setSurface('bot') },
    h(BotMark, { look: MAIN_LOOK, size: 20 }),
    wide ? h('span', { className: 'bt-return-name' }, t('DS Bot')) : null)
}

// Agent mode has none of the shell-group styles, so the return button carries its own.
export const RETURN_CSS = `
.bt-return{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:none;color:inherit;font:inherit;font-size:14px;line-height:20px;cursor:pointer;transition:background-color .12s ease}
.bt-return:hover{background:rgba(127,127,127,.14)}
.bt-return:active{transform:scale(.96)}
.bt-return .bt-mark{display:inline-flex;flex:none;line-height:0}
.bt-return .bt-mark svg{width:100%;height:100%;overflow:visible}
/* Shell styles carry --bt-ink-deepseek and Agent mode withdraws them; pin it here. */
.bt-return .bt-mark{--bt-ink-deepseek:#4D6BFE}
.bt-return-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`

export function BrandMark({ size = 24 }) {
  return h('span', { className: 'bt-brand-whale' }, h(BotMark, { look: MAIN_LOOK, size }))
}
export function BrandName() {
  return h('span', { style: { fontWeight: 600, fontSize: 14 } }, 'DS Bot')
}

// With the whale holding the settings seat, the Bot row is just the account menu;
// FooterAccount only shows when the seat went to no one. The shell's footer classes
// are CSS-module names, so they match on their stems.
export const SIDEBAR_CSS = `
.bt-you-photo{overflow:hidden}
/* Work at a glance: dots over a Bot's mark in the rail while it works, and a small
   cinnabar 办 seal, stamped askew, on finished work not yet seen. */
.bt-busy{position:absolute;top:3px;left:calc(50% + 9px);display:inline-flex;align-items:center;gap:2px;height:12px;padding:0 4px;border-radius:999px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line-2),0 1px 2px rgba(0,0,0,.08);pointer-events:none}
.bt-busy i{width:3px;height:3px;border-radius:50%;background:var(--bt-ink-2);animation:bt-busy-dot 1.2s ease-in-out infinite}
.bt-busy i:nth-child(2){animation-delay:.15s}
.bt-busy i:nth-child(3){animation-delay:.3s}
@keyframes bt-busy-dot{0%,60%,100%{opacity:.35;translate:0 0}30%{opacity:1;translate:0 -1.5px}}
.bt-done{flex:none;display:grid;place-items:center;box-sizing:border-box;width:18px;height:18px;margin-right:1px;border:1.5px solid var(--bt-cinnabar);border-radius:4px;color:var(--bt-cinnabar);font-family:"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif;font-weight:900;font-size:11px;line-height:1;rotate:-10deg;opacity:.9;pointer-events:none;animation:bt-stamp-down .45s cubic-bezier(.3,1.5,.5,1) both}
.bt-rail .bt-done{position:absolute;top:28px;left:calc(50% + 7px);width:16px;height:16px;font-size:10px;background:var(--bt-sidebar)}
/* Opening the sidebar: its rows ease in from the left while the column widens, a beat after
   the top row, instead of being uncovered as the column grows. */
@keyframes bt-wide-in{from{opacity:0;transform:translateX(-10px)}}
.bt-side:not(.bt-rail)>.bt-side-top{animation:bt-wide-in .3s cubic-bezier(.32,.72,0,1) backwards}
.bt-side:not(.bt-rail)>.bt-list{animation:bt-wide-in .34s cubic-bezier(.32,.72,0,1) .04s backwards}
@media (prefers-reduced-motion:reduce){.bt-busy i,.bt-done,.bt-side>.bt-side-top,.bt-side>.bt-list{animation:none}}
.bt-menu .bt-profile-row{gap:10px;padding:6px 8px;min-height:48px}
.bt-menu .bt-profile-row>.bt-you{flex:none}
.bt-menu .bt-profile-row>svg{margin-left:auto;color:var(--bt-ink-3)}
.bt-profile-text{display:flex;flex-direction:column;min-width:0}
.bt-profile-name{font-size:14px;font-weight:600;color:var(--bt-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-profile-hint{font-size:12px;color:var(--bt-ink-3)}
.bt-profile{width:100%;padding:10px 6px 6px;display:flex;flex-direction:column;align-items:center;gap:10px;box-sizing:border-box}
.bt-menu .bt-profile-face{position:relative;width:64px;height:64px;min-height:0;padding:0;border-radius:50%;justify-content:center}
.bt-menu .bt-profile-face:hover{background:none}
.bt-profile-face>.bt-you{width:64px;height:64px}
.bt-profile-face>.bt-you .bt-mark{width:40px!important;height:40px!important}
.bt-profile-cam{position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:50%;corner-shape:round;display:grid;place-items:center;background:var(--bt-card);box-shadow:0 0 0 1px var(--bt-line-2);color:var(--bt-ink-2)}
.bt-menu .bt-profile-cam svg{width:14px;height:14px;margin:0}
.bt-menu .bt-profile-reset{width:auto;min-height:0;padding:2px 6px;font-size:12px;color:var(--bt-ink-2)}
.bt-profile-tip{font-size:12px;color:var(--bt-ink-3)}
.bt-profile input{width:100%;box-sizing:border-box;height:32px;border:0;border-radius:8px;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:13px;padding:0 10px;outline:none;text-align:center;box-shadow:inset 0 0 0 .5px var(--bt-line-2)}
.bt-profile input:focus{box-shadow:inset 0 0 0 1px var(--bt-accent)}
.bt-profile .bt-confirm-row{align-self:stretch}
.bt-menu .bt-profile .bt-confirm-row button{width:auto;min-height:0;height:28px;padding:0 14px;border-radius:999px;font-size:13px;justify-content:center}
.bt-menu .bt-profile .bt-confirm-row .bt-soft{background:var(--bt-hover)}
.bt-menu .bt-profile .bt-confirm-row .bt-confirm-go{background:var(--bt-accent);color:var(--bt-accent-ink);font-weight:500}
.bt-menu .bt-profile .bt-confirm-row .bt-confirm-go:hover{background:var(--bt-accent);opacity:.9}
.bt-account:has(.bt-you-name){display:inline-flex;align-items:center;gap:10px;width:auto;max-width:200px;padding-right:12px;border-radius:999px}
.bt-you-name{min-width:0;font-size:14px;font-weight:500;color:var(--bt-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-rail .bt-you-name,[class*="_collapsed"] .bt-you-name{display:none}
[class*="_collapsed"] .bt-account,.bt-rail .bt-account{width:36px;padding:0;gap:0}
.bt-you-photo img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.bt-sec{display:flex;align-items:center;gap:2px;margin-top:12px;padding-right:4px;border-radius:8px}
.bt-sec-head{flex:1;min-width:0;display:flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:8px;background:none;color:color-mix(in srgb,var(--bt-ink) 66%,transparent);font:inherit;font-size:13px;font-weight:500;text-align:left;cursor:pointer;transition:color .12s ease}
.bt-sec-head:hover{color:var(--bt-ink)}
/* The caret shows on hover, and stays while the section is folded. */
.bt-sec-caret{order:1;flex:none;display:inline-flex;opacity:0;transform:rotate(90deg);transition:transform ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing},opacity .12s ease}
.bt-sec:hover .bt-sec-caret,.bt-sec[data-folded] .bt-sec-caret,.bt-sec-head:focus-visible .bt-sec-caret{opacity:1}
.bt-sec-count{order:2}
.bt-sec-caret svg{width:12px;height:12px}
.bt-sec[data-folded] .bt-sec-caret{transform:none}
.bt-sec-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-sec-count{flex:none;margin-left:2px;font-weight:400;font-variant-numeric:tabular-nums}
.bt-sec-more{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;border-radius:6px;background:none;color:var(--bt-ink-3);cursor:pointer;opacity:0;transition:opacity .12s ease}
.bt-sec:hover .bt-sec-more,.bt-sec-more:focus-visible{opacity:1}
.bt-sec-more:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-sec-more svg{width:16px;height:16px}
.bt-sec-rule,.bt-sec-rest{flex:none;height:.5px;margin:6px 12px;background:var(--bt-line-2)}
.bt-sec-rest{margin:10px 8px 4px}
@media (prefers-reduced-motion:reduce){.bt-sec-caret{transition:none}}
.bt-menu-head{padding:4px 8px 2px;font-size:12px;line-height:16px;color:var(--bt-ink-3)}
.bt-menu-field{padding:2px 2px 0}
.bt-menu-field input{width:100%;box-sizing:border-box;height:30px;border:0;border-radius:6px;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:13px;padding:0 8px;outline:none;box-shadow:inset 0 0 0 .5px var(--bt-line-2)}
.bt-menu-field input:focus{box-shadow:inset 0 0 0 1px var(--bt-accent)}
.bt-menu .bt-menu-tick{flex:none;display:inline-flex;width:18px;justify-content:center}
.bt-confirm{width:260px;max-width:72vw;padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px}
.bt-confirm-text{margin:0;font-size:13px;line-height:19px;color:var(--bt-ink-2)}
.bt-confirm-error{margin:0;font-size:12px;line-height:17px;color:var(--bt-danger);overflow-wrap:anywhere}
.bt-confirm-row{display:flex;justify-content:flex-end;gap:8px}
.bt-menu .bt-confirm button{width:auto;min-height:0}
.bt-confirm-go{height:28px;padding:0 14px;border:0;border-radius:999px;background:var(--bt-accent);color:var(--bt-accent-ink);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .12s ease}
.bt-confirm-go:hover:not(:disabled){opacity:.9}
.bt-confirm-go:disabled{opacity:.6;cursor:default}
.bt-side-top .bt-brand{cursor:default;padding-left:6px}
.bt-side-top .bt-brand:hover{background:none}
.bt-brand .bt-mark{flex:none}
.bt-pin{flex:none;display:inline-flex;color:var(--bt-ink-3)}
.bt-rail .bt-row{position:relative}
.bt-rail>.bt-list{margin-inline:-16px;padding-inline:16px}
.bt-rail .bt-pin{position:absolute;top:3px;left:calc(50% + 12px)}
.bt-side .bt-read-only{margin:4px 8px 6px;padding:8px 10px;border-radius:10px;background:var(--bt-hover);font-size:12px;line-height:1.45;text-align:left}
[class*="_footArea"]:has(.bt-foot-account){grid-template-columns:auto minmax(0,1fr) auto;column-gap:6px}
[class*="_footArea"]>[class*="_footerActions"]>div>.bt-foot-account{grid-column:1;order:1;display:inline-flex}
[class*="_footArea"]:has(.bt-foot-account)>[class*="_settingsArea"]{grid-column:3}
[class*="_footArea"]:has(.bt-foot-account)>[class*="_settingsArea"] button[class*="_trigger"] [class*="_label"]{display:none!important}

/* The update cloud springs in when a newer DS Bot shows up; its arrow drops in a
   loop while the install runs. */
.bt-round.bt-update{position:relative;color:var(--bt-accent,#4D6BFE);animation:bt-update-in ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
.bt-round.bt-update svg{width:17px;height:17px}
.bt-round.bt-update[data-phase=installed]{color:var(--bt-ink-2)}
@keyframes bt-update-in{from{opacity:0;transform:scale(.6);filter:blur(4px)}}
.bt-update[data-phase=installing] .bt-cloud-arrow{animation:bt-cloud-drop 1.1s cubic-bezier(.45,0,.55,1) infinite}
@keyframes bt-cloud-drop{0%{transform:translateY(-3px);opacity:0}35%{opacity:1}70%{transform:translateY(1px);opacity:1}100%{transform:translateY(2px);opacity:0}}
.bt-update-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:#E5484D;box-shadow:0 0 0 1.5px var(--bt-sidebar)}
.bt-update-pop{position:fixed;z-index:60;width:280px;padding:14px 14px 12px;border-radius:14px;background:var(--bt-main);border:.5px solid var(--bt-line-2);box-shadow:0 10px 20px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);color:var(--bt-ink);box-sizing:border-box;transform-origin:top left;font-family:var(--bt-font);animation:bt-update-pop ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
@keyframes bt-update-pop{from{opacity:0;transform:scale(.96);filter:blur(4px)}}
.bt-update-title{font-size:14px;line-height:20px;font-weight:600}
.bt-update-text{margin-top:2px;font-size:12.5px;line-height:18px;color:var(--bt-ink-2)}
.bt-update-error{margin-top:8px;font-size:12px;line-height:17px;color:var(--bt-danger);overflow-wrap:anywhere;max-height:90px;overflow:auto}
.bt-update-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px}
.bt-update-notes{margin-right:auto;font-size:12.5px;color:var(--bt-ink-2);text-decoration:none}
.bt-update-notes:hover{color:var(--bt-ink);text-decoration:underline}
.bt-update-go{height:30px;padding:0 14px;border:0;border-radius:999px;background:var(--bt-accent,#4D6BFE);color:var(--bt-accent-ink,#fff);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .12s ease,transform .12s ease}
.bt-update-go:hover:not(:disabled){opacity:.9}
.bt-update-go:active:not(:disabled){transform:scale(.96)}
.bt-update-go:disabled{opacity:.6;cursor:default}
.bt-update-dsh:not(:first-child){margin-top:12px;padding-top:12px;border-top:.5px solid var(--bt-line-2)}
@media (prefers-reduced-motion:reduce){.bt-round.bt-update,.bt-update-pop,.bt-update .bt-cloud-arrow{animation:none}}

/* The DSH Agent row and its expanding Session list. The black whale is the
   harness's own mark, so the row reads as "plain dsh" next to the Bot marks. */
.bt-agent-ava{flex:none;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--bt-hover);color:var(--bt-ink)}
.bt-agent-ava.bt-run{animation:bt-agent-pulse 1.4s ease-in-out infinite}
@keyframes bt-agent-pulse{0%,100%{opacity:1}50%{opacity:.55}}
.bt-agent-sub{display:grid;grid-template-rows:0fr;transition:grid-template-rows ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
.bt-agent-sub[data-open]{grid-template-rows:1fr}
.bt-agent-sub-in{overflow:hidden;min-height:0;margin-left:44px}
.bt-agent-sub-row{display:flex;align-items:center;gap:8px;width:100%;padding:5px 10px 5px 8px;border:0;border-radius:8px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.bt-agent-sub-row:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-agent-sub-row[aria-current=page]{background:var(--bt-hover);color:var(--bt-ink);font-weight:500}
.bt-agent-sub-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-agent-sub-time{flex:none;font-size:11px;color:var(--bt-ink-3)}
.bt-agent-new{color:var(--bt-ink-3)}
.bt-agent-new svg{width:14px;height:14px;flex:none}
.bt-agent-edit{padding:3px 10px 3px 4px}
.bt-agent-edit input{width:100%;border:0;border-radius:6px;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:13px;line-height:20px;padding:2px 8px;outline:none;box-shadow:inset 0 0 0 .5px var(--bt-line-2)}
.bt-agent-sub[data-open] .bt-agent-sub-row{animation:bt-agent-row-in .24s ease both;animation-delay:calc(var(--i, 0)*30ms)}
@keyframes bt-agent-row-in{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:blur(0)}}
@media (prefers-reduced-motion:reduce){.bt-agent-sub{transition:none}.bt-agent-sub .bt-agent-sub-row{animation:none}}
`
