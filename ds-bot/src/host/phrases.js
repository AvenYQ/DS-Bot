// A Bot's catchphrases: a few short lines of its own that the chat and the sidebar show
// while it works, in place of the shared status phrases. A Main Bot picks them to fit
// the Bot's job when it makes one, and the user can rewrite them in the Bot's settings.
export const PHRASES_MAX = 6
export const PHRASE_MAX = 16

// From a list, or from one line split at 、，,；; or new lines. Trailing dots and
// ellipses go, since the status line adds its own; repeats and empty pieces are dropped.
// An empty result means the Bot has none.
export function cleanPhrases(input) {
  const pieces = Array.isArray(input) ? input : String(input ?? '').split(/[\n、，,；;|]+/)
  const out = []
  for (const piece of pieces) {
    const phrase = String(piece ?? '').replace(/\s+/g, ' ').trim().replace(/[.。…·\s]+$/u, '').slice(0, PHRASE_MAX).trim()
    if (phrase !== '' && !out.includes(phrase)) out.push(phrase)
    if (out.length === PHRASES_MAX) break
  }
  return out
}

export const PHRASES_HINT = `Catchphrases (口头禅) shown while the Bot works, in place of "Thinking…": ${PHRASES_MAX} at most, each a few words in the user's language that fit its job and personality, separated by 、 or new lines (e.g. for a court-themed historian: 翻阅史册、考据中、容臣细查).`
