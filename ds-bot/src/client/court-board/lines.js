// What an official says when the 皇上 clicks him, the words in the three 衙门 eggs, and the
// card that asks before a 折子 is sent. Chinese throughout: the 值房's speech bubbles are
// part of the court, not chrome that follows the interface language.
//
// A greeting may carry {task}, the one line of the errand the official is on (from
// bridge.js's readDuty). With no errand to name, greetingOf skips those lines rather than
// printing a bare {task}.
//
// The bubble these land in is drawn at 13px or larger, in the interface's own face, never
// a thin or light cut (Aven's rule; play.js owns the bubble's styles).

const fill = (text, params) => text.replace(/\{(\w+)\}/g,
  (match, name) => (name in params ? String(params[name]) : match))

// How much of an errand the bubble can carry. `{task}` is meant as a short verb phrase
// ("把瓦垄改圆", or readDuty's own "在改 render 接口"): the lines put it inside a sentence, so
// a trailing full stop is dropped and a long one is cut.
export const TASK_MAX = 14
const taskWord = (task) => {
  const plain = String(task ?? '').trim().replace(/[。！？；;.!?]+$/, '')
  return plain.length > TASK_MAX ? `${plain.slice(0, TASK_MAX)}…` : plain
}

/** The six states a greeting has its own lines for. */
export const STATES = ['work', 'pending', 'question', 'waiting', 'idle', 'sleep']

/** Six lines a state, so a clicked official does not say the same thing twice running. */
export const GREETINGS = {
  work: [
    '{task}，臣忙得笔尖冒火星儿。',
    '{task}这活儿，臣拿手。',
    '这就好、这就好，皇上稍等片刻。',
    '臣伏案呢，案头堆得比人还高。',
    '臣把手里这本办完，就举着折子来。',
    '皇上瞧，臣正忙，忙完立马回话。',
  ],
  pending: [
    '臣把折子举着呢，等皇上朱批。',
    '这一本卡在皇上这儿啦，点一下「准」就成。',
    '臣不敢动，等皇上点头。',
    '折子还热乎着，皇上要不要看看？',
    '臣在门口站着，等皇上批完这一本。',
    '{task}，就等皇上一个字。',
  ],
  question: [
    '臣有句话想问皇上，等您答一声。',
    '臣挠头呢，得皇上给个主意。',
    '这个问题臣琢磨半天了，等皇上示下。',
    '皇上，臣举着手呢，等您点一下。',
    '臣不敢瞎猜，等皇上定夺。',
    '{task}，臣得先问过皇上。',
  ],
  waiting: [
    '臣在等同僚回话，一会儿就有准信。',
    '臣已经托人问了，正等着呢。',
    '那边还没回，臣先候着。',
    '臣把茶沏好了，等同僚来对个话。',
    '臣等消息呢，到了立刻奏报。',
    '{task}这事，臣等对方一句话。',
  ],
  idle: [
    '臣候旨，随叫随到。',
    '皇上点哪儿，臣就去哪儿。',
    '臣这儿清闲，刚泡上茶。',
    '臣在值房坐着，等皇上吩咐。',
    '桌子擦干净了，就等新差事。',
    '歇手不歇心，臣候着呢。',
  ],
  sleep: [
    '夜深了，臣打个盹儿。',
    '嘘……臣在梦里批折子呢。',
    '臣眯一会儿，天亮接着办。',
    '宫里静下来了，臣也歇了。',
    '月亮都困了，皇上也早点睡。',
    '臣守着值房打盹，有事喊一声就醒。',
  ],
}

/**
 * The line one official says back, with his errand named if he has one.
 * @param {string} state work, pending, question, waiting, idle or sleep; anything else
 *   falls back to idle
 * @param {{task?: string, pick?: number}} [words] `task` is the errand in a few words;
 *   `pick` walks the list, so repeated clicks do not repeat the line
 * @returns {string}
 */
export function greetingOf(state, { task = '', pick = 0 } = {}) {
  const pool = GREETINGS[state] ?? GREETINGS.idle
  const errand = taskWord(task)
  const said = errand ? pool : pool.filter(line => !line.includes('{task}'))
  const at = Number.isFinite(pick) ? Math.abs(Math.trunc(pick)) % said.length : 0
  return fill(said[at], { task: errand })
}

/** The three 衙门 that open a small panel when their official is clicked. */
export const EGGS = {
  sitian: {
    title: '钦天监 · 观星',
    lines: [
      '北斗七星正亮，臣替皇上数了三遍，一颗没少。',
      '今夜无风无雨，宜早睡，宜做美梦。',
      '卦象：明日宜开工，忌熬夜。',
    ],
  },
  hanlin: {
    title: '翰林院 · 壁上新画',
    lines: [
      '苏轼新画了一幅《烟雨小朝廷》：山是墨的，瓦是金的。',
      '画角题着两行小字：「竹子要歪着长，才好看。」',
    ],
  },
  neiwufu: {
    title: '内承运库 · 本月账目',
    lines: [
      '进项：俸银如常。支出：宫灯添三盏，桂花糖两斤。',
      '范蠡说：账上还有余，皇上想添什么，臣去办。',
    ],
  },
}

/** How a 衙门 egg closes. */
export const EGG_CLOSE = '点一下收起来'

/**
 * The card that stands between a dragged 折子 and a real message. Both buttons are here:
 * the card itself must never send before the 皇上 picks 准奏.
 */
export const DISPATCH = {
  title: '请皇上过目',
  to: '发给：{name}',
  text: '差事：{text}',
  note: '点「准奏」才真的发出去；点「且慢」就收回，不惊动谁。',
  confirm: '准奏',
  cancel: '且慢',
}

/**
 * The card's words, filled in.
 * @param {{name?: string, text?: string}} to the official the 折子 goes to, and what it says
 * @returns {{title: string, to: string, text: string, note: string, confirm: string, cancel: string}}
 */
export function dispatchCopy({ name = '', text = '' } = {}) {
  return {
    title: DISPATCH.title,
    to: fill(DISPATCH.to, { name: name || '这位官员' }),
    text: fill(DISPATCH.text, { text }),
    note: DISPATCH.note,
    confirm: DISPATCH.confirm,
    cancel: DISPATCH.cancel,
  }
}
