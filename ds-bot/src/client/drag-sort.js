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
    let clickTimer = 0

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
      if (!drag || drag.landing || event.pointerId !== drag.pointer) return
      event.preventDefault()
      drag.y = event.clientY
      follow()
    }

    // The real rows leave layout immediately so hit testing uses their final positions;
    // visual copies make that change read as the members tucking into the heading.
    function foldPreview(rows, head) {
      if (!rows.length || reducedMotion() || typeof rows[0].el.animate !== 'function') return null
      const box = list.getBoundingClientRect()
      const target = head.getBoundingClientRect().bottom
      const layer = document.createElement('div')
      layer.setAttribute('aria-hidden', 'true')
      layer.inert = true
      Object.assign(layer.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, overflow: 'hidden', pointerEvents: 'none', zIndex: '6' })
      // Outside the list, where a render of the sidebar cannot reconcile it away.
      document.body.append(layer)
      const copies = []
      rows.forEach(({ el }, index) => {
        const rect = el.getBoundingClientRect()
        const copy = el.cloneNode(true)
        copy.removeAttribute('data-bot-id')
        copy.removeAttribute('data-room-id')
        copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
        Object.assign(copy.style, {
          position: 'absolute', left: `${rect.left - box.left}px`, top: `${rect.top - box.top}px`,
          width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', pointerEvents: 'none',
          transformOrigin: '50% 0', opacity: '1', transform: 'translateY(0) scale(1)',
        })
        layer.append(copy)
        copies.push({ copy, distance: Math.max(-80, Math.min(-10, target - rect.top)), delay: Math.min(index, 3) * 12 })
      })
      // A transition rather than a script animation: the copies rest invisible, so the end
      // of the fade cannot hand anything back to be painted.
      void layer.offsetWidth
      for (const { copy, distance, delay } of copies) {
        copy.style.transition = `opacity ${190 + delay}ms cubic-bezier(.4,0,.6,1) ${delay}ms, transform ${190 + delay}ms cubic-bezier(.4,0,.6,1) ${delay}ms`
        copy.style.opacity = '0'
        copy.style.transform = `translateY(${distance}px) scale(.92)`
      }
      // The layer stays until after the drop. Taking a fixed overlay away in the middle of
      // a drag made the browser present the strip it covered for a frame, which showed the
      // members once more; once the copies have faded it holds no visible pixels.
      return layer
    }

    function lift() {
      const p = pending
      pending = null
      if (!p || !p.el.isConnected) return
      const items = readList(list)
      const hidden = []
      let preview = null
      try {
        const before = p.kind === 'section' && !reducedMotion()
          ? new Map(items.map(item => [item.el, item.el.getBoundingClientRect().top])) : null
        if (p.kind === 'section') {
          const start = items.findIndex(item => item.el === p.el)
          if (start < 0) return
          for (const item of items.slice(start + 1)) {
            if (item.kind !== 'row') break
            if (item.el.getClientRects().length === 0) continue
            hidden.push({ el: item.el, value: item.el.style.getPropertyValue('display'), priority: item.el.style.getPropertyPriority('display') })
          }
          preview = foldPreview(hidden, p.el)
          for (const { el } of hidden) el.style.setProperty('display', 'none', 'important')
        }
        // Measure after hiding: other sections retain their full visible height.
        const box = list.getBoundingClientRect()
        for (const item of items) {
          const r = item.el.getBoundingClientRect()
          item.top = r.top - box.top + list.scrollTop
          item.bottom = item.top + r.height
        }
        const rect = p.el.getBoundingClientRect()
        const drag = { ...p, items, hidden, preview, styles: new Map(), startY: p.y, y: p.y, scroll0: list.scrollTop, moved: new Set(), slot: -1, tiles: list.querySelector('.bt-tiles'), animations: [], finished: false }
        if (p.kind === 'section') {
          // Only the heading lifts; other sections step aside as complete groups.
          const groups = []
          for (const item of items) {
            if (item.kind === 'head') groups.push({ section: item.section, els: [item.el] })
            else if (item.kind === 'rest') groups.push(null)
            else if (groups.length > 0 && groups.at(-1) !== null && item.section === groups.at(-1).section) groups.at(-1).els.push(item.el)
          }
          const where = el => items.find(item => item.el === el)
          drag.groups = groups.filter(Boolean).map(group => {
            const visible = group.els.filter(el => el.getClientRects().length > 0)
            return { ...group, top: where(group.els[0]).top, bottom: where(visible.at(-1) ?? group.els[0]).bottom }
          })
          drag.from = drag.groups.findIndex(group => group.els[0] === p.el)
          if (drag.from < 0) { preview?.remove(); restoreHidden(drag); return }
          drag.self = drag.groups[drag.from]
          drag.height = drag.self.bottom - drag.self.top + 2
        } else {
          drag.rows = items.filter(item => item.el !== p.el)
          drag.from = p.kind === 'tile' ? -1 : items.findIndex(item => item.el === p.el)
          drag.height = rect.height + 2
        }
        state.current = drag
        if (before && hidden.length) {
          for (const item of items) {
            if (item.el === p.el || !item.el.getClientRects().length) continue
            const dy = before.get(item.el) - item.el.getBoundingClientRect().top
            if (Math.abs(dy) > .5) {
              const animation = item.el.animate?.([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 200, easing: 'cubic-bezier(.32,.72,0,1)' })
              if (animation) drag.animations.push(animation)
            }
          }
        }
        swallowClick = true
        try { p.el.setPointerCapture?.(p.pointer) } catch { /* the pointer is gone */ }
        p.el.setAttribute('data-lifted', '')
        list.setAttribute('data-sorting', p.kind)
        navigator.vibrate?.(8)
        follow()
      } catch (error) {
        preview?.remove()
        if (state.current?.el === p.el) settle(state.current)
        else restoreHidden({ hidden })
        swallowClick = false
        actions.reportError?.(error, 'sidebar')
      }
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
      saveStyle(drag, drag.el)
      drag.el.style.transform = `translateY(${dy}px)`
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

    function saveStyle(drag, el) {
      if (!drag.styles.has(el)) drag.styles.set(el, { transform: el.style.getPropertyValue('transform'), priority: el.style.getPropertyPriority('transform') })
    }

    function restoreHidden(drag) {
      for (const { el, value, priority } of drag.hidden) {
        if (value) el.style.setProperty('display', value, priority)
        else el.style.removeProperty('display')
        if (el.isConnected && !reducedMotion()) el.animate?.([{ opacity: 0, translate: '0 -8px' }, { opacity: 1, translate: '0 0' }], { duration: 200, easing: 'cubic-bezier(.32,.72,0,1)' })
      }
      drag.hidden = []
    }

    function settle(drag, bounce = false) {
      if (drag.finished) return
      drag.finished = true
      for (const animation of drag.animations) animation.cancel()
      for (const [el, style] of drag.styles) {
        if (style.transform) el.style.setProperty('transform', style.transform, style.priority)
        else el.style.removeProperty('transform')
      }
      drag.el.removeAttribute('data-lifted')
      restoreHidden(drag)
      // The members are back before the overlay goes. It goes on a later frame: taking a
      // covering layer away in the same frame as the change under it makes the browser
      // present the strip it covered for a frame, which reads as a flash.
      const preview = drag.preview
      if (preview) setTimeout(() => preview.remove(), 350)
      list.removeAttribute('data-sorting')
      drag.tiles?.removeAttribute('data-drop')
      if (state.current === drag) state.current = null
      if (bounce && drag.el.isConnected && !reducedMotion()) {
        drag.el.animate?.([{ scale: '1.02' }, { scale: '.992', offset: .6 }, { scale: '1' }], { duration: 200, easing: 'ease-out' })
      }
    }

    function step(el, shift) {
      const drag = state.current
      if (shift === 0) {
        if (drag.moved.has(el)) {
          const style = drag.styles.get(el)
          if (style.transform) el.style.setProperty('transform', style.transform, style.priority)
          else el.style.removeProperty('transform')
          drag.moved.delete(el)
        }
        return
      }
      saveStyle(drag, el)
      el.style.transform = `translateY(${shift}px)`
      drag.moved.add(el)
    }

    // Where it lands: a row's section and its new order there, a tile unpinned into the
    // list, a row pinned, or a section's new place.
    async function land() {
      const drag = state.current
      list.removeAttribute('data-sorting')
      drag.tiles?.removeAttribute('data-drop')
      // Where every row is drawn now, so the list glides from there into its new order.
      const seen = new Map()
      for (const el of list.querySelectorAll(`${ROWS},.bt-sec,.bt-tile[data-bot-id]`)) {
        if (el.getClientRects().length === 0) continue
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
      if (change === null) {
        if (!reducedMotion()) {
          for (const [el, style] of drag.styles) {
            el.animate?.([{ transform: el.style.transform || 'none' }, { transform: style.transform || 'none' }], { duration: 200, easing: 'cubic-bezier(.32,.72,0,1)' })
          }
        }
        settle(drag, true)
        return
      }
      drag.seen = seen
      try {
        onLand?.(seen, () => settle(drag, true))
        await change()
      } catch (error) {
        seen.clear()
        settle(drag)
        actions.reportError?.(error, 'sidebar')
      } finally {
        // A no-op or rejected update may never trigger the layout handoff.
        setTimeout(() => { if (!drag.finished) { seen.clear(); settle(drag, true) } }, 400)
      }
    }

    const onPointerUp = (event) => {
      if (pending?.pointer === event.pointerId) cancelPending()
      const drag = state.current
      if (!drag || drag.landing || event.pointerId !== drag.pointer) return
      drag.landing = true
      // The click that follows a drop is the drop's, not a click; one that never comes
      // must not eat the next real one.
      clearTimeout(clickTimer)
      clickTimer = setTimeout(() => { swallowClick = false }, 0)
      void land().catch(error => {
        drag.seen?.clear()
        settle(drag)
        actions.reportError?.(error, 'sidebar')
      })
    }
    const onClick = (event) => {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    const onKey = (event) => {
      if (event.key !== 'Escape' || !state.current) return
      state.current.seen?.clear()
      settle(state.current)
      swallowClick = false
    }
    const onPointerCancel = (event) => {
      if (pending?.pointer === event.pointerId) cancelPending()
      if (state.current?.pointer !== event.pointerId) return
      state.current.seen?.clear()
      settle(state.current)
      swallowClick = false
    }
    const onContextMenu = (event) => { if (state.current) event.preventDefault() }

    list.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    list.addEventListener('click', onClick, true)
    list.addEventListener('contextmenu', onContextMenu, true)
    window.addEventListener('keydown', onKey)
    return () => {
      cancelPending()
      clearTimeout(clickTimer)
      if (state.current) { state.current.seen?.clear(); settle(state.current) }
      list.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      list.removeEventListener('click', onClick, true)
      list.removeEventListener('contextmenu', onContextMenu, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled])
}

export const DRAG_SORT_CSS = `
.bt-list[data-sorting] :is(.bt-row,.bt-sec,.bt-tile){transition:transform .2s cubic-bezier(.32,.72,0,1),scale .2s cubic-bezier(.32,.72,0,1),box-shadow .2s ease}
.bt-list[data-sorting] [data-lifted]{transition:none;position:relative;z-index:5}
.bt-list[data-sorting] .bt-row[data-lifted],.bt-list[data-sorting] .bt-tile[data-lifted]{background:var(--bt-card);box-shadow:0 6px 18px color-mix(in srgb,var(--bt-ink) 16%,transparent),0 0 0 .5px var(--bt-line-2);scale:1.02}
.bt-list[data-sorting] .bt-sec[data-lifted]{background:var(--bt-sidebar);border-radius:8px;box-shadow:0 6px 18px color-mix(in srgb,var(--bt-ink) 14%,transparent)}
.bt-list[data-sorting] .bt-row[data-lifted][data-bot-id] ~ *{pointer-events:none}
.bt-list[data-sorting]{cursor:grabbing;user-select:none}
.bt-tiles[data-drop]{border-radius:12px;background:color-mix(in srgb,var(--bt-accent) 8%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--bt-accent) 40%,transparent)}
@media (prefers-reduced-motion:reduce){.bt-list[data-sorting] :is(.bt-row,.bt-sec,.bt-tile){transition:none}}
`
