// Sidebar sections: the user files Bots and group chats under named headings, by
// project, client or anything else. An entry keeps its section's name in `section`;
// `state.sections` keeps the headings in the user's order, with whether each is
// folded, so every device shows the same sidebar. A section with no entries stays
// until it is deleted, so it can be filled again.
import { defineTool } from '@deepseek-ai/dsh-tools'
import { output } from './tools.js'

export const SECTION_NAME_MAX = 24
const SECTIONS_MAX = 50

export const cleanSectionName = name => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, SECTION_NAME_MAX)
const same = (a, b) => a.toLocaleLowerCase() === b.toLocaleLowerCase()

export function install(rt) {
  const { state } = rt
  const list = () => {
    if (!Array.isArray(state.sections)) state.sections = []
    return state.sections
  }
  const find = name => list().find(section => same(section.name, name))
  const entries = () => [...Object.values(state.bots ?? {}), ...Object.values(state.rooms ?? {})]
  const writable = () => {
    const readOnly = rt.readOnly?.()
    if (readOnly !== undefined) throw new Error(readOnly)
  }

  // Makes the section when it is new, and gives back its name as the list spells it.
  const ensure = (name) => {
    const clean = cleanSectionName(name)
    if (clean === '') throw new Error('Give the section a name.')
    const known = find(clean)
    if (known) return known.name
    if (list().length >= SECTIONS_MAX) throw new Error(`The sidebar holds at most ${SECTIONS_MAX} sections.`)
    list().push({ name: clean })
    return clean
  }

  // '' or null takes the entry out of every section.
  async function setSection(id, name) {
    writable()
    const entry = rt.botOf(id) ?? rt.roomOf(id)
    if (entry === undefined) throw new Error('Unknown conversation')
    if (name === null || cleanSectionName(name) === '') delete entry.section
    else entry.section = ensure(name)
    await rt.save()
    return entry
  }

  async function createSection(name) {
    writable()
    const clean = ensure(name)
    await rt.save()
    return clean
  }

  async function renameSection(from, to) {
    writable()
    const section = find(cleanSectionName(from))
    if (section === undefined) throw new Error(`There is no section named ${from}.`)
    const next = cleanSectionName(to)
    if (next === '') throw new Error('Give the section a name.')
    const clash = find(next)
    if (clash && clash !== section) throw new Error(`A section named ${next} already exists.`)
    for (const entry of entries()) if (entry.section !== undefined && same(entry.section, section.name)) entry.section = next
    section.name = next
    await rt.save()
    return next
  }

  // The section goes; its Bots and group chats stay, out of any section.
  async function deleteSection(name) {
    writable()
    const section = find(cleanSectionName(name))
    if (section === undefined) return false
    for (const entry of entries()) if (entry.section !== undefined && same(entry.section, section.name)) delete entry.section
    state.sections = list().filter(item => item !== section)
    await rt.save()
    return true
  }

  // `to` is the index the section moves to, or `collapsed` folds it or opens it.
  async function arrangeSection(name, { to, collapsed } = {}) {
    writable()
    const section = find(cleanSectionName(name))
    if (section === undefined) throw new Error(`There is no section named ${name}.`)
    if (typeof collapsed === 'boolean') {
      if (collapsed) section.collapsed = true
      else delete section.collapsed
    }
    if (Number.isInteger(to)) {
      const rest = list().filter(item => item !== section)
      rest.splice(Math.max(0, Math.min(rest.length, to)), 0, section)
      state.sections = rest
    }
    await rt.save()
    return section
  }

  // The user dragged rows: `ids` is the section's rows in their new order, and each joins
  // the section (`section` '' or null: no section) at its place. The order sticks until
  // the next drag; rows never arranged follow, newest activity first.
  async function arrangeEntries(section, ids) {
    writable()
    const name = section === null || cleanSectionName(section) === '' ? undefined : ensure(section)
    const list = Array.isArray(ids) ? ids.map(String) : []
    list.forEach((id, rank) => {
      const entry = rt.botOf(id) ?? rt.roomOf(id)
      if (entry === undefined) return
      if (name === undefined) delete entry.section
      else entry.section = name
      entry.rank = rank
    })
    await rt.save()
  }

  // The headings in order: an entry that names a section the list lost (a hand-edited
  // state.json, an older copy) still gets its heading, after the others.
  const sectionsView = () => {
    const known = list().map(section => ({ name: section.name, ...(section.collapsed ? { collapsed: true } : {}) }))
    for (const entry of entries()) {
      if (typeof entry.section === 'string' && entry.section !== '' && !known.some(section => same(section.name, entry.section))) known.push({ name: entry.section })
    }
    return known
  }

  // A Main Bot can file Bots and group chats for the user, as the sidebar menu does.
  rt.ctx.tools.register(defineTool({
    name: 'set_section',
    description: 'File Bots or group chats under a section of the user\'s sidebar (by project, client or anything else), or take them out of their section. Only a Main Bot can use it.',
    parameters: {
      names: { type: 'string', description: 'Names of the Bots or group chats, separated by commas' },
      section: { type: 'string', description: `Section name, up to ${SECTION_NAME_MAX} characters; a new name makes the section. An empty string takes them out of any section.` },
    },
    output,
    async execute(args, exec) {
      await rt.load()
      const self = rt.selfOf(exec.agent?.id)
      if (rt.botOf(self) === undefined || !rt.isMain(self)) return 'Only a Main Bot can arrange the sidebar. Ask a Main Bot with message_bot.'
      const names = String(args.names ?? '').split(/[,，、]/).map(name => name.trim()).filter(Boolean)
      if (names.length === 0) return 'Name at least one Bot or group chat.'
      const section = cleanSectionName(args.section)
      const done = []
      const problems = []
      for (const name of names) {
        const bot = rt.findBot(name)
        const rooms = bot ? [] : rt.findRooms(name)
        if (!bot && rooms.length > 1) { problems.push(`More than one group chat is called ${name}.`); continue }
        const entry = bot ?? rooms[0]
        if (entry === undefined) { problems.push(`No Bot or group chat named ${name}.`); continue }
        try {
          await setSection(entry.id, section)
          done.push(entry.name)
        } catch (error) {
          problems.push(`${entry.name}: ${error?.message ?? error}`)
        }
      }
      const head = done.length === 0 ? '' : section === '' ? `Took ${done.join(', ')} out of their sections.` : `Filed ${done.join(', ')} under ${rt.sectionsView().find(item => same(item.name, section))?.name ?? section}.`
      return [head, ...problems].filter(Boolean).join(' ')
    },
  }))

  Object.assign(rt, { setSection, createSection, renameSection, deleteSection, arrangeSection, arrangeEntries, sectionsView })
}
