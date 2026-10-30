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
//   A transcript that got shorter because it got wider (a side panel closed, the column
//   folded, the window grew) is no such moment: it is not held, the view just stays at the
//   bottom.
// - When the shell's own follow comes to rest a few pixels short (the transcript's bottom
//   padding), the view finishes the way down.
// Once the reader scrolls up themselves the view is left where they put it.
const NEAR = 24
// A held height waits for the transcript to go quiet: while a reply is still arriving its
// text fills the room the typing row left, so nothing has to move at all.
const QUIET_MS = 500
const EASE_MS = 360
const running = () => document.documentElement.hasAttribute('data-bt-running')

export function installTailKeeper() {
  let scroller = null
  let flow = null
  let atBottom = true
  let height = 0
  let width = 0
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
    // While the reply is still coming, its text will fill the room: keep waiting.
    if (running()) {
      holdTimer = setTimeout(release, QUIET_MS)
      return undefined
    }
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
    if (held) {
      clearTimeout(holdTimer)
      holdTimer = setTimeout(release, QUIET_MS)
    }
    const next = scroller.scrollHeight
    const delta = next - height
    height = next
    const wide = flow ? flow.clientWidth : 0
    if (wide !== width) {
      width = wide
      if (held) letGo()
      height = scroller.scrollHeight
      if (atBottom) toBottom()
      return
    }
    if (!atBottom || delta === 0) return
    if (delta < 0 && flow && !still()) {
      // Hold the height it had; the view stays exactly where it was.
      held = Math.max(held, flow.offsetHeight - delta)
      flow.style.minHeight = `${held}px`
      height = scroller.scrollHeight
      toBottom()
      clearTimeout(holdTimer)
      holdTimer = setTimeout(release, QUIET_MS)
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
  // The browser's scroll anchoring keeps some message in the middle still when content
  // around it changes, which at the end of a turn nudged a pinned view a few pixels up (and
  // the follow pulled it back down: the sink and bounce). While the view is pinned to the
  // bottom, anchoring is off, so the bottom is what stays put.
  const anchor = () => { if (scroller) scroller.style.overflowAnchor = atBottom ? 'none' : '' }
  const onScroll = () => {
    if (Date.now() - ours < 120 && Date.now() - userAt > 300) return
    if (easing && Date.now() - userAt > 300) return
    const was = atBottom
    atBottom = gap() <= NEAR
    // Nudged a little without the reader: back to the bottom now, before the frame is
    // drawn. A long move (a jump to an earlier message) is left alone.
    if (was && Date.now() - userAt > 300 && gap() > 1 && gap() <= NEAR * 2) {
      atBottom = true
      toBottom()
    }
    anchor()
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
    width = flow ? flow.clientWidth : 0
    atBottom = gap() <= NEAR
    anchor()
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
