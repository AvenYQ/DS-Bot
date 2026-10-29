import { createElement as h } from 'react'
import { CheckIcon, XIcon, EyeIcon } from './icons.js'
export { StampIcon } from './icons.js'
import { t } from './i18n.js'

// 朱批: a verdict on a Bot's message answers it in the user's name. The verdict shows
// under the bubble (kept with the reactions, as "seal:<kind>"), and a message goes to the
// chat that names the start of what was answered, so the Bot knows what was approved or
// rejected. It is drawn in the app's own quiet style: icon, short word, tinted chip.
export const SEALS = [
  { kind: '准', say: '准奏，照此办理。', done: 'Approved', tone: 'yes', Icon: CheckIcon },
  { kind: '驳回', say: '驳回，请重新拟办。', because: '驳回。理由：', done: 'Rejected', tone: 'no', reason: true, Icon: XIcon },
  { kind: '知道了', say: '知道了，不必回复。', done: 'Noted', tone: 'noted', Icon: EyeIcon },
]
export const SEAL_PREFIX = 'seal:'
const QUOTE_MAX = 60
const sealOf = kind => SEALS.find(seal => seal.kind === kind)

// The words sent in the user's name: plain sentences that read well wherever the message
// is drawn, and that tell the Bot which of its messages they answer.
export function sealMessage(kind, excerpt, reason = '') {
  const seal = sealOf(kind)
  const why = reason.replace(/\s+/g, ' ').trim()
  const head = why !== '' && seal.because ? `${seal.because}${why.replace(/[。.!！]$/u, '')}。` : seal.say
  const flat = excerpt.replace(/\s+/g, ' ').trim()
  const quote = flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX)}…` : flat
  return quote ? `${head}\n（批复：${quote}）` : head
}

// The chip under a Bot's bubble once it has a verdict.
export function Verdict({ kind, fresh }) {
  const seal = sealOf(kind)
  if (seal === undefined) return null
  return h('span', { className: 'bt-verdict', 'data-tone': seal.tone, 'data-fresh': fresh || undefined }, h(seal.Icon), t(seal.done))
}

// A choice in the picker.
export function VerdictChoice({ seal }) {
  return h('span', { className: 'bt-verdict-choice', 'data-tone': seal.tone }, h(seal.Icon), seal.kind)
}
