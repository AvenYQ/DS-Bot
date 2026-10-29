// Keeps a conversation that is read at its newest message there, and makes the way it gets
// there smooth.
//
// While the reader is at the bottom, the shell sticks the view to it in one step whenever
// the transcript grows: a new bubble or a streamed line shoves everything up in a single
// frame, which reads as a jerk. Here the view still lands at the bottom at once, but the
// transcript is drawn where it was and eased into place, so each change glides up. Growth
// that the shell did not follow (the reply's final layout, a row added after the turn) is
// followed too, so a finished reply rests at the true bottom with its full margin under it.
// Once the reader scrolls up themselves the view is left where they put it.
const NEAR = 24
const EASE_MS = 90

export function installTailKeeper() {
  let scroller = null
  let flow = null
  let atBottom = true
  let height = 0
  let userAt = 0
  let ours = 0
  let offset = 0
  let frame = 0
  let last = 0
  const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  const gap = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight

  const paint = () => {
    if (flow) flow.style.translate = offset === 0 ? '' : `0 ${offset.toFixed(2)}px`
  }
  const tick = (now) => {
    const dt = last === 0 ? 16 : Math.min(64, now - last)
    last = now
    offset *= Math.exp(-dt / EASE_MS)
    if (Math.abs(offset) < 0.4) offset = 0
    paint()
    frame = offset === 0 ? 0 : requestAnimationFrame(tick)
    if (frame === 0) last = 0
  }
  const glide = (shift) => {
    if (still() || !flow || Math.abs(offset + shift) > scroller.clientHeight) { stop(); return }
    offset += shift
    paint()
    if (frame === 0) frame = requestAnimationFrame(tick)
  }
  function stop() {
    offset = 0
    paint()
    cancelAnimationFrame(frame)
    frame = 0
    last = 0
  }

  // Only a new row (the user's message, the typing row, a reply's next bubble) slides up
  // into place. Text streaming into a bubble that is already there must not: its bottom
  // would dip by a line and float back on every chunk. There the view sticks to the bottom
  // in the same frame, before anything is painted.
  let rows = 0
  const grew = () => {
    if (!scroller) return
    const next = scroller.scrollHeight
    const delta = next - height
    height = next
    const count = flow?.childElementCount ?? 0
    const added = count > rows
    rows = count
    if (!atBottom || delta === 0) return
    const short = gap()
    if (short > 1) {
      ours = Date.now()
      scroller.scrollTop += short
    }
    if (added && delta > 0) glide(Math.max(short, delta))
  }
  const resize = new ResizeObserver(grew)

  let settle = 0
  const onScroll = () => {
    if (Date.now() - ours < 120 && Date.now() - userAt > 300) return
    atBottom = gap() <= NEAR
    if (!atBottom && Date.now() - userAt < 300) stop()
    // The shell's own follow can come to rest a few pixels short (the transcript's bottom
    // padding); when nobody scrolled, the view finishes the way down.
    clearTimeout(settle)
    settle = setTimeout(() => {
      if (!scroller || Date.now() - userAt < 600 || !atBottom) return
      const short = gap()
      if (short <= 1) return
      ours = Date.now()
      scroller.scrollTop += short
      glide(short)
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
    stop()
    resize.disconnect()
    if (next !== scroller && next) {
      next.addEventListener('scroll', onScroll, { passive: true })
      for (const name of ['wheel', 'touchstart', 'keydown', 'pointerdown']) next.addEventListener(name, onUser, { passive: true })
    }
    scroller = next
    flow = nextFlow
    if (!scroller) return
    for (const child of scroller.children) resize.observe(child)
    if (flow) resize.observe(flow)
    height = scroller.scrollHeight
    rows = flow?.childElementCount ?? 0
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
