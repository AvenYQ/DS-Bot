// The court board: the 3D 值房图 in place of the conversation. This file is the React
// half — the entry in the sidebar's foot, the pane, and the official card and roster.
// The world itself lives in scene.js and knows nothing about React.
import { createElement as h, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePaneLeft } from '../overlay-hooks.js'
import { BotAvatar } from '../mark.js'
import { workPhrase } from '../cells.js'
import { ScheduleSummary } from '../schedules.js'
import { currentPart, previewOf } from '../text.js'
import { t } from '../i18n.js'
import { liveStateOf, groupsOf, useDoneHold } from '../live-state.js'
import { SealIcon } from './icons.js'
import { castOf } from './state.js'
import { SEALS } from './data.js'
import { courtTheme } from '../sources.js'
import { decreeFor } from './decree.js'
import { createCourtScene } from './scene.js'

// scene.js ends a 宣旨 ceremony after six seconds and ignores one that starts before it.
const CEREMONY_MS = 6000

// Open state, shared by the sidebar's button and the pane. Replaced on every change so
// React sees a new snapshot.
let board = { open: false, selected: null }
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
const snapshot = () => board
const publish = (patch) => {
  const next = { ...board, ...patch }
  if (next.open === board.open && next.selected === board.selected) return
  board = next
  for (const listener of listeners) listener()
}
export const openCourtBoard = () => publish({ open: true })
export const closeCourtBoard = () => publish({ open: false, selected: null })
export const selectOfficial = id => publish({ selected: id })

const useBoard = () => useSyncExternalStore(subscribe, snapshot, snapshot)

// How many officials are at work right now: running their own chat, or in a group.
function useWorkingCount(useRoster, useSessionStatus, useWork) {
  const roster = useRoster(value => value)
  const status = useSessionStatus(value => value)
  const work = useWork ? useWork(value => value) : null
  const rooms = work?.rooms ?? {}
  let count = 0
  for (const bot of roster.bots ?? []) {
    if (bot?.hidden) continue
    if (status?.get?.(currentPart(bot))?.running === true) count += 1
    else if (groupsOf(rooms, bot.id).length > 0) count += 1
  }
  return count
}

/**
 * The sidebar's entry: a round seal that opens into a capsule on hover, and on the rail
 * just the mark. It stays out of the account avatar's way either way.
 */
export function CourtBoardEntry({ wide = true, useRoster, useSessionStatus, useWork }) {
  const roster = useRoster(value => value)
  const themed = courtTheme(roster)
  const count = useWorkingCount(useRoster, useSessionStatus, useWork)
  const [hover, setHover] = useState(false)
  const label = t('小朝廷值房')
  if (!wide) {
    return h('button', {
      type: 'button', className: 'bt-cb-rail-entry', 'aria-label': label, title: label,
      onClick: openCourtBoard,
    }, h(SealIcon, { size: 20, mono: true, small: true }))
  }
  if (!themed) return null
  return h('div', {
    className: 'bt-cb-entry', 'data-open': hover ? 'true' : 'false',
    onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false),
  },
  h('button', {
    type: 'button', className: 'bt-cb-entry-btn', 'aria-label': label, title: label,
    onClick: openCourtBoard,
  },
  h('span', { className: 'bt-cb-entry-copy', 'aria-hidden': true },
    h('span', { className: 'bt-cb-entry-label' }, label),
    count > 0 ? h('span', { className: 'bt-cb-entry-count' }, t('{count} 位当值', { count })) : null),
  h('span', { className: 'bt-cb-entry-icon' }, h(SealIcon, { size: 20, small: true }))))
}

/**
 * The board itself. Mounted for the whole session (it costs one component), it renders
 * nothing until the user opens it.
 */
export function CourtBoardLayer({ useRoster, useSessions, useSessionStatus, useActivity, useWork, actions }) {
  const state = useBoard()
  const paneLeft = usePaneLeft()
  const roster = useRoster(value => value)
  const sessions = useSessions(value => value)
  const status = useSessionStatus(value => value)
  const activity = useActivity(value => value)
  const work = useWork ? useWork(value => value) : null
  const stage = useRef(null)
  const tags = useRef(null)
  const scene = useRef(null)
  const hour = useHour()
  const [broken, setBroken] = useState(false)
  const playedDecree = useRef({})
  const decreeUntil = useRef(0)
  const [decreeWake, setDecreeWake] = useState(0)
  const [rosterOpen, setRosterOpen] = useState(false)
  const selected = state.selected
  // Nothing of the board outlives the theme: no scene, no card, no roster.
  const themed = courtTheme(roster)
  useEffect(() => { if (!themed && state.open) closeCourtBoard() }, [themed, state.open])

  // The cast, in sidebar order, from the same derivation the sidebar's rows use.
  const liveStates = useMemo(() => {
    const live = []
    for (const bot of roster.bots ?? []) {
      if (!bot || bot.hidden) continue
      const waiting = work?.waiting?.[bot.id] ?? null
      const state = liveStateOf({
        bot, roster,
        entry: status?.get?.(currentPart(bot)),
        active: (sessions?.byId?.[currentPart(bot)]?.retainedBy?.mainView ?? 0) > 0,
        doing: activity?.[bot.id],
        approval: (work?.approvals ?? []).some(item => item.botId === bot.id),
        rooms: work?.rooms ?? {},
        turn: work?.turns?.[currentPart(bot)] ?? null,
        waiting,
      })
      // The words the bubble and the card carry, from the same copy the sidebar uses.
      const waitsFor = [...(waiting?.bots ?? []).map(id => roster.byId?.[id]?.name), ...(waiting?.rooms ?? []).map(id => roster.roomsById?.[id]?.name)].filter(Boolean)
      live.push({
        ...state,
        bot,
        roomName: roster.roomsById?.[state.groups[0]?.id]?.name ?? '',
        waitsFor: waitsFor.length === 0 ? '' : t('Waiting for {names}', { names: waitsFor.join(t(' and ')) }),
      })
    }
    return live
  }, [roster, sessions, status, activity, work])
  const heldStates = useDoneHold(liveStates, actions.confirmCompletion)
  const cast = useMemo(() => castOf({
    roster, live: new Map(heldStates.map(state => [state.bot.id, state])), hour,
    phrase: entry => `${workPhrase(entry.doing, entry.bot)}…`,
    words: { done: t('已办') },
  }), [roster, heldStates, hour])

  // Choosing a conversation — from the sidebar or from the card — puts the board away.
  const mainId = useSessions(list => Object.values(list.byId ?? {}).find(session => (session?.retainedBy?.mainView ?? 0) > 0)?.id ?? null)
  const openedOn = useRef(null)
  useEffect(() => {
    if (!state.open) { openedOn.current = null; return }
    if (openedOn.current === null) openedOn.current = mainId
    else if (mainId !== openedOn.current) closeCourtBoard()
  }, [mainId, state.open])

  // The stage is removed when closed, so its WebGL scene must be rebuilt on reopening.
  useEffect(() => {
    if (!state.open || scene.current !== null || stage.current === null) return undefined
    try {
      scene.current = createCourtScene({
        container: stage.current,
        tags: tags.current,
        onSelect: id => selectOfficial(id),
        onOpen: id => selectOfficial(id),
      })
    } catch (error) {
      // No WebGL: the city cannot be drawn, but the board and the roster still work.
      console.warn('[ds-bot] court board', error)
      setBroken(true)
      return undefined
    }
    scene.current.setPeople(cast.people)
    for (const person of cast.people) scene.current.setPersonState(person.id, person.state)
    scene.current.setTime(hour * 60)
    scene.current.start()
    const world = scene.current
    return () => {
      world.dispose()
      if (scene.current === world) scene.current = null
    }
  }, [state.open])

  // Feed the world while it is open. The cast is rebuilt only when the team changes;
  // states go one at a time, so a Bot starting work does not redraw the city.
  const ids = cast.people.map(person => person.id).join(',')
  useEffect(() => {
    const world = scene.current
    if (world === null || !state.open) return
    world.setPeople(cast.people)
    for (const person of cast.people) world.setPersonState(person.id, person.state)
  }, [ids, state.open])
  useEffect(() => {
    const world = scene.current
    if (world === null || !state.open) return
    for (const person of cast.people) world.setPersonState(person.id, person.state)
  }, [cast, state.open])
  useEffect(() => {
    const world = scene.current
    if (world === null || !state.open) return
    world.select(selected)
  }, [selected, state.open])
  useEffect(() => {
    const world = scene.current
    if (world === null || !state.open) return
    world.setTime(hour * 60)
  }, [hour, state.open])

  // The loop stops whenever the board is not on screen: closed, or the window in the
  // background. A page that is not looked at must not burn the GPU.
  useEffect(() => {
    const world = scene.current
    if (world === null) return undefined
    const sync = () => {
      if (state.open && !document.hidden) world.start()
      else world.stop()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [state.open])

  useEffect(() => () => { scene.current?.dispose(); scene.current = null }, [])

  // A 宣旨 while the board is open: the Main Bot takes the square when it handed work to
  // several officials at once, or gave it to a group. One ceremony at a time: a batch that
  // arrives during one waits for it to end, then plays.
  const assignments = work?.assignments ?? []
  useEffect(() => {
    if (!state.open || scene.current === null) return undefined
    const now = Date.now()
    if (now < decreeUntil.current) {
      const timer = setTimeout(() => setDecreeWake(wake => wake + 1), decreeUntil.current - now)
      return () => clearTimeout(timer)
    }
    const next = decreeFor(assignments, roster.mainBotId, playedDecree.current, now)
    if (next === null) return undefined
    playedDecree.current = { ...playedDecree.current, [next.kind]: next.at }
    decreeUntil.current = now + CEREMONY_MS
    scene.current.decree(next.kind === 'room'
      ? { from: next.from, room: next.room }
      : { from: next.from, to: next.to })
    return undefined
  }, [assignments, state.open, roster.mainBotId, decreeWake])

  useEffect(() => {
    if (!state.open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); closeCourtBoard() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state.open])

  const cardId = useExitValue(state.open ? selected : null)
  const rosterVisible = useExitValue(state.open && rosterOpen ? 'open' : null)
  // After every hook: turning the theme off unmounts the board without changing the hook order.
  if (!themed || !state.open) return null
  const card = cardId === null ? null : cast.bots.find(item => item.bot.id === cardId) ?? null
  const clock = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`
  return createPortal(h('div', { className: 'bt-cb-pane', style: { left: paneLeft } },
    h('div', { className: 'bt-cb-head' },
      h(SealIcon, { size: 18 }),
      h('span', { className: 'bt-cb-title' }, t('小朝廷值房')),
      h('span', { className: 'bt-cb-sub' }, t('{count} 位在册', { count: cast.bots.length })),
      h('span', { className: 'bt-cb-head-spacer' }),
      h('button', {
        type: 'button', className: 'bt-cb-tab', 'data-on': rosterOpen ? 'true' : 'false',
        'aria-pressed': rosterOpen, onClick: () => setRosterOpen(open => !open),
      }, t('名册')),
      h('span', { className: 'bt-cb-clock' }, clock),
      h('button', { type: 'button', className: 'bt-cb-x', 'aria-label': t('关闭'), title: t('关闭'), onClick: closeCourtBoard }, '×')),
    h('div', { className: 'bt-cb-stage' },
      h('div', { ref: stage, style: { position: 'absolute', inset: 0 } }),
      h('div', { ref: tags, className: 'bt-cb-tags' }),
      broken ? h('div', { className: 'bt-cb-broken' }, t('这台机器没有可用的 WebGL，值房图显示不出来；名册和官员卡片照常可用。')) : null,
      card !== null ? h(OfficialCard, { item: card, sessions, actions, closing: selected === null }) : null,
      rosterVisible ? h(RosterSheet, { bots: cast.bots, selected, closing: !rosterOpen, onSelect: id => { selectOfficial(id); scene.current?.flyTo(id) } }) : null)), document.body)
}

function useExitValue(value) {
  const [retained, setRetained] = useState(value)
  useEffect(() => {
    if (value !== null) { setRetained(value); return undefined }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setRetained(null); return undefined }
    const timer = setTimeout(() => setRetained(null), 180)
    return () => clearTimeout(timer)
  }, [value])
  return value ?? retained
}

// The clock the board shows, in the officials' time zone; the sky follows it.
function useHour() {
  const [hour, setHour] = useState(nowHour)
  useEffect(() => {
    const timer = setInterval(() => setHour(nowHour()), 30000)
    return () => clearInterval(timer)
  }, [])
  return hour
}

function nowHour() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const pick = key => Number(parts.find(part => part.type === key)?.value ?? 0)
  return pick('hour') % 24 + pick('minute') / 60
}

// The official's card: who he is, what he is doing now, his day, and the way to him.
function OfficialCard({ item, sessions, actions, closing }) {
  const { bot, official, court } = item
  const part = currentPart(bot)
  const outline = sessions?.projectionsBySession?.[part]?.values?.turnOutline ?? sessions?.byId?.[part]?.projectionValues?.turnOutline
  const lines = Array.isArray(outline) ? outline.slice(-8).reverse() : []
  const preview = previewOf(sessions, part, [])
  const go = () => { closeCourtBoard(); actions.openSession(bot.id) }
  return h('aside', { className: 'bt-cb-sheet bt-cb-card', 'data-closing': closing || undefined, inert: closing || undefined },
    h('div', { className: 'bt-cb-sheet-head' },
      h('span', { className: 'bt-cb-ava' }, h(BotAvatar, { bot, size: 40, state: 'idle' })),
      h('div', { className: 'bt-cb-who' },
        h('div', { className: 'bt-cb-name' }, bot.name),
        h('div', { className: 'bt-cb-role' }, [official?.title ?? bot.role, official?.dept ?? bot.section].filter(Boolean).join(' · '))),
      h('button', { type: 'button', className: 'bt-cb-x', 'aria-label': t('关闭'), onClick: () => selectOfficial(null) }, '×')),
    h('div', { className: 'bt-cb-state', 'data-kind': court.kind },
      h('b', { key: court.kind, className: SEALS[court.kind] ? 'bt-cb-stamp' : undefined }, stateWord(court.kind)),
      court.kind === 'pending' ? t('等皇上定夺') : court.kind === 'question' ? t('Waiting for your answer') : court.text || t('眼下没有差事')),
    official?.duty ? h('p', { className: 'bt-cb-desc' }, `${t('职掌')}：${official.duty}`) : null,
    h('div', { className: 'bt-cb-h' }, t('今日起居注')),
    lines.length === 0
      ? h('div', { className: 'bt-cb-empty' }, preview || t('今天还没有起居注'))
      : h('ul', { className: 'bt-cb-log' }, lines.map((entry, index) => h('li', { key: `${entry.turn ?? index}` },
          h('span', { className: 't' }, entry.at ? new Date(entry.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : `#${entry.turn ?? index + 1}`),
          h('span', null, String(entry.response || entry.prompt || '').replace(/\s+/g, ' ').slice(0, 60))))),
    h('div', { className: 'bt-cb-h' }, t('例行时辰')),
    h('div', { className: 'bt-cb-sched' }, h(ScheduleSummary, { bot, actions })),
    h('div', { className: 'bt-cb-actions' },
      h('button', { type: 'button', className: 'bt-cb-btn', onClick: go }, court.kind === 'pending' ? t('去批复') : t('去对话'))))
}

const STATE_WORD = {
  work: '当值', idle: '候旨', sleep: '歇息', alert: '异常', waiting: '候', done: '已办', pending: '待批', court: '议事',
}
const stateWord = kind => SEALS[kind]?.word ?? t(STATE_WORD[kind] ?? '候旨')
const stateLabel = kind => kind === 'question' ? t('Waiting for your answer') : t(STATE_WORD[kind] ?? '候旨')

// The roster: every official in sidebar order, grouped as the sidebar groups them.
function RosterSheet({ bots, selected, onSelect, closing }) {
  const groups = useMemo(() => {
    const order = []
    const map = new Map()
    for (const item of bots) {
      const name = item.group || t('编外')
      if (!map.has(name)) { map.set(name, []); order.push(name) }
      map.get(name).push(item)
    }
    return order.map(name => [name, map.get(name)])
  }, [bots])
  return h('aside', { className: 'bt-cb-sheet bt-cb-roster', 'data-closing': closing || undefined, inert: closing || undefined },
    h('div', { className: 'bt-cb-sheet-head' },
      h('div', { className: 'bt-cb-who' }, h('div', { className: 'bt-cb-name' }, t('名册')), h('div', { className: 'bt-cb-role' }, t('{count} 位', { count: bots.length })))),
    groups.map(([name, items]) => h('div', { className: 'bt-cb-grp', key: name },
      h('h4', null, name),
      items.map(item => h('button', {
        key: item.bot.id, type: 'button', className: 'bt-cb-row', 'data-selected': item.bot.id === selected,
        onClick: () => onSelect(item.bot.id),
      },
      h('span', { className: 'd', style: { background: item.official?.robe ?? item.bot.avatar?.color ?? 'var(--bt-ink-2)' } }),
      h('span', { className: 'n' }, item.official ? item.official.name : item.bot.name),
      h('span', { key: item.court.kind, className: 's', 'data-kind': item.court.kind, title: stateLabel(item.court.kind), 'aria-label': stateLabel(item.court.kind) }, stateWord(item.court.kind)))))))
}
