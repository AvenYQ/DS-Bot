// Diagnosis: records how the conversation's transcript moves while a reply arrives, and
// hands the record to the host (home/scroll-traces) a moment after the turn ends.
import { call } from './api.js'

export function installScrollTrace() {
  let samples = []
  let events = []
  let frame = 0
  let started = 0
  let wasRunning = false
  let sendTimer = 0
  const describe = node => (node.nodeType === 1 ? `${node.tagName.toLowerCase()}.${String(node.className?.baseVal ?? node.className ?? '').split(' ').slice(0, 2).join('.')}`.slice(0, 60) : '#text')
  const watch = new MutationObserver((list) => {
    if (!started) return
    const t = Math.round(performance.now() - started)
    for (const m of list) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) if (n.nodeType === 1) events.push([t, '+', describe(n), Math.round(n.getBoundingClientRect?.().height ?? 0)])
        for (const n of m.removedNodes) if (n.nodeType === 1) events.push([t, '-', describe(n)])
      } else if (m.type === 'attributes') {
        events.push([t, '@', describe(m.target), m.attributeName])
      }
    }
    if (events.length > 6000) events = events.slice(-6000)
  })
  const sample = (when) => {
    const scroller = document.querySelector('[data-conversation-scroll]')
    if (!scroller) return
    const flow = scroller.querySelector('[data-chat-flow]')
    const bubbles = scroller.querySelectorAll('.bt-bubble')
    const last = bubbles[bubbles.length - 1]
    const prev = bubbles[bubbles.length - 2]
    const typing = document.querySelector('.bt-typing')
    samples.push([Math.round(performance.now() - started), when, Math.round(scroller.scrollTop), scroller.scrollHeight, scroller.clientHeight,
      flow?.style.minHeight ?? '', flow ? getComputedStyle(flow).transform : '',
      last ? Math.round(last.getBoundingClientRect().bottom * 10) / 10 : null, prev ? Math.round(prev.getBoundingClientRect().top * 10) / 10 : null,
      typing ? Math.round(typing.getBoundingClientRect().height) : 0])
    if (samples.length > 12000) samples = samples.slice(-12000)
  }
  const tick = () => {
    const running = document.documentElement.hasAttribute('data-bt-running')
    if (running && !wasRunning) {
      clearTimeout(sendTimer)
      samples = []
      events = []
      started = performance.now()
      const scroller = document.querySelector('[data-conversation-scroll]')
      if (scroller) watch.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-exiting'] })
    }
    if (!running && wasRunning) {
      sendTimer = setTimeout(() => {
        watch.disconnect()
        const trace = { samples, events, ua: navigator.userAgent }
        started = 0
        call('scroll-trace', { trace }).catch(() => {})
      }, 2500)
    }
    wasRunning = running
    if (started) {
      sample('raf')
      setTimeout(() => sample('post'), 0)
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => { cancelAnimationFrame(frame); clearTimeout(sendTimer); watch.disconnect() }
}
