import { createElement as h } from 'react'
import { t } from './i18n.js'

// 朱批: when the user answers a Bot's message with nothing but a verdict ("准",
// "不同意", "知道了"), a seal is stamped askew on the tail of the message it answers.
// The words go to the Bot as an ordinary message; the seal is drawn from the transcript
// alone, so it shows the same on every device, and it is stamped with motion only for a
// reply sent while this window is open.
const VERDICTS = [
  { stamp: '准', tone: 'yes', label: 'Approved', words: ['准', '准了', '准奏', '照准', '批准', '同意', '可', '可以', '行'] },
  { stamp: '驳回', tone: 'no', label: 'Rejected', words: ['驳回', '不准', '不行', '否', '不同意', '不可以', '拒绝'] },
  { stamp: '已阅', tone: 'noted', label: 'Noted', words: ['知道了', '已阅', '阅', '收到', '好的'] },
]
const BY_WORD = new Map(VERDICTS.flatMap(verdict => verdict.words.map(word => [word, verdict])))

// The verdict a whole message gives, if it is nothing more than one of the words;
// spaces and punctuation around it do not count.
export function verdictOf(text) {
  const bare = String(text ?? '').replace(/[\s\p{P}\p{S}]/gu, '')
  return BY_WORD.get(bare)
}

const OPENED = Date.now()
const stamped = new Set()
// Whether the seal for `key` should land with motion: once, for a reply newer than this
// window.
export function freshStamp(key, time) {
  if (stamped.has(key)) return false
  stamped.add(key)
  return Number.isFinite(time) && time > OPENED
}

export function Stamp({ verdict, fresh }) {
  return h('span', { className: 'bt-stamp', 'data-tone': verdict.tone, 'data-len': verdict.stamp.length, 'data-fresh': fresh || undefined, role: 'img', 'aria-label': t(verdict.label) },
    h('span', { className: 'bt-stamp-text' }, verdict.stamp))
}
