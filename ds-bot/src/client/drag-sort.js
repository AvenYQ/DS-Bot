// Arranging the sidebar by hand. Press and hold a row or a section's heading, and it lifts:
// drag it up or down and the rows in the way step aside; let go and it lands. A row can go
// to another section, out of every section (below the last one), or onto the pinned tiles;
// a tile can be dragged down into the list to unpin it. A heading moves its whole section.
// A short press is still a click.
import { useEffect, useRef } from 'react'

const HOLD_MS = 280
const SLOP = 6
const EDGE = 40
const ROWS = '.bt-row[data-bot-id],.bt-row[data-room-id]'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

// The list as it stands, top to bottom: what each row belongs to and where each section
// starts. `section` is a section's name, '' for no section, or null for the pinned area.
function readList(list) {
  const items = []
  let section = null
  for (const node of list.children) {
    if (node.classList.contains('bt-tiles')) continue
    if (node.classList.contains('bt-sec')) {
      section = node.dataset.section
      items.push({ kind: 'head', el: node, section })
    } else if (node.classList.contains('bt-sec-rest')) {
      section = ''
      items.push({ kind: 'rest', el: node, section })
    } else if (node.matches(ROWS)) {
      items.push({ kind: 'row', el: node, section: section ?? (list.querySelector('.bt-sec') ? null : ''), id: node.dataset.botId ?? node.dataset.roomId })
    }
  }
  return items
}

export function useDragSort(listRef, { enabled, actions, onLand }) {
  const state = useRef(null)
  useEffect(() => {
    const list = listRef.current
    if (!list || !enabled) return undefined
    let timer = 0
    let pending = null
    let swallowClick = false

    const cancelPending = () => { clearTimeout(timer); pending = null }

    const onPointerDown = (event) => {
      if (event.button !== 0 || state.current) return
      const target = event.target instanceof Element ? event.target : null
      const tile = target?.closest('.bt-tile[data-bot-id]')
      const row = tile ? null : target?.closest(ROWS)
      const head = tile || row ? null : target?.closest('.bt-sec-head')?.parentElement
      const el = tile ?? row ?? (head?.classList.contains('bt-sec') ? head : null)
      if (!el || !list.contains(el)) return
      pending = { el, kind: tile ? 'tile' : row ? 'row' : 'section', x: event.clientX, y: event.clientY, pointer: event.pointerId }
      timer = setTimeout(() => lift(), HOLD_MS)
    }

    const onPointerMove = (event) => {
      if (pending && !state.current) {
        if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > SLOP) cancelPending()
        return
      }
      const drag = state.current
      if (!drag || event.pointerId !== drag.pointer) return
      event.preventDefault()
      drag.y = event.clientY
      follow()
    }

    function lift() {
      const p = pending
      pending = null
      if (!p || !p.el.isConnected) return
      const items = readList(list)
      // Positions in the list's own scrolled space, taken before anything moves.
      const box = list.getBoundingClientRect()
      for (const item of items) {
        const r = item.el.getBoundingClientRect()
        item.top = r.top - box.top + list.scrollTop
        item.bottom = item.top + r.height
      }
      const rect = p.el.getBoundingClientRect()
      const drag = { ...p, items, startY: p.y, y: p.y, scroll0: list.scrollTop, moved: new Set(), slot: -1, tiles: list.querySelector('.bt-tiles') }
      if (p.kind === 'section') {
        // The section moves with its rows; sections are the units that step aside.
        const groups = []
        for (const item of items) {
          if (item.kind === 'head') groups.push({ section: item.section, els: [item.el] })
          else if (item.kind === 'rest') groups.push(null)
          else if (groups.length > 0 && groups.at(-1) !== null && item.section === groups.at(-1).section) groups.at(-1).els.push(item.el)
        }
        const where = el => items.find(item => item.el === el)
        drag.groups = groups.filter(Boolean).map(group => ({ ...group, top: where(group.els[0]).top, bottom: where(group.els.at(-1)).bottom }))
        drag.from = drag.groups.findIndex(group => group.els[0] === p.el)
        if (drag.from < 0) return
        drag.self = drag.groups[drag.from]
        drag.height = drag.self.bottom - drag.self.top + 2
      } else {
        drag.rows = items.filter(item => item.el !== p.el)
        drag.from = p.kind === 'tile' ? -1 : items.findIndex(item => item.el === p.el)
        drag.height = rect.height + 2
      }
      state.current = drag
      swallowClick = true
      try { p.el.setPointerCapture?.(p.pointer) } catch { /* the pointer is gone */ }
      for (const el of drag.self?.els ?? [p.el]) el.setAttribute('data-lifted', '')
      list.setAttribute('data-sorting', p.kind)
      navigator.vibrate?.(8)
      follow()
    }

    // Moves what is lifted with the pointer, and the rows or sections between where it
    // came from and where it would land out of its way.
    function follow() {
      const drag = state.current
      const box = list.getBoundingClientRect()
      // Near the list's top or bottom edge it scrolls.
      if (drag.y < box.top + EDGE) list.scrollTop -= 8
      else if (drag.y > box.bottom - EDGE) list.scrollTop += 8
      const dy = drag.y - drag.startY + (list.scrollTop - drag.scroll0)
      const pointerTop = drag.y - box.top + list.scrollTop
      for (const el of drag.self?.els ?? [drag.el]) el.style.transform = `translateY(${dy}px)`
      const overTiles = drag.kind !== 'section' && drag.tiles !== null && drag.y < drag.tiles.getBoundingClientRect().bottom
      drag.overTiles = overTiles
      drag.tiles?.toggleAttribute('data-drop', overTiles && drag.kind === 'row' && drag.el.dataset.botId !== undefined)
      if (drag.kind === 'section') {
        let target = drag.from
        drag.groups.forEach((group, index) => {
          const mid = (group.top + group.bottom) / 2
          if (index > drag.from && pointerTop > mid) target = index
          if (index < drag.from && pointerTop < mid && index < target) target = index
        })
        drag.slot = target
        drag.groups.forEach((group, index) => {
          const shift = index === drag.from ? null
            : drag.from < target && index > drag.from && index <= target ? -drag.height
              : drag.from > target && index >= target && index < drag.from ? drag.height : 0
          if (shift !== null) for (const el of group.els) step(el, shift)
        })
        return
      }
      // Rows: the slot is the number of rows (and headings) above the pointer, the lifted
      // row not counted.
      let slot = 0
      for (const item of drag.rows) {
        const mid = (item.top + item.bottom) / 2
        if (pointerTop > mid) slot++
      }
      if (overTiles) slot = 0
      drag.slot = slot
      const from = drag.kind === 'tile' ? Infinity : drag.from
      drag.rows.forEach((item, index) => {
        const shift = overTiles ? 0
          : index >= slot && index < from ? drag.height
            : index < slot && index >= from ? -drag.height : 0
        step(item.el, shift)
      })
    }

    function step(el, shift) {
      const drag = state.current
      if (shift === 0) {
        if (drag.moved.has(el)) { el.style.transform = ''; drag.moved.delete(el) }
        return
      }
      el.style.transform = `translateY(${shift}px)`
      drag.moved.add(el)
    }

    // Where it lands: a row's section and its new order there, a tile unpinned into the
    // list, a row pinned, or a section's new place.
    async function land() {
      const drag = state.current
      list.removeAttribute('data-sorting')
      drag.tiles?.removeAttribute('data-drop')
      const settle = () => {
        for (const el of [...drag.moved, ...(drag.self?.els ?? [drag.el])]) { el.style.transform = ''; el.removeAttribute('data-lifted') }
        state.current = null
      }
      // Where every row is drawn now, so the list glides from there into its new order.
      const seen = new Map()
      for (const el of list.querySelectorAll(`${ROWS},.bt-sec,.bt-tile[data-bot-id]`)) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform)
        const key = el.dataset.botId ?? el.dataset.roomId ?? (el.dataset.section !== undefined ? `section:${el.dataset.section}` : undefined)
        if (key !== undefined) seen.set(key, el.offsetTop + matrix.m42)
      }
      let change = null
      if (drag.kind === 'section') {
        if (drag.slot !== drag.from) change = () => actions.arrangeSection(drag.self.section, { to: drag.slot })
      } else {
        const id = drag.el.dataset.botId ?? drag.el.dataset.roomId
        const isBot = drag.el.dataset.botId !== undefined
        if (drag.overTiles) {
          if (isBot && drag.kind === 'row') change = () => actions.setFlags(id, { pinned: true })
        } else {
          const above = drag.rows[drag.slot - 1]
          const section = above === undefined ? (drag.rows[0]?.section ?? '') : above.section
          if (section !== null) {
            const ids = drag.rows.filter((item, index) => item.kind === 'row' && item.section === section && index < drag.slot).map(item => item.id)
            const after = drag.rows.filter((item, index) => item.kind === 'row' && item.section === section && index >= drag.slot).map(item => item.id)
            const order = [...ids, id, ...after]
            const same = drag.kind === 'row' && drag.items.filter(item => item.kind === 'row' && item.section === section).map(item => item.id).join() === order.join()
            if (!same) {
              change = async () => {
                if (drag.kind === 'tile') await actions.setFlags(id, { pinned: false })
                return actions.arrangeEntries(section, order)
              }
            }
          } else if (isBot && drag.kind === 'row') {
            change = () => actions.setFlags(id, { pinned: true })
          }
        }
      }
      if (change === null || reducedMotion()) {
        for (const el of [...drag.moved, ...(drag.self?.els ?? [drag.el])]) el.style.transition = 'transform .2s cubic-bezier(.32,.72,0,1)'
        settle()
        setTimeout(() => { for (const el of list.querySelectorAll('[style*="transition"]')) el.style.transition = '' }, 220)
        if (change === null) return
      }
      onLand?.(seen, settle)
      try {
        await change()
      } catch (error) {
        actions.reportError?.(error, 'sidebar')
      } finally {
        // When the change brings no new order the rows still go home.
        setTimeout(() => { if (state.current === drag) settle() }, 400)
      }
    }

    const onPointerUp = (event) => {
      cancelPending()
      const drag = state.current
      if (!drag || event.pointerId !== drag.pointer) return
      // The click that follows a drop is the drop's, not a click; one that never comes
      // must not eat the next real one.
      setTimeout(() => { swallowClick = false }, 0)
      void land()
    }
    const onClick = (event) => {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    const onKey = (event) => {
      if (event.key !== 'Escape' || !state.current) return
      const drag = state.current
      drag.slot = drag.from
      drag.overTiles = false
      for (const el of [...drag.moved, ...(drag.self?.els ?? [drag.el])]) { el.style.transform = ''; el.removeAttribute('data-lifted') }
      list.removeAttribute('data-sorting')
      state.current = null
    }
    const onContextMenu = (event) => { if (state.current) event.preventDefault() }

    list.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    list.addEventListener('click', onClick, true)
    list.addEventListener('contextmenu', onContextMenu, true)
    window.addEventListener('keydown', onKey)
    return () => {
      cancelPending()
      list.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      list.removeEventListener('click', onClick, true)
      list.removeEventListener('contextmenu', onContextMenu, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled])
}

export const DRAG_SORT_CSS = `
.bt-list[data-sorting] :is(.bt-row,.bt-sec){transition:transform .22s cubic-bezier(.32,.72,0,1)}
.bt-list[data-sorting] [data-lifted]{transition:none;position:relative;z-index:5}
.bt-list[data-sorting] .bt-row[data-lifted],.bt-list[data-sorting] .bt-tile[data-lifted]{background:var(--bt-card);box-shadow:0 6px 18px color-mix(in srgb,var(--bt-ink) 16%,transparent),0 0 0 .5px var(--bt-line-2);scale:1.02}
.bt-list[data-sorting] .bt-sec[data-lifted]{background:var(--bt-sidebar);border-radius:8px;box-shadow:0 6px 18px color-mix(in srgb,var(--bt-ink) 14%,transparent)}
.bt-list[data-sorting] .bt-row[data-lifted][data-bot-id] ~ *{pointer-events:none}
.bt-list[data-sorting]{cursor:grabbing;user-select:none}
.bt-tiles[data-drop]{border-radius:12px;background:color-mix(in srgb,var(--bt-accent) 8%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--bt-accent) 40%,transparent)}
@media (prefers-reduced-motion:reduce){.bt-list[data-sorting] :is(.bt-row,.bt-sec){transition:none}}
`
