// What this fork adds to the sidebar sections (roster.js holds the sections themselves):
// rows the user dragged into an order keep that order, and teams filed under this fork's
// earlier sections, which went by name, are carried over to sections with ids.
import { createHash } from 'node:crypto'
import { SECTION_NAME_MAX } from './constants.js'

const legacyId = name => `sec-${createHash('sha1').update(name.toLocaleLowerCase()).digest('hex').slice(0, 8)}`

// The earlier sections were `{ name, collapsed? }`, and an entry named its section in
// `section`. Each becomes `{ id, name, collapsed? }` with `sectionId` on its entries, in
// place, before the store checks the sections. Ids come from the name, so a second run,
// or another device with the same team, lands on the same ids. True when anything changed.
export function migrateLegacySections(state) {
  if (state === null || typeof state !== 'object') return false
  const entries = [...Object.values(state.bots ?? {}), ...Object.values(state.rooms ?? {}), ...Object.values(state.agents ?? {})]
  const legacy = (Array.isArray(state.sections) ? state.sections : []).some(sec => sec && typeof sec === 'object' && typeof sec.id !== 'string')
  const named = entries.some(entry => typeof entry?.section === 'string')
  if (!legacy && !named) return false
  const list = Array.isArray(state.sections) ? state.sections.filter(sec => sec && typeof sec === 'object' && typeof sec.name === 'string' && sec.name.trim() !== '') : []
  const byName = new Map()
  for (const sec of list) {
    if (typeof sec.id !== 'string' || sec.id === '') sec.id = legacyId(sec.name.trim())
    byName.set(sec.name.trim().toLocaleLowerCase(), sec)
  }
  for (const entry of entries) {
    if (typeof entry?.section !== 'string') continue
    const name = entry.section.replace(/\s+/g, ' ').trim().slice(0, SECTION_NAME_MAX)
    delete entry.section
    if (name === '' || typeof entry.sectionId === 'string') continue
    let sec = byName.get(name.toLocaleLowerCase())
    if (sec === undefined) {
      sec = { id: legacyId(name), name }
      list.push(sec)
      byName.set(name.toLocaleLowerCase(), sec)
    }
    entry.sectionId = sec.id
  }
  state.sections = list
  return true
}

export function install(rt) {
  const { state } = rt
  const writable = () => {
    const readOnly = rt.readOnly?.()
    if (readOnly !== undefined) throw new Error(readOnly)
  }

  // The user dragged rows: `ids` is a section's rows in their new order (`sectionId`
  // null: the rows in no section), and each joins that section at its place. The order
  // sticks until the next drag; rows never arranged follow, newest activity first.
  async function arrangeEntries(sectionId, ids) {
    writable()
    const target = sectionId === null || sectionId === '' ? undefined : (state.sections ?? []).find(sec => sec.id === sectionId)
    if (sectionId !== null && sectionId !== '' && target === undefined) throw new Error('Unknown section')
    const list = Array.isArray(ids) ? ids.map(String) : []
    list.forEach((id, rank) => {
      const entry = rt.botOf(id) ?? rt.roomOf(id)
      if (entry === undefined) return
      // The first Main Bot stays out of every section, as roster.js keeps it.
      if (target === undefined || id === state.mainBotIds?.[0]) delete entry.sectionId
      else entry.sectionId = target.id
      entry.rank = rank
    })
    await rt.save()
  }

  Object.assign(rt, { arrangeEntries })
}
