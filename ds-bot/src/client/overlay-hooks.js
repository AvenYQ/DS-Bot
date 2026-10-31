import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RAIL_WIDTH } from './frame-layout.js'

// -------------------------------------------------------------------------
// Overlays: new chat, bot exchange, details drawer, context menu

// Escape closes only the newest open layer, so a dialog over the details pane does
// not take the pane down with it.
const escapeLayers = []
const onEscapeKey = (event) => { if (event.key === 'Escape') escapeLayers.at(-1)?.current() }
export function useEscape(onClose) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (escapeLayers.length === 0) window.addEventListener('keydown', onEscapeKey)
    escapeLayers.push(ref)
    return () => {
      escapeLayers.splice(escapeLayers.indexOf(ref), 1)
      if (escapeLayers.length === 0) window.removeEventListener('keydown', onEscapeKey)
    }
  }, [])
}

// New chat and Bot exchanges show in place of the conversation, right of the sidebar.
// The sidebar is ours; the shell's own column stays collapsed underneath it, so measuring
// the shell column put these panes over our sidebar and under the window's buttons.
// Measure our column, and follow it while it slides, is resized or changes state.
export function usePaneLeft() {
  const [paneLeft, setPaneLeft] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const own = document.querySelector('.bt-leftcol')
      if (own === null) {
        const column = document.querySelector('[class*="_footArea"]')?.parentElement
        setPaneLeft(column ? Math.round(column.getBoundingClientRect().right) : 0)
        return
      }
      const state = own.getAttribute('data-left')
      // A drawer floats over the rail's place, so the conversation keeps the rail's room.
      setPaneLeft(state === 'hidden' ? 0 : state === 'drawer' ? RAIL_WIDTH : Math.round(own.getBoundingClientRect().right))
    }
    measure()
    const own = document.querySelector('.bt-leftcol')
    // The test DOM has no ResizeObserver; there the first measurement stands.
    const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    const restated = typeof MutationObserver === 'function' ? new MutationObserver(measure) : null
    if (own !== null) {
      sized?.observe(own)
      restated?.observe(own, { attributes: true, attributeFilter: ['data-left', 'style'] })
    }
    window.addEventListener('resize', measure)
    return () => {
      sized?.disconnect()
      restated?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return paneLeft
}
