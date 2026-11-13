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
import { BUILDINGS, WALL } from './layout.js'
import { decreeFor } from './decree.js'
import { feedEvents, feedKey, shichen } from './feed.js'
import { CEREMONY_MS, createCourtScene } from './scene.js'
import { CourtEgg, CityPicker, createTicket, createTour, createDispatch, DispatchCard, DocketChip, DutyCard, eggOf, greetingOf, nextPick, settleLocate } from './play.js'
import { dateIn, hourIn } from './clock.js'
import { dispatch, readDuty, unwireBridge, wireBridge } from './bridge.js'
import { createSound } from './sound.js'
import { fetchWeather } from './weather.js'
import { clearManualPlace, clearPlaceCache, forgetLocationDenial, readManualPlace, resolvePlace, searchPlaces, setManualPlace } from './place.js'

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
  const [place, setPlace] = useState(() => readManualPlace())
  const [picker, setPicker] = useState(false)
  const [found, setFound] = useState([])
  const [locating, setLocating] = useState(false)
  const [denied, setDenied] = useState(false)
  const tickets = useRef(null)
  if (tickets.current === null) tickets.current = createTicket()
  const hour = useHour(place?.timeZone)
  const [broken, setBroken] = useState(false)
  const playedDecree = useRef({})
  const decreeUntil = useRef(0)
  const [decreeWake, setDecreeWake] = useState(0)
  const [hint, setHint] = useState(true)
  const [preset, setPreset] = useState('overview')
  const [egg, setEgg] = useState(null)
  const [greetTick, setGreetTick] = useState(0)
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [touring, setTouring] = useState(false)
  const tour = useRef(null)
  const picks = useRef({})
  const [duty, setDuty] = useState(null)
  const [docket, setDocket] = useState(null)
  const sound = useRef(null)
  if (sound.current === null) sound.current = createSound()
  const [soundOn, setSoundOn] = useState(false)
  const rang = useRef({})
  const dispatcher = useRef(null)
  if (dispatcher.current === null) {
    dispatcher.current = createDispatch({ send: (id, text, options) => dispatch(id, text, options?.confirmed === true) })
  }
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
    // Who a waiting official looks towards: the first Bot he waits on. And how many
    // 奏折 stand before his door: what waits on the Emperor plus what he waits on others.
    for (const person of value.people) {
      const live = heldStates.find(item => item.bot.id === person.id)
      const approval = (work?.approvals ?? []).filter(item => item.botId === person.id).length
      const waiting = work?.waiting?.[person.id]
      const backlog = approval + (waiting?.bots?.length ?? 0) + (waiting?.rooms?.length ?? 0)
      if (person.state.kind === 'waiting') person.state = { ...person.state, towards: live?.waits?.bots?.[0], memorials: backlog }
      else person.state = { ...person.state, memorials: backlog }
    }
    return value
  }, [roster, heldStates, hour])

  // Where the reader is, read once and then kept up while the board is open: walking to
  // another city changes the clock, the 时辰 and the weather with it. A city the reader
  // picked by hand is never overridden; everything else is asked again, past the cache.
  useEffect(() => {
    if (!state.open) return undefined
    let stopped = false
    const take = (fresh) => {
      if (readManualPlace()) return
      const ticket = tickets.current.issue()
      resolvePlace(fresh ? { fresh: true } : {}).then((next) => {
        // a city picked while this was in flight wins over the answer
        if (stopped || !next) return
        settleLocate(ticket, tickets.current, () => { if (!readManualPlace()) setPlace(next) })
      }).catch(() => {})
    }
    take(false)
    const timer = setInterval(() => take(true), PLACE_REFRESH_MS)
    const onVisible = () => { if (!document.hidden) take(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      // nothing about where the reader was stays behind once the board is put away, and
      // a position still in flight when it closed lands nowhere
      tickets.current.issue()
      setLocating(false)
      setPicker(false)
      clearPlaceCache()
    }
  }, [state.open])

  // The place's weather, checked while the board is open.
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    if (!state.open) return undefined
    let stopped = false
    const load = () => fetchWeather(place ?? {}).then((next) => { if (!stopped && next) setWeather(next) })
    load()
    const timer = setInterval(load, 30 * 60 * 1000)
    return () => { stopped = true; clearInterval(timer) }
  }, [state.open, place?.lat, place?.lon])
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
        onSelect: (id, building, pile) => {
          if (pile && id) { setDuty(id); setEgg(null); return }
          selectOfficial(id)
          setGreetTick(tick => tick + 1)
          const kind = eggOf(building)
          if (kind) setEgg(kind)
        },
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
  useEffect(() => { setSoundOn(sound.current?.enabled?.() === true) }, [])
  // 晨钟暮鼓: once each, on the hour, while the board is open and the sound is on.
  useEffect(() => {
    if (!state.open || !soundOn) return
    const day = new Date().toLocaleDateString('en-CA', { timeZone: place?.timeZone || 'Asia/Shanghai' })
    for (const [name, from] of [['bell', 6], ['drum', 17]]) {
      if (hour < from || hour >= from + 1) continue
      const key = `${day}:${name}`
      if (rang.current[key]) continue
      rang.current[key] = true
      sound.current?.play?.(name)
    }
  }, [hour, state.open, soundOn, place?.timeZone])

  // bridge.js reads what each official has in hand from this snapshot, and sends only
  // through the host's own action after the confirmation card.
  useEffect(() => {
    wireBridge({
      roster,
      live: new Map(heldStates.map(item => [item.bot.id, item])),
      work,
      hour,
      phrase: entry => workPhrase(entry?.detail ?? entry?.doing, entry?.bot),
      words: { pending: t('等皇上定夺'), question: t('等皇上答话'), done: t('已办，待阅'), idle: t('候旨'), sleep: t('歇息') },
      send: (botId, text) => {
        const bot = roster.byId?.[botId]
        return bot ? actions.send(currentPart(bot), text) : Promise.reject(new Error('Unknown Bot'))
      },
    })
    return () => unwireBridge()
  }, [roster, heldStates, work, hour])

  // 回礼: a picked official says one line about the errand he is on, a different one each time.
  useEffect(() => {
    if (!state.open || !selected || scene.current === null) return
    const person = cast.people.find(item => item.id === selected)
    if (!person) return
    const pick = nextPick(picks.current, selected)
    const duty = readDuty(selected)
    scene.current.say(selected, greetingOf(person.state.kind, { task: duty?.task ?? '', pick }))
  }, [selected, state.open, greetTick])
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
    sound.current?.play?.('decree')
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
    let played = false
    for (const entry of messages) {
      if (!entry || typeof entry.at !== 'number' || now - entry.at > 15_000) continue
      const key = `${entry.from}>${entry.to ?? entry.room}@${entry.at}`
      if (sent.current.has(key)) continue
      sent.current.add(key)
      scene.current.send({ from: entry.from, to: entry.to, room: entry.room })
      if (!played) { sound.current?.play?.('runner'); played = true }
    }
  }, [messages, state.open])

  useEffect(() => {
    if (!state.open) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (touring) { tour.current?.stop(); setTouring(false); return }
      if (egg) { setEgg(null); return }
      if (board.selected) selectOfficial(null)
      else closeCourtBoard()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state.open, touring, egg])

  const cardId = useExitValue(state.open ? selected : null)
  // After every hook: turning the theme off unmounts the board without changing the hook order.
  if (!themed || !state.open) return null
  const card = cardId === null ? null : cast.bots.find(item => item.bot.id === cardId) ?? null
  const focus = (id) => { selectOfficial(id); setPreset(null) }
  const dropDocket = (x, y) => {
    const hit = scene.current?.pickClient?.(x, y)
    const bot = hit?.id ? roster.byId?.[hit.id] : null
    if (!bot) return
    const text = t('Take care of the errand in hand')
    setSendError('')
    setDocket(dispatcher.current.ask({ bot, text }))
  }
  const pickView = (key) => { selectOfficial(null); setPreset(key); scene.current?.view(key) }
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
  return createPortal(h('div', {
    className: 'bt-cb-pane',
    // macOS draws the window's lights at the window's left; the head needs to know when
    // the board is the thing hugging that edge.
    'data-edge': paneLeft === 0 ? 'left' : undefined,
    style: { left: paneLeft },
  },
    h('div', { className: 'bt-cb-head' },
      h('span', { className: 'bt-cb-mark' }, h(SealIcon, { size: 22 })),
      h('div', { className: 'bt-cb-heading' },
        h('span', { className: 'bt-cb-title' }, t('小朝廷值房')),
        h('button', {
          type: 'button', className: 'bt-cb-sub', title: t('Change the city'), 'aria-label': t('Change the city'),
          onClick: () => { setPicker(true); setFound([]); setDenied(false) },
          style: { border: 0, padding: 0, background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' },
        }, `${dateLine(place?.timeZone)} · ${shichen(hour)}${weather?.word ? ` · ${place?.city || t('This place')} ${weather.word} ${weather.temp}°C` : ''}`)),
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
      h('button', {
        type: 'button', className: 'bt-cb-icon', 'data-on': soundOn, 'aria-pressed': soundOn,
        title: soundOn ? t('Sound is on') : t('Sound is off'),
        'aria-label': soundOn ? t('Sound is on') : t('Sound is off'),
        onClick: () => {
          const next = !soundOn
          sound.current?.setEnabled?.(next)
          setSoundOn(next)
        },
      }, h(SoundIcon, { on: soundOn })),
      h(DocketChip, { onDrop: dropDocket }),
      h('button', {
        type: 'button', className: 'bt-cb-icon', title: t('Tour the court'), 'aria-label': t('Tour the court'),
        'data-on': touring, 'aria-pressed': touring,
        onClick: () => {
          if (touring) { tour.current?.stop(); setTouring(false); return }
          selectOfficial(null)
          setEgg(null)
          setPreset(null)
          tour.current = createTour({ world: scene.current, onEnd: () => setTouring(false) })
          tour.current.start()
          setTouring(true)
        },
      }, h(TourIcon)),
      h('div', { className: 'bt-cb-seg', role: 'group', 'aria-label': t('Overview') },
        [['overview', t('Show the whole city')], ['cabinet', t('Show the Cabinet halls')], ['six', t('Show the Six Ministries')]].map(([key, hintText]) => h('button', {
          key, type: 'button', 'data-on': preset === key, title: hintText,
          'aria-label': key === 'overview' ? t('Overview') : key === 'cabinet' ? t('The Cabinet') : t('The Six Ministries'),
          onClick: () => pickView(key),
        }, key === 'overview' ? t('Overview') : key === 'cabinet' ? t('The Cabinet') : t('The Six Ministries')))),
      h('button', { type: 'button', className: 'bt-cb-icon bt-cb-x', 'aria-label': t('关闭'), title: t('关闭'), onClick: closeCourtBoard }, h(CloseIcon))),
    h('div', { className: 'bt-cb-stage' },
      h('div', { ref: stage, className: 'bt-cb-world' }),
      h('div', { ref: tags, className: 'bt-cb-tags' }),
      broken ? h('div', { className: 'bt-cb-broken' }, t('这台机器没有可用的 WebGL，值房图显示不出来；奏事簿、名册和官员卡片照常可用。')) : null,
      !broken ? h(CourtMinimap, { world: scene, selected }) : null,
      picker ? h(CityPicker, {
        city: place?.city || '',
        results: found,
        busy: locating,
        onSearch: (query) => {
          const text = query.trim()
          if (text.length < 1) { setFound([]); return }
          searchPlaces(text).then((list) => setFound(list ?? [])).catch(() => setFound([]))
        },
        onPick: (chosen) => {
          tickets.current.issue()
          setManualPlace(chosen)
          setPlace(chosen)
          setPicker(false)
          setDenied(false)
        },
        onUseLocation: async () => {
          setLocating(true)
          const ticket = tickets.current.issue()
          forgetLocationDenial()
          clearManualPlace()
          const next = await resolvePlace({ fresh: true }).catch(() => null)
          // the gate comes first: a request from a closed board must not clear the waiting
          // state of a newer one, nor move the city
          settleLocate(ticket, tickets.current, () => {
            setLocating(false)
            if (next && next.source === 'system') { setPlace(next); setPicker(false); setDenied(false) }
            else { setPlace(next); setDenied(true) }
          })
        },
        onClose: () => setPicker(false),
      }) : null,
      picker && denied ? h('div', {
        role: 'status',
        style: { position: 'absolute', zIndex: 7, left: '18px', top: '366px', width: '296px', padding: '10px 14px', borderRadius: '12px', background: 'var(--bt-card)', color: 'var(--bt-ink-2)', fontSize: '13px', lineHeight: '19px', boxShadow: '0 0 0 .5px var(--bt-line-2)' },
      }, t('No location. Pick a city instead.')) : null,
      egg !== null ? h(CourtEgg, { hall: egg, onClose: () => setEgg(null) }) : null,
      duty !== null ? h(DutyCard, { name: roster.byId?.[duty]?.name ?? '', duty: readDuty(duty), onClose: () => setDuty(null) }) : null,
      docket !== null ? h(DispatchCard, {
        copy: docket,
        error: sendError,
        busy: sending,
        onConfirm: async () => {
          if (sending) return
          setSending(true)
          const answer = await dispatcher.current.confirm()
          setSending(false)
          if (answer?.ok === false) { setSendError(t('The message did not go out')); return }
          setSendError('')
          setDocket(null)
        },
        onCancel: () => { dispatcher.current.cancel(); setSendError(''); setDocket(null) },
      }) : null,
      panel === 'feed' ? h(FeedPanel, { log, bots: cast.bots, onSelect: focus }) : null,
      panel === 'roster' ? h(RosterPanel, { bots: cast.bots, selected, onSelect: focus }) : null,
      card !== null ? h(OfficialCard, { item: card, live: heldStates.find(item => item.bot.id === card.bot.id), sessions, actions, closing: selected === null, onFly: () => scene.current?.flyTo(card.bot.id) }) : null,
      hint && !broken ? h('div', { className: 'bt-cb-hint' }, t('拖动转视角 · 右键拖动平移 · 滚轮缩放 · 点小人看详情 · 双击进对话')) : null)), document.body)
}

// 小地图: the whole city in a corner, with the officials walking on it and a mark for
// where the eye is looking. Click a spot and the camera goes there, north up.
const MAP = { x0: -92, x1: 92, z0: -88, z1: 72 }
function CourtMinimap({ world, selected }) {
  const canvas = useRef(null)
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return undefined
    let frame = 0
    let last = 0
    const draw = (time) => {
      frame = requestAnimationFrame(draw)
      if (time - last < 120) return
      last = time
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = cv.clientWidth || 132
      const h = cv.clientHeight || 132
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      const c = cv.getContext('2d')
      if (!c) return
      const ink = getComputedStyle(cv)
      const paint = (name) => ink.getPropertyValue(name).trim() || 'transparent'
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, w, h)
      const sx = x => (x - MAP.x0) / (MAP.x1 - MAP.x0) * w
      const sz = z => (z - MAP.z0) / (MAP.z1 - MAP.z0) * h
      c.fillStyle = paint('--bt-mini-ground')
      c.fillRect(sx(-WALL.x), sz(WALL.north), sx(WALL.x) - sx(-WALL.x), sz(WALL.south) - sz(WALL.north))
      c.globalAlpha = 0.9
      for (const hall of BUILDINGS) {
        if (hall.spare) continue
        c.fillStyle = hall.roof ?? paint('--bt-mini-hall')
        const bw = Math.max(2, (hall.w + 3) / (MAP.x1 - MAP.x0) * w)
        const bd = Math.max(2, (hall.d + 3) / (MAP.z1 - MAP.z0) * h)
        c.fillRect(sx(hall.x) - bw / 2, sz(hall.z) - bd / 2, bw, bd)
      }
      c.globalAlpha = 1
      c.strokeStyle = paint('--bt-mini-wall')
      c.lineWidth = 1
      c.strokeRect(sx(-WALL.x) + 0.5, sz(WALL.north) + 0.5, sx(WALL.x) - sx(-WALL.x) - 1, sz(WALL.south) - sz(WALL.north) - 1)
      const api = world?.current
      const spot = api?.viewPoint?.()
      if (spot) {
        const vx = sx(spot.x)
        const vz = sz(spot.z)
        c.fillStyle = paint('--bt-mini-look')
        c.beginPath()
        c.moveTo(vx, vz)
        c.arc(vx, vz, 17, Math.atan2(-Math.cos(spot.yaw), -Math.sin(spot.yaw)) - 0.42, Math.atan2(-Math.cos(spot.yaw), -Math.sin(spot.yaw)) + 0.42)
        c.closePath()
        c.fill()
      }
      for (const person of api?.positions?.() ?? []) {
        c.fillStyle = person.id === selected ? paint('--bt-mini-mark') : paint('--bt-mini-dot')
        c.beginPath()
        c.arc(sx(person.x), sz(person.z), person.id === selected ? 2.8 : 1.8, 0, 7)
        c.fill()
      }
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [world, selected])
  const pick = (event) => {
    const cv = canvas.current
    if (!cv) return
    const rect = cv.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    world?.current?.lookAt(
      MAP.x0 + (event.clientX - rect.left) / rect.width * (MAP.x1 - MAP.x0),
      MAP.z0 + (event.clientY - rect.top) / rect.height * (MAP.z1 - MAP.z0),
    )
  }
  return h('canvas', {
    ref: canvas, className: 'bt-cb-mini', role: 'button', tabIndex: 0,
    'aria-label': `${t('Minimap')} · ${t('Map of the court board, north up')}`,
    title: t('Click the minimap to look there'),
    onClick: pick,
    onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); world?.current?.view('overview') } },
    style: {
      position: 'absolute', right: '14px', bottom: '14px', width: '124px', height: '124px',
      padding: 0, border: 0, borderRadius: '12px', zIndex: 3, cursor: 'crosshair',
      background: 'var(--bt-card)', boxShadow: '0 0 0 .5px var(--bt-line-2), 0 8px 20px rgba(0,0,0,.16)',
    },
  })
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
// How often the board looks again at where the reader is. Half an hour, the same beat as
// the weather: the look is forced past place.js's own cache, so a move is picked up.
const PLACE_REFRESH_MS = 30 * 60 * 1000

function useHour(timeZone) {
  const [hour, setHour] = useState(() => nowHour(timeZone))
  useEffect(() => {
    setHour(nowHour(timeZone))
    const timer = setInterval(() => setHour(nowHour(timeZone)), 30000)
    return () => clearInterval(timer)
  }, [timeZone])
  return hour
}

function nowHour(timeZone) {
  return hourIn(timeZone)
}

const dateLine = timeZone => dateIn(timeZone)
const timeOf = (at, timeZone = 'Asia/Shanghai') => new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at))

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
const SoundIcon = ({ on }) => svg([
  h('path', { key: 'a', d: 'M4 10v4h3l4 3V7L7 10H4Z' }),
  on ? h('path', { key: 'b', d: 'M15 9a4 4 0 0 1 0 6' }) : null,
  on ? h('path', { key: 'c', d: 'M17.5 6.5a7.5 7.5 0 0 1 0 11' }) : null,
  on ? null : h('path', { key: 'd', d: 'M15 9l5 6M20 9l-5 6' }),
])
const TourIcon = () => svg([h('path', { key: 'a', d: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z' }), h('circle', { key: 'b', cx: 12, cy: 12, r: 3 })])
const CloseIcon = () => svg([h('path', { key: 'a', d: 'M6 6l12 12' }), h('path', { key: 'b', d: 'M18 6L6 18' })])
