import { createElement as h } from 'react'

// The app icon's cinnabar seal, drawn as a speech bubble: the court board's mark. The
// mono version is the same outline in ink, for the rail where every icon is ink-coloured.
export function SealIcon({ size = 20, mono = false, small = false }) {
  const body = 'M290 232 H734 Q792 232 792 290 V650 Q792 708 734 708 H420 L312 800 L340 708 H290 Q232 708 232 650 V290 Q232 232 290 232Z'
  const frame = 'M352 306 H672 Q700 306 700 334 V582 Q700 610 672 610 H352 Q324 610 324 582 V334 Q324 306 352 306Z'
  return h('svg', {
    width: size, height: size, viewBox: '0 0 1024 1024', 'aria-hidden': true,
    className: `bt-cb-seal${mono ? ' bt-cb-seal-mono' : ''}${small ? ' bt-cb-seal-small' : ''}`,
  },
  h('g', { transform: 'rotate(-6 512 512)' },
    h('path', { d: body, className: 'bt-cb-seal-body' }),
    h('path', { d: frame, className: 'bt-cb-seal-frame' }),
    h('path', { d: 'M366 470 Q512 386 658 470', className: 'bt-cb-seal-eave' }),
    h('circle', { cx: 436, cy: 552, r: 26, className: 'bt-cb-seal-dot' }),
    h('circle', { cx: 512, cy: 566, r: 26, className: 'bt-cb-seal-dot' }),
    h('circle', { cx: 588, cy: 552, r: 26, className: 'bt-cb-seal-dot' })))
}
