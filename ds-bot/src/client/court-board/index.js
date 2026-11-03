// The court board: the 3D 值房图 in place of the conversation. This file is the React
// half — the entry in the sidebar's foot, the pane with its status bar, the 奏事簿 (a
// live log of what the officials start, finish and ask), the roster and the official's
// card. The world itself lives in scene.js and knows nothing about React.
import { createElement as h, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePaneLeft } from '../overlay-hooks.js'
import { BotAvatar } from '../mark.js'
import { workPhrase } from '../cells.js'
import { ScheduleSummary } from '../schedules.js'
import { currentPart, stripHeader } from '../text.js'
import { t } from '../i18n.js'
import { liveStateOf, groupsOf, useDoneHold } from '../live-state.js'
import { SealIcon } from './icons.js'
import { castOf } from './state.js'
import { SEALS } from './data.js'
import { courtTheme } from '../sources.js'
import { decreeFor } from './decree.js'
import { feedEvents, feedKey, shichen } from './feed.js'
import { CEREMONY_MS, createCourtScene } from './scene.js'
import { fetchWeather } from './weather.js'

// Open state, shared by the sidebar's button and the pane. Replaced on every change so
// React sees a new snapshot.
let board = { open: false, selected: null, panel: 'feed' }
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
const snapshot = () => board
const publish = (patch) => {
  const next = { ...board, ...patch }
  if (next.open === board.open && next.selected === board.selected && next.panel === board.panel) return
  board = next
  for (const listener of listeners) listener()
}
export const openCourtBoard = () => publish({ open: true })
export const closeCourtBoard = () => publish({ open: false, selected: null })
export const selectOfficial = id => publish({ selected: id })
const setPanel = panel => publish({ panel })

const useBoard = () => useSyncExternalStore(subscribe, snapshot, snapshot)

// The 奏事簿: what happened today, newest first. Kept for the day in this browser so the
// board can be closed and reopened, or the app restarted, without losing the morning.
let feed = readFeed()
const feedListeners = new Set()
const subscribeFeed = (listener) => { feedListeners.add(listener); return () => feedListeners.delete(listener) }
const feedSnapshot = () => feed
function addFeed(entries) {
  if (entries.length === 0) return
  const day = feedKey()
  feed = [...entries, ...feed.filter(entry => feedKey(entry.at) === day)].slice(0, 160)
  try { localStorage.setItem('ds-bot:court-feed', JSON.stringify(feed)) } catch { /* storage unavailable */ }
  for (const listener of feedListeners) listener()
}
function readFeed() {
  try {
    const saved = JSON.parse(localStorage.getItem('ds-bot:court-feed') ?? '[]')
    const day = feedKey()
    return Array.isArray(saved) ? saved.filter(entry => entry && feedKey(entry.at) === day) : []
  } catch { return [] }
}

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

const STATE_WORD = {
  work: '当值', idle: '候旨', sleep: '歇息', waiting: '候', done: '已办', pending: '待批', question: '待答', court: '议事',
}
const stateWord = kind => t(STATE_WORD[kind] ?? '候旨')
// The status bar's tallies, in the order a busy court reads them.
const TALLY = [
  ['work', ['work']], ['court', ['court']], ['pending', ['pending', 'question']], ['done', ['done']], ['waiting', ['waiting']], ['idle', ['idle', 'sleep']],
]

/**
 * The board itself. Mounted for the whole session — it keeps the 奏事簿 even while
 * closed — it draws nothing until the user opens it.
 */
export function CourtBoardLayer({ useRoster, useSessions, useSessionStatus, useActivity, useWork, actions }) {
  const state = useBoard()
  const paneLeft = usePaneLeft()
  const roster = useRoster(value => value)
  const sessions = useSessions(value => value)
  const status = useSessionStatus(value => value)
  const activity = useActivity(value => value)
  const work = useWork ? useWork(value => value) : null
  const log = useSyncExternalStore(subscribeFeed, feedSnapshot, feedSnapshot)
  const stage = useRef(null)
  const tags = useRef(null)
  const scene = useRef(null)
  const hour = useHour()
  const [broken, setBroken] = useState(false)
  const playedDecree = useRef({})
  const decreeUntil = useRef(0)
  const [decreeWake, setDecreeWake] = useState(0)
  const [hint, setHint] = useState(true)
  const cycle = useRef({})
  const selected = state.selected
  // Nothing of the board outlives the theme: no scene, no card, no roster.
  const themed = courtTheme(roster)
  useEffect(() => { if (!themed && state.open) closeCourtBoard() }, [themed, state.open])

  // The cast, in sidebar order, from the same derivation the sidebar's rows use, with
  // what each Bot is doing in its own words and since when.
  const liveStates = useMemo(() => {
    const live = []
    const rooms = work?.rooms ?? {}
    for (const bot of roster.bots ?? []) {
      if (!bot || bot.hidden) continue
      const waiting = work?.waiting?.[bot.id] ?? null
      const own = work?.bots?.[bot.id] ?? null
      const state = liveStateOf({
        bot, roster,
        entry: status?.get?.(currentPart(bot)),
        active: (sessions?.byId?.[currentPart(bot)]?.retainedBy?.mainView ?? 0) > 0,
        doing: activity?.[bot.id],
        approval: (work?.approvals ?? []).some(item => item.botId === bot.id),
        rooms,
        turn: work?.turns?.[currentPart(bot)] ?? null,
        waiting,
      })
      const roomId = state.groups[0]?.id
      const seat = roomId ? (rooms[roomId] ?? []).find(item => item.botId === bot.id) : null
      const waitsFor = [...(waiting?.bots ?? []).map(id => roster.byId?.[id]?.name), ...(waiting?.rooms ?? []).map(id => roster.roomsById?.[id]?.name)].filter(Boolean)
      live.push({
        ...state,
        bot,
        detail: own ?? seat ?? null,
        activity: activity?.[bot.id],
        since: own?.since ?? seat?.since,
        speaking: seat?.speaking === true,
        roomName: roster.roomsById?.[roomId]?.name ?? '',
        waitsFor: waitsFor.length === 0 ? '' : t('Waiting for {names}', { names: waitsFor.join(t(' and ')) }),
      })
    }
    return live
  }, [roster, sessions, status, activity, work])
  const heldStates = useDoneHold(liveStates, actions.confirmCompletion)
  const cast = useMemo(() => {
    const value = castOf({
      roster, live: new Map(heldStates.map(item => [item.bot.id, item])), hour,
      phrase: entry => workPhrase(entry.detail ?? entry.doing, entry.bot),
      words: { done: t('已办') },
    })
    // Who a waiting official looks towards: the first Bot he waits on.
    for (const person of value.people) {
      const live = heldStates.find(item => item.bot.id === person.id)
      if (person.state.kind === 'waiting') person.state = { ...person.state, towards: live?.waits?.bots?.[0] }
    }
    return value
  }, [roster, heldStates, hour])

  // Nanjing's weather, checked while the board is open.
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    if (!state.open) return undefined
    let stopped = false
    const load = () => fetchWeather().then((next) => { if (!stopped && next) setWeather(next) })
    load()
    const timer = setInterval(load, 30 * 60 * 1000)
    return () => { stopped = true; clearInterval(timer) }
  }, [state.open])
  useEffect(() => { if (weather) scene.current?.setWeather(weather) }, [weather])

  // The 奏事簿 notes every change of state, open or not.
  const seen = useRef(null)
  useEffect(() => {
    const now = Date.now()
    const { entries, next } = feedEvents(seen.current, cast.bots, now, {
      start: t('开始当值'), finish: t('办完了，待皇上阅'), ended: t('事毕'), pending: t('请皇上批复'), question: t('有事请教皇上'),
      court: t('赴议'), waiting: t('候'),
    })
    seen.current = next
    addFeed(entries)
  }, [cast])

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
        onOpen: id => { closeCourtBoard(); actions.openSession(id) },
        words: {
          pending: t('等皇上定夺'), question: t('等皇上答话'), done: t('已办，待阅'), court: t('议事'), speaking: t('发言中'),
          decree: t('宣旨'), unfiled: t('编外'), people: t(' 人'), arrive: t('皇上驾到'),
          memorial: t('奏折'), square: t('太和殿广场'), memorials: t('看奏报'),
        },
      })
    } catch (error) {
      // No WebGL: the city cannot be drawn, but the board, the log and the roster still work.
      console.warn('[ds-bot] court board', error)
      setBroken(true)
      return undefined
    }
    scene.current.setTime(hour * 60)
    scene.current.setPeople(cast.people)
    scene.current.select(board.selected)
    if (weather) scene.current.setWeather(weather)
    scene.current.start()
    scene.current.greet()
    setHint(true)
    const timer = setTimeout(() => setHint(false), 7000)
    const world = scene.current
    return () => {
      clearTimeout(timer)
      world.dispose()
      if (scene.current === world) scene.current = null
    }
  }, [state.open])

  // Feed the world while it is open. The city is rebuilt only when the team's shape
  // changes; states go one at a time, so a Bot starting work does not rebuild anything.
  const shape = cast.people.map(person => `${person.id}|${person.section}|${person.office}|${person.robe}|${person.building}`).join(',')
  useEffect(() => {
    const world = scene.current
    if (world === null || !state.open) return
    world.setPeople(cast.people)
  }, [shape, state.open])
  useEffect(() => {
    const world = scene.current
    if (world === null || !state.open) return
    for (const person of cast.people) world.setPersonState(person.id, person.state)
  }, [cast, state.open])
  useEffect(() => {
    scene.current?.select(selected)
  }, [selected, state.open])
  useEffect(() => {
    scene.current?.setTime(hour * 60)
  }, [hour, state.open])
  // The city slides out from under the sheets: right for the 奏事簿, left for a card.
  useEffect(() => {
    scene.current?.setInset((state.panel ? 306 : 0) - (selected ? 354 : 0))
  }, [state.panel, state.open, selected])

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
  // What the Main Bot and the others just sent each other: every message when the host
  // keeps that list, else only the work handed over with an answer expected.
  const assignments = work?.sent ?? work?.assignments ?? []
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
    const main = roster.byId?.[next.from]?.name ?? ''
    const named = next.kind === 'room'
      ? roster.roomsById?.[next.room]?.name ?? ''
      : next.to.map(id => roster.byId?.[id]?.name).filter(Boolean).join('、')
    addFeed([{ at: now, id: next.from, name: main, kind: 'decree', text: `${t('宣旨')}${named ? ` · ${named}` : ''}` }])
    return undefined
  }, [assignments, state.open, roster.mainBotId, decreeWake])

  // Every message one Bot sends another while the board is open gets a runner with the
  // memorial: from the sender to the receiver, or to the square for a group.
  const messages = assignments
  const sent = useRef(new Set())
  useEffect(() => {
    if (!state.open || scene.current === null) return
    const now = Date.now()
    for (const entry of messages) {
      if (!entry || typeof entry.at !== 'number' || now - entry.at > 15_000) continue
      const key = `${entry.from}>${entry.to ?? entry.room}@${entry.at}`
      if (sent.current.has(key)) continue
      sent.current.add(key)
      scene.current.send({ from: entry.from, to: entry.to, room: entry.room })
    }
  }, [messages, state.open])

  useEffect(() => {
    if (!state.open) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (board.selected) selectOfficial(null)
      else closeCourtBoard()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state.open])

  const cardId = useExitValue(state.open ? selected : null)
  // After every hook: turning the theme off unmounts the board without changing the hook order.
  if (!themed || !state.open) return null
  const card = cardId === null ? null : cast.bots.find(item => item.bot.id === cardId) ?? null
  const focus = (id) => { selectOfficial(id); scene.current?.flyTo(id) }
  const tallies = TALLY.map(([kind, kinds]) => {
    const ids = cast.bots.filter(item => kinds.includes(item.court.kind)).map(item => item.bot.id)
    return { kind, ids }
  }).filter(item => item.ids.length > 0 || item.kind === 'work')
  const pickTally = (kind, ids) => {
    if (ids.length === 0) return
    const at = ((cycle.current[kind] ?? -1) + 1) % ids.length
    cycle.current = { ...cycle.current, [kind]: at }
    focus(ids[at])
  }
  const panel = state.panel
  return createPortal(h('div', { className: 'bt-cb-pane', style: { left: paneLeft } },
    h('div', { className: 'bt-cb-head' },
      h('span', { className: 'bt-cb-mark' }, h(SealIcon, { size: 22 })),
      h('div', { className: 'bt-cb-heading' },
        h('span', { className: 'bt-cb-title' }, t('小朝廷值房')),
        h('span', { className: 'bt-cb-sub' }, `${dateLine()} · ${shichen(hour)}${weather?.word ? ` · ${t('南京')} ${weather.word} ${weather.temp}°C` : ''}`)),
      h('div', { className: 'bt-cb-tallies', role: 'group', 'aria-label': t('朝堂态势') },
        tallies.map(({ kind, ids }) => h('button', {
          key: kind, type: 'button', className: 'bt-cb-tally', 'data-kind': kind, disabled: ids.length === 0,
          title: ids.length > 0 ? t('点一下看下一位') : undefined, onClick: () => pickTally(kind, ids),
        }, h('i', { 'aria-hidden': true }), h('span', null, stateWord(kind)), h('b', null, ids.length)))),
      h('span', { className: 'bt-cb-head-spacer' }),
      h('div', { className: 'bt-cb-seg', role: 'tablist' },
        [['feed', t('奏事簿')], ['roster', t('名册')]].map(([key, label]) => h('button', {
          key, type: 'button', role: 'tab', 'aria-selected': panel === key, 'data-on': panel === key,
          onClick: () => setPanel(panel === key ? null : key),
        }, label))),
      h('button', { type: 'button', className: 'bt-cb-icon', title: t('全景'), 'aria-label': t('全景'), onClick: () => { selectOfficial(null); scene.current?.frame() } }, h(FrameIcon)),
      h('button', { type: 'button', className: 'bt-cb-icon bt-cb-x', 'aria-label': t('关闭'), title: t('关闭'), onClick: closeCourtBoard }, h(CloseIcon))),
    h('div', { className: 'bt-cb-stage' },
      h('div', { ref: stage, className: 'bt-cb-world' }),
      h('div', { ref: tags, className: 'bt-cb-tags' }),
      broken ? h('div', { className: 'bt-cb-broken' }, t('这台机器没有可用的 WebGL，值房图显示不出来；奏事簿、名册和官员卡片照常可用。')) : null,
      panel === 'feed' ? h(FeedPanel, { log, bots: cast.bots, onSelect: focus }) : null,
      panel === 'roster' ? h(RosterPanel, { bots: cast.bots, selected, onSelect: focus }) : null,
      card !== null ? h(OfficialCard, { item: card, live: heldStates.find(item => item.bot.id === card.bot.id), sessions, actions, closing: selected === null, onFly: () => scene.current?.flyTo(card.bot.id) }) : null,
      hint && !broken ? h('div', { className: 'bt-cb-hint' }, t('拖动转视角 · 右键拖动平移 · 滚轮缩放 · 点小人看详情 · 双击进对话')) : null)), document.body)
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

const dateLine = () => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())
const timeOf = at => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at))

// Ticks once a second while a timer is on screen.
function useSecond(on) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!on) return undefined
    const timer = setInterval(() => setTick(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [on])
}

const elapsed = (since) => {
  if (!since) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000))
  if (seconds < 60) return t('{n} 秒', { n: seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('{m} 分 {s} 秒', { m: minutes, s: seconds % 60 })
  return t('{h} 时 {m} 分', { h: Math.floor(minutes / 60), m: minutes % 60 })
}

const robeOf = item => item.official?.robe ?? item.bot.avatar?.color ?? 'var(--bt-ink-2)'
const shortName = item => item.official?.name ?? String(item.bot.name ?? '').split('·').pop()

// The official's card: who he is, what he is doing this minute and for how long, what
// he has done lately, and the way to him.
function OfficialCard({ item, live, sessions, actions, closing, onFly }) {
  const { bot, official, court } = item
  useSecond(court.kind === 'work' || court.kind === 'court')
  const part = currentPart(bot)
  const outline = sessions?.projectionsBySession?.[part]?.values?.turnOutline ?? sessions?.byId?.[part]?.projectionValues?.turnOutline
  const lines = Array.isArray(outline) ? outline.filter(entry => entry.response || entry.prompt).slice(-6).reverse() : []
  const go = () => { closeCourtBoard(); actions.openSession(bot.id) }
  const detail = live?.detail ?? null
  const seal = SEALS[court.kind]
  const headline = court.kind === 'pending' ? t('等皇上定夺')
    : court.kind === 'question' ? t('等皇上答话')
      : court.kind === 'done' ? t('差事办完，等皇上过目')
        : court.kind === 'court' ? `${court.speaking ? t('正在发言') : t('正在议事')}${court.text ? ` · ${court.text}` : ''}`
          : court.kind === 'sleep' ? t('夜深了，歇着')
            : court.text || t('眼下没有差事，候旨')
  return h('aside', { className: 'bt-cb-sheet bt-cb-card', 'data-closing': closing || undefined, inert: closing || undefined, style: { '--cb-robe': robeOf(item) } },
    h('div', { className: 'bt-cb-card-top' },
      h('span', { className: 'bt-cb-ava' }, h(BotAvatar, { bot, size: 48, state: 'idle' })),
      h('div', { className: 'bt-cb-who' },
        h('div', { className: 'bt-cb-name' }, shortName(item)),
        h('div', { className: 'bt-cb-role' }, [bot.name, item.group].filter(Boolean).join(' · '))),
      h('button', { type: 'button', className: 'bt-cb-icon', 'aria-label': t('关闭'), onClick: () => selectOfficial(null) }, h(CloseIcon))),
    h('div', { className: 'bt-cb-now', 'data-kind': court.kind },
      h('div', { className: 'bt-cb-now-top' },
        seal
          ? h('b', { key: court.kind, className: 'bt-cb-stamp', style: { '--cb-seal': seal.color } }, seal.word)
          : h('span', { className: 'bt-cb-pill', 'data-kind': court.kind }, stateWord(court.kind)),
        live?.since && (court.kind === 'work' || court.kind === 'court') ? h('span', { className: 'bt-cb-timer' }, t('已 {time}', { time: elapsed(live.since) })) : null),
      h('div', { className: 'bt-cb-now-line' }, headline),
      court.kind === 'work' && (detail?.tool || detail?.target)
        ? h('div', { className: 'bt-cb-now-meta' },
            detail?.tool ? h('code', null, detail.tool) : null,
            detail?.target ? h('span', null, detail.target) : null)
        : null,
      court.kind === 'waiting' && court.text ? h('div', { className: 'bt-cb-now-meta' }, court.text) : null),
    official?.duty ? h('p', { className: 'bt-cb-desc' }, h('b', null, t('职掌')), official.duty) : null,
    h('div', { className: 'bt-cb-h' }, t('近来起居注')),
    lines.length === 0
      ? h('div', { className: 'bt-cb-empty' }, t('还没有起居注'))
      : h('ol', { className: 'bt-cb-log' }, lines.map((entry, index) => h('li', { key: `${entry.turn ?? index}` },
          entry.prompt ? h('div', { className: 'q' }, clip(entry.prompt, 46)) : null,
          entry.response ? h('div', { className: 'a' }, clip(entry.response, 80)) : null))),
    h('div', { className: 'bt-cb-h' }, t('例行时辰')),
    h('div', { className: 'bt-cb-sched' }, h(ScheduleSummary, { bot, actions })),
    h('div', { className: 'bt-cb-actions' },
      h('button', { type: 'button', className: 'bt-cb-btn', 'data-kind': court.kind === 'pending' || court.kind === 'question' ? 'urgent' : undefined, onClick: go },
        court.kind === 'pending' ? t('去批复') : court.kind === 'question' ? t('去答话') : t('去对话')),
      h('button', { type: 'button', className: 'bt-cb-btn', 'data-kind': 'plain', onClick: onFly }, t('看他的值房'))))
}

const clip = (text, n) => {
  const plain = stripHeader(String(text)).replace(/\s+/g, ' ').trim()
  return plain.length > n ? `${plain.slice(0, n)}…` : plain
}

// The 奏事簿: today's starts, finishes and requests, newest first.
function FeedPanel({ log, bots, onSelect }) {
  const known = new Map(bots.map(item => [item.bot.id, item]))
  return h('aside', { className: 'bt-cb-side' },
    h('div', { className: 'bt-cb-side-head' },
      h('span', { className: 'bt-cb-side-title' }, t('奏事簿')),
      h('span', { className: 'bt-cb-side-sub' }, t('今日 {count} 条', { count: log.length }))),
    log.length === 0
      ? h('div', { className: 'bt-cb-empty bt-cb-feed-empty' }, t('今天朝中还没有动静。官员一开工、一办完、一请旨，这里就记一笔。'))
      : h('ol', { className: 'bt-cb-feed' }, log.map((entry, index) => {
          const item = known.get(entry.id)
          return h('li', { key: `${entry.at}-${entry.id}-${index}` },
            h('button', { type: 'button', className: 'bt-cb-feed-row', 'data-kind': entry.kind, onClick: () => item && onSelect(entry.id), disabled: !item },
              h('span', { className: 't' }, timeOf(entry.at)),
              h('span', { className: 'd', style: { background: item ? robeOf(item) : 'var(--bt-ink-3)' } }),
              h('span', { className: 'c' },
                h('b', null, item ? shortName(item) : entry.name),
                h('span', null, entry.text))))
        })))
}

// The roster: every official in sidebar order, grouped as the sidebar groups them.
function RosterPanel({ bots, selected, onSelect }) {
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
  return h('aside', { className: 'bt-cb-side' },
    h('div', { className: 'bt-cb-side-head' },
      h('span', { className: 'bt-cb-side-title' }, t('名册')),
      h('span', { className: 'bt-cb-side-sub' }, t('{count} 位在册', { count: bots.length }))),
    h('div', { className: 'bt-cb-roster' }, groups.map(([name, items]) => h('section', { className: 'bt-cb-grp', key: name },
      h('h4', null, name),
      items.map(item => h('button', {
        key: item.bot.id, type: 'button', className: 'bt-cb-row', 'data-selected': item.bot.id === selected,
        onClick: () => onSelect(item.bot.id),
      },
      h('span', { className: 'd', style: { background: robeOf(item) } }),
      h('span', { className: 'n' }, h('b', null, shortName(item)), h('span', null, String(item.bot.name ?? '').split('·')[0])),
      SEALS[item.court.kind]
        ? h('span', { key: item.court.kind, className: 'bt-cb-stamp bt-cb-stamp-sm', style: { '--cb-seal': SEALS[item.court.kind].color }, title: stateWord(item.court.kind) }, SEALS[item.court.kind].word)
        : h('span', { className: 'bt-cb-pill', 'data-kind': item.court.kind }, stateWord(item.court.kind))))))))
}

const svg = (children, size = 18) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, children)
const CloseIcon = () => svg([h('path', { key: 'a', d: 'M6 6l12 12' }), h('path', { key: 'b', d: 'M18 6L6 18' })])
const FrameIcon = () => svg([h('path', { key: 'a', d: 'M4 9V5a1 1 0 0 1 1-1h4' }), h('path', { key: 'b', d: 'M15 4h4a1 1 0 0 1 1 1v4' }), h('path', { key: 'c', d: 'M20 15v4a1 1 0 0 1-1 1h-4' }), h('path', { key: 'd', d: 'M9 20H5a1 1 0 0 1-1-1v-4' })])
