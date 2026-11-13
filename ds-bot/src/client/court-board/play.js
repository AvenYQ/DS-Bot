// 值房图上的玩处: 御驾巡视的镜头, 三处衙门的彩蛋, 奏折堆的待办, 派活的确认卡. scene.js
// 只出镜头和位置, index.js 只挂按钮和浮层; 台词和文案由 lines.js 给, 这里只留兜底.
import { createElement as h, useEffect, useRef, useState } from 'react'
import { t } from '../i18n.js'
import { EGGS, EGG_CLOSE, dispatchCopy } from './lines.js'

// 御驾巡视: 沿中轴从午门一路走到乾清宫, 一步一停. 每步是眼睛的位置和看的地方.
export const TOUR_STEPS = [
  { eye: [0, 26, 62], look: [0, 3, 30] },
  { eye: [0, 25, 50], look: [0, 3, 20] },
  { eye: [0, 24, 40], look: [0, 3, 10] },
  { eye: [0, 24, 30], look: [0, 3, -2] },
  { eye: [0, 26, 18], look: [0, 3, -14] },
  { eye: [0, 27, 6], look: [0, 3, -26] },
  { eye: [0, 26, -12], look: [0, 3, -40] },
  { eye: [0, 24, -24], look: [0, 3, -52] },
]
export const TOUR_LEG_MS = 1500

/**
 * Walks the eye down the axis, one leg at a time. Stop it with `stop()`; it tells the
 * caller when it is over, so the button can go quiet.
 * @returns {{start: Function, stop: Function, isRunning: Function}}
 */
export function createTour({ world, legMs = TOUR_LEG_MS, onEnd }) {
  let timer = 0
  let leg = -1
  let running = false
  const stop = () => {
    if (!running) return
    running = false
    clearTimeout(timer)
    onEnd?.()
  }
  const advance = () => {
    leg += 1
    if (leg >= TOUR_STEPS.length) { stop(); return }
    const step = TOUR_STEPS[leg]
    world?.glideTo?.(step.look, step.eye, Math.max(0.6, legMs / 1000 - 0.15))
    timer = setTimeout(advance, legMs)
  }
  return {
    start() {
      if (running) return
      running = true
      leg = -1
      advance()
    },
    stop,
    isRunning: () => running,
  }
}

// 三处衙门的彩蛋: 钦天监的星图, 翰林院的画, 内承运库的账.
export const EGG_HALLS = { sitian: 'star', hanlin: 'painting', neiwufu: 'ledger' }
export const EGG_TITLES = {
  star: '钦天监 · 观星',
  painting: '翰林院 · 看画',
  ledger: '内承运库 · 看账',
}

function Stars() {
  const stars = [
    [24, 40], [52, 22], [78, 54], [104, 30], [128, 62], [150, 26], [176, 48], [198, 34],
    [64, 78], [96, 96], [132, 88], [166, 74], [40, 104], [186, 100], [112, 16], [206, 76],
  ]
  return h('svg', { viewBox: '0 0 230 130', width: '100%', height: '100%', role: 'img', 'aria-label': t('A star chart') },
    stars.map(([x, y], i) => h('circle', { key: i, cx: x, cy: y, r: i % 4 === 0 ? 2.4 : 1.5, fill: 'var(--bt-egg-star)' })),
    h('polyline', {
      points: '24,40 52,22 78,54 104,30 128,62', fill: 'none',
      stroke: 'var(--bt-egg-star)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.7,
    }),
    h('circle', { cx: 150, cy: 26, r: 7, fill: 'var(--bt-egg-gold)' }),
  )
}

function Painting() {
  return h('svg', { viewBox: '0 0 230 130', width: '100%', height: '100%', role: 'img', 'aria-label': t('A painting') },
    h('rect', { x: 0, y: 0, width: 230, height: 130, fill: 'var(--bt-egg-paper)' }),
    h('circle', { cx: 176, cy: 34, r: 15, fill: 'var(--bt-cinnabar, currentColor)' }),
    h('path', { d: 'M0 106 L44 54 L80 88 L118 40 L170 100 L230 62 L230 130 L0 130 Z', fill: 'var(--bt-egg-ink)', opacity: 0.72 }),
    h('path', { d: 'M0 118 L60 84 L120 112 L190 88 L230 104 L230 130 L0 130 Z', fill: 'var(--bt-egg-ink)', opacity: 0.38 }),
    h('rect', { x: 1, y: 1, width: 228, height: 128, fill: 'none', stroke: 'var(--bt-egg-gold)', 'stroke-width': 2 }),
  )
}

function Ledger() {
  const rows = [0, 1, 2, 3, 4, 5]
  const beads = [0, 1, 2, 3, 4, 5, 6]
  return h('svg', { viewBox: '0 0 230 130', width: '100%', height: '100%', role: 'img', 'aria-label': t('A ledger') },
    h('rect', { x: 0, y: 0, width: 230, height: 130, fill: 'var(--bt-egg-paper)' }),
    rows.map(i => h('line', {
      key: i, x1: 16, y1: 26 + i * 16, x2: 132, y2: 26 + i * 16,
      stroke: 'var(--bt-egg-ink)', 'stroke-width': 1, opacity: 0.35,
    })),
    rows.slice(0, 4).map(i => h('line', {
      key: `t${i}`, x1: 20, y1: 22 + i * 16, x2: 68 + i * 12, y2: 22 + i * 16,
      stroke: 'var(--bt-egg-ink)', 'stroke-width': 2.5, opacity: 0.6, 'stroke-linecap': 'round',
    })),
    beads.map(i => h('circle', {
      key: `b${i}`, cx: 152 + (i % 4) * 18, cy: 44 + Math.floor(i / 4) * 26, r: 6,
      fill: i % 3 === 0 ? 'var(--bt-egg-gold)' : 'var(--bt-egg-ink)', opacity: i % 3 === 0 ? 1 : 0.55,
    })),
    h('line', { x1: 142, y1: 24, x2: 208, y2: 24, stroke: 'var(--bt-egg-gold)', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    h('line', { x1: 142, y1: 84, x2: 208, y2: 84, stroke: 'var(--bt-egg-gold)', 'stroke-width': 3, 'stroke-linecap': 'round' }),
  )
}

const EGG_ART = { star: Stars, painting: Painting, ledger: Ledger }
const EGG_KIND = { sitian: 'star', hanlin: 'painting', neiwufu: 'ledger' }

/**
 * The little card behind one 衙门's 彩蛋. `hall` is the building id; its title and words
 * come from lines.js.
 */
export function CourtEgg({ hall, onClose }) {
  const kind = EGG_KIND[hall] ?? 'star'
  const Art = EGG_ART[kind] ?? Stars
  const words = EGGS[hall] ?? { title: '', lines: [] }
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose?.() } }
    window.addEventListener('keydown', onKey, true)
    ref.current?.focus?.()
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return h('div', {
    className: 'cb-egg', role: 'dialog', 'aria-modal': 'false', 'aria-label': words.title, ref, tabIndex: -1,
    onClick: onClose,
    style: {
      position: 'absolute', zIndex: 6, right: '18px', bottom: '150px', width: '288px',
      padding: '14px', borderRadius: '16px', background: 'var(--bt-card)',
      boxShadow: '0 0 0 .5px var(--bt-line-2), 0 12px 28px var(--bt-egg-scrim)',
      color: 'var(--bt-ink)', fontSize: '13px', lineHeight: '20px', cursor: 'pointer', outline: 'none',
    },
  },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
    h('b', { style: { fontSize: '13px', fontWeight: 600 } }, words.title),
    h('span', { style: { flex: '1' } }),
    h('button', {
      type: 'button', 'aria-label': EGG_CLOSE, title: EGG_CLOSE, onClick: onClose,
      style: {
        width: '24px', height: '24px', border: 0, borderRadius: '999px', cursor: 'pointer',
        background: 'var(--bt-hover)', color: 'var(--bt-ink-2)', fontSize: '13px',
      },
    }, '×')),
  h('div', {
    style: {
      height: '124px', borderRadius: '10px', overflow: 'hidden',
      background: kind === 'star' ? 'var(--bt-egg-sky)' : 'var(--bt-egg-paper)',
    },
  }, h(Art)),
  words.lines.map((line, i) => h('p', { key: i, style: { margin: i === 0 ? '8px 0 0' : '4px 0 0', color: 'var(--bt-ink)' } }, line)),
  h('p', { style: { margin: '8px 0 0', color: 'var(--bt-ink-2)' } }, EGG_CLOSE))
}

/**
 * The card that stands between a 折子 and a real message. `send` is bridge.js's dispatch;
 * nothing here calls it until the 皇上 picks 准奏.
 */
export function createDispatch({ send } = {}) {
  let pending = null
  let sending = false
  return {
    ask({ bot, text }) {
      pending = { bot, text }
      return dispatchCopy({ name: bot?.name ?? '', text })
    },
    async confirm() {
      if (sending) return { ok: false, reason: 'in-flight' }
      if (!pending) return { ok: false, reason: 'nothing-to-send' }
      const job = pending
      sending = true
      const answer = (await send?.(job.bot.id, job.text, { confirmed: true })) ?? { ok: true }
      sending = false
      // A send that failed keeps the 折子, so 再试一次 has something to send again.
      if (answer?.ok === false) return answer
      pending = null
      return answer
    },
    cancel() {
      const had = pending !== null
      pending = null
      return had
    },
    pending: () => pending,
  }
}

/**
 * The 折子 the Emperor drags onto an official. It is only a handle: the drop point is
 * handed back, and index.js asks the scene who stands there.
 */
export function DocketChip({ onDrop }) {
  const [drag, setDrag] = useState(null)
  // The listeners go on at the press, not in an effect: a quick drag must not outrun React.
  const start = (event) => {
    event.preventDefault()
    const move = (next) => setDrag({ x: next.clientX, y: next.clientY })
    const up = (next) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      onDrop?.(next.clientX, next.clientY)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    setDrag({ x: event.clientX, y: event.clientY })
  }
  return h('button', {
    type: 'button', className: 'bt-cb-icon', title: t('Drag a memorial onto an official'),
    'aria-label': t('Drag a memorial onto an official'),
    onPointerDown: start,
    style: { cursor: 'grab', touchAction: 'none' },
  }, h('span', { style: { fontSize: '13px', fontWeight: 600 } }, t('Memorial')),
  drag ? h('div', {
    style: {
      position: 'fixed', left: `${drag.x + 12}px`, top: `${drag.y + 12}px`, zIndex: 99,
      padding: '4px 10px', borderRadius: '8px', background: 'var(--bt-paper)', color: 'var(--bt-ink)',
      fontSize: '13px', boxShadow: '0 6px 18px var(--bt-egg-scrim)', pointerEvents: 'none',
    },
  }, t('Memorial')) : null)
}

/** 奏折堆: what waits on this official right now. */
export function DutyCard({ name, duty, onClose }) {
  const todos = duty?.todos ?? []
  return h('div', {
    className: 'cb-duty', role: 'dialog', 'aria-modal': 'false',
    style: {
      position: 'absolute', zIndex: 6, left: '18px', bottom: '18px', width: '288px',
      padding: '14px', borderRadius: '16px', background: 'var(--bt-card)',
      boxShadow: '0 0 0 .5px var(--bt-line-2), 0 12px 28px var(--bt-egg-scrim)',
      color: 'var(--bt-ink)', fontSize: '13px', lineHeight: '20px',
    },
  },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
    h('b', { style: { fontSize: '13px', fontWeight: 600 } }, `${name} · ${t('Pending memorials')}`),
    h('span', { style: { flex: '1' } }),
    h('button', {
      type: 'button', onClick: onClose, 'aria-label': t('Close'), title: t('Close'),
      style: { width: '24px', height: '24px', border: 0, borderRadius: '999px', cursor: 'pointer', background: 'var(--bt-hover)', color: 'var(--bt-ink-2)', fontSize: '13px' },
    }, '×')),
  todos.length === 0
    ? h('p', { style: { margin: 0, color: 'var(--bt-ink-2)' } }, t('Nothing waits on him right now'))
    : h('ol', { style: { margin: 0, paddingLeft: '18px' } },
      todos.map((todo, i) => h('li', { key: todo.id || i, style: { margin: i === 0 ? 0 : '4px 0 0' } }, todo.text))),
  duty?.task ? h('p', { style: { margin: '8px 0 0', color: 'var(--bt-ink-2)' } }, duty.task) : null)
}

/**
 * 换个地方: the small card behind the weather line. It searches a city, or asks for the
 * reader's own position; the words are lines.js's, the search and the position come from
 * place.js through the callbacks.
 */
export function CityPicker({ city, results = [], busy = false, onSearch, onPick, onUseLocation, onClose }) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose?.() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return h('div', {
    className: 'cb-city', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('Choose a city'),
    style: {
      position: 'absolute', zIndex: 7, left: '18px', top: '74px', width: '296px',
      padding: '14px', borderRadius: '16px', background: 'var(--bt-card)',
      boxShadow: '0 0 0 .5px var(--bt-line-2), 0 12px 28px var(--bt-egg-scrim)',
      color: 'var(--bt-ink)', fontSize: '13px', lineHeight: '20px', outline: 'none',
    },
  },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
    h('b', { style: { fontSize: '13px', fontWeight: 600 } }, t('Choose a city')),
    h('span', { style: { flex: '1' } }),
    h('button', {
      type: 'button', onClick: onClose, 'aria-label': t('Close'), title: t('Close'),
      style: { width: '24px', height: '24px', border: 0, borderRadius: '999px', cursor: 'pointer', background: 'var(--bt-hover)', color: 'var(--bt-ink-2)', fontSize: '13px' },
    }, '×')),
  h('input', {
    type: 'search', value: query, placeholder: t('Search for a city'), 'aria-label': t('Search for a city'),
    onChange: (event) => { setQuery(event.target.value); onSearch?.(event.target.value) },
    style: {
      width: '100%', boxSizing: 'border-box', height: '32px', padding: '0 10px', border: 0, borderRadius: '10px',
      background: 'var(--bt-tag-bg)', color: 'var(--bt-ink)', font: 'inherit', fontSize: '13px',
    },
  }),
  results.length > 0
    ? h('div', { role: 'list', style: { margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: '2px' } },
      results.slice(0, 6).map((place, index) => h('button', {
        key: `${place.lat},${place.lon},${index}`, type: 'button', role: 'listitem',
        onClick: () => onPick?.(place),
        style: {
          textAlign: 'left', border: 0, borderRadius: '8px', padding: '6px 8px', cursor: 'pointer',
          background: 'none', color: 'var(--bt-ink)', font: 'inherit', fontSize: '13px',
        },
      }, `${place.city}${place.region ? ` · ${place.region}` : ''}`)))
    : null,
  h('button', {
    type: 'button', onClick: onUseLocation, disabled: busy,
    style: {
      marginTop: '10px', width: '100%', height: '30px', border: 0, borderRadius: '999px', cursor: busy ? 'default' : 'pointer',
      background: 'var(--bt-hover)', color: 'var(--bt-ink)', font: 'inherit', fontSize: '13px', opacity: busy ? 0.6 : 1,
    },
  }, t('Use my location')),
  h('p', { style: { margin: '10px 0 0', color: 'var(--bt-ink-2)' } },
    t('The Mac’s location goes only to Open-Meteo for the weather and BigDataCloud for the city name, and is not kept here; a city you pick yourself is remembered on this machine, coordinates included.')),
  city ? h('p', { style: { margin: '6px 0 0', color: 'var(--bt-ink-2)' } }, city) : null)
}

/** The confirmation card itself: 准奏 sends, 且慢 only closes. */
export function DispatchCard({ copy, error = '', busy = false, onConfirm, onCancel }) {
  if (!copy) return null
  return h('div', {
    className: 'cb-dispatch', role: 'dialog', 'aria-modal': 'true', 'aria-label': copy.title,
    style: {
      position: 'absolute', zIndex: 7, left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: '320px', padding: '16px', borderRadius: '16px', background: 'var(--bt-card)',
      boxShadow: '0 0 0 .5px var(--bt-line-2), 0 16px 36px var(--bt-egg-scrim)',
      color: 'var(--bt-ink)', fontSize: '13px', lineHeight: '20px', outline: 'none',
    },
  },
  h('b', { style: { fontSize: '14px', fontWeight: 600 } }, copy.title),
  h('p', { style: { margin: '8px 0 0', color: 'var(--bt-ink-2)' } }, copy.to),
  h('p', { style: { margin: '2px 0 0' } }, copy.text),
  h('p', { style: { margin: '8px 0 12px', color: 'var(--bt-ink-2)' } }, copy.note),
  error ? h('p', { role: 'alert', style: { margin: '0 0 10px', color: 'var(--bt-danger)' } }, error) : null,
  h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
    h('button', {
      type: 'button', onClick: onCancel, disabled: busy,
      style: { height: '30px', padding: '0 14px', border: 0, borderRadius: '999px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, background: 'var(--bt-hover)', color: 'var(--bt-ink)', fontSize: '13px' },
    }, copy.cancel),
    h('button', {
      type: 'button', onClick: onConfirm, disabled: busy, 'aria-busy': busy,
      style: { height: '30px', padding: '0 14px', border: 0, borderRadius: '999px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, background: 'var(--bt-accent)', color: 'var(--bt-user-ink)', fontSize: '13px' },
    }, busy ? t('Sending the memorial…') : error ? t('Try sending it again') : copy.confirm)))
}

/**
 * A ticket for an answer that may arrive late: picking a city by hand takes a new ticket,
 * and any answer issued before it is dropped instead of overwriting the choice.
 */
export function createTicket() {
  let held = 0
  return {
    issue() { held += 1; return held },
    valid(ticket) { return ticket === held },
  }
}

/** How many times this official has been picked: the greeting walks its lines with it. */
export function nextPick(counts, id) {
  const at = (counts[id] ?? 0) + 1
  counts[id] = at
  return at
}

/** A tiny hook for index.js: which 衙门 has a 彩蛋, by building id. */
export function eggOf(building) {
  return Object.hasOwn(EGGS, building) ? building : null
}

export { greetingOf } from './lines.js'
