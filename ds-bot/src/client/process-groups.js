// The transcript's rhythm, as in Grok Bot: one speaker's bubbles sit close (4px), and every
// change of speaker gets the same wider breath (14px). The shell's own margins cannot give
// it: a turn holds items the Bot view draws nothing for (thinking, tool calls; tools show as
// the reply's own line, thinking as the activity row), so what sits "before" a reply in the
// markup is often nothing on screen.
//
// So here, in the mutation's own microtask (before the frame is drawn):
// - a process group whose every item is empty is marked data-bt-empty and takes no room
//   (its empty frame kept 36px and a margin: it pushed the conversation up while the Bot
//   worked and left a wide gap under the user's message);
// - every shown item is marked data-bt-gap="turn" when it starts a new speaker's turn and
//   "same" when the same speaker goes on; styles.js spaces the two.
const EMPTY_ITEM = '[class*="_flowItem"]:has(> [data-slot="conversation.chat.node"]:empty)'
const USER_KINDS = new Set(['user', 'question-reply', 'command-input'])
const SILENT_KINDS = new Set(['turn-tail'])

export const isEmptyItem = item => item.matches(EMPTY_ITEM)
export const isEmptyGroup = group => [...group.querySelectorAll('[data-chat-flow-kind]')].every(isEmptyItem)

// The flow's units in order: items outside any process group, and the groups themselves.
function units(flow) {
  return [...flow.querySelectorAll('[data-chat-flow-kind], [data-step-process]')]
    .filter(node => node.hasAttribute('data-step-process') || node.parentElement?.closest('[data-step-process]') === null)
}

export function markRhythm(flow) {
  let speaker = null
  for (const unit of units(flow)) {
    let shown
    let who
    if (unit.hasAttribute('data-step-process')) {
      const empty = isEmptyGroup(unit)
      if (empty !== unit.hasAttribute('data-bt-empty')) unit.toggleAttribute('data-bt-empty', empty)
      shown = !empty
      who = 'bot'
    } else {
      const kind = unit.getAttribute('data-chat-flow-kind')
      if (SILENT_KINDS.has(kind)) continue
      shown = !isEmptyItem(unit)
      who = USER_KINDS.has(kind) ? 'user' : 'bot'
    }
    if (!shown) continue
    const gap = speaker === null || speaker !== who ? 'turn' : 'same'
    if (unit.getAttribute('data-bt-gap') !== gap) unit.setAttribute('data-bt-gap', gap)
    speaker = who
  }
}

export function installProcessGroups(root = document.body) {
  const mark = () => { for (const flow of root.querySelectorAll('[data-chat-flow]')) markRhythm(flow) }
  const watch = new MutationObserver(mark)
  watch.observe(root, { childList: true, subtree: true })
  mark()
  return () => watch.disconnect()
}
