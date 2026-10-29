// Keeps a conversation that is read at its newest message there, without jolts.
//
// While the reader is at the bottom:
// - Growth (a new message, streamed text) sticks the view to the bottom in the same frame,
//   so the newest line never dips below and floats back.
// - Shrinking would drag the transcript down: at the bottom the scroll position is clamped,
//   so a typing row that leaves, or a reply the shell swaps for its final rendering (for a
//   moment shorter), pulls everything down and, when the content comes back, up again.
//   Here the transcript holds its height for a moment; content that comes back fills it with
//   no motion at all, and a real loss eases down once instead of jumping.
// - When the shell's own follow comes to rest a few pixels short (the transcript's bottom
//   padding), the view finishes the way down.
// Once the reader scrolls up themselves the view is left where they put it.
const NEAR = 24
const HOLD_MS = 180
const EASE_MS = 220

export function installTailKeeper() {
  let scroller = null
  let flow = null
  let atBottom = true
  let height = 0
  let userAt = 0
  let ours = 0
  let held = 0
  let holdTimer = 0
  let easing = 0
  const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  const gap = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
  const toBottom = () => {
    const short = gap()
    if (short > 1) {
      ours = Date.now()
      scroller.scrollTop += short
    }
  }

  const letGo = () => {
    clearTimeout(holdTimer)
    cancelAnimationFrame(easing)
    easing = 0
    held = 0
    if (flow) flow.style.minHeight = ''
  }
  // The held height comes down to what the content needs, the view kept at the bottom.
  const release = () => {
    if (!flow || !scroller) return letGo()
    // Measuring and easing move the scroll position; that is not the reader leaving.
    ours = Date.now()
    const from = held
    flow.style.minHeight = ''
    const to = flow.offsetHeight
    if (to >= from || still()) {
      letGo()
      toBottom()
      height = scroller.scrollHeight
      return undefined
    }
    flow.style.minHeight = `${from}px`
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / EASE_MS)
      const eased = 1 - (1 - t) ** 3
      flow.style.minHeight = `${from - (from - to) * eased}px`
      ours = Date.now()
      toBottom()
      if (t < 1 && atBottom) {
        easing = requestAnimationFrame(step)
      } else {
        letGo()
        height = scroller.scrollHeight
      }
    }
    easing = requestAnimationFrame(step)
    return undefined
  }

  const changed = () => {
    if (!scroller || easing) return
    const next = scroller.scrollHeight
    const delta = next - height
    height = next
    if (!atBottom || delta === 0) return
    if (delta < 0 && flow && !still()) {
      // Hold the height it had; the view stays exactly where it was.
      held = Math.max(held, flow.offsetHeight - delta)
      flow.style.minHeight = `${held}px`
      height = scroller.scrollHeight
      toBottom()
      clearTimeout(holdTimer)
      holdTimer = setTimeout(release, HOLD_MS)
      return
    }
    // Content that came back past what was held needs the hold no more.
    if (held && flow) {
      flow.style.minHeight = ''
      if (flow.offsetHeight >= held) letGo()
      else flow.style.minHeight = `${held}px`
      height = scroller.scrollHeight
    }
    toBottom()
  }
  const resize = new ResizeObserver(changed)

  let settle = 0
  const onScroll = () => {
    if (Date.now() - ours < 120 && Date.now() - userAt > 300) return
    if (easing && Date.now() - userAt > 300) return
    atBottom = gap() <= NEAR
    if (!atBottom && Date.now() - userAt < 300 && held) letGo()
    clearTimeout(settle)
    settle = setTimeout(() => {
      if (!scroller || Date.now() - userAt < 600 || !atBottom || easing) return
      toBottom()
    }, 160)
  }
  const onUser = () => { userAt = Date.now() }

  const attach = (next) => {
    const nextFlow = next?.querySelector('[data-chat-flow]') ?? null
    if (next === scroller && nextFlow === flow) return
    if (next !== scroller && scroller) {
      scroller.removeEventListener('scroll', onScroll)
      for (const name of ['wheel', 'touchstart', 'keydown', 'pointerdown']) scroller.removeEventListener(name, onUser)
    }
    letGo()
    resize.disconnect()
    if (next !== scroller && next) {
      next.addEventListener('scroll', onScroll, { passive: true })
      for (const name of ['wheel', 'touchstart', 'keydown', 'pointerdown']) next.addEventListener(name, onUser, { passive: true })
    }
    scroller = next
    flow = nextFlow
    if (!scroller) return
    for (const child of scroller.children) resize.observe(child)
    if (flow) {
      resize.observe(flow)
      for (const child of flow.children) resize.observe(child)
    }
    height = scroller.scrollHeight
    atBottom = gap() <= NEAR
  }
  const scan = () => attach(document.querySelector('[data-conversation-scroll]'))
  let pending = 0
  const watch = new MutationObserver(() => {
    if (pending) return
    pending = requestAnimationFrame(() => { pending = 0; scan() })
  })
  watch.observe(document.body, { childList: true, subtree: true })
  scan()
  return () => {
    clearTimeout(settle)
    cancelAnimationFrame(pending)
    watch.disconnect()
    attach(null)
  }
}
