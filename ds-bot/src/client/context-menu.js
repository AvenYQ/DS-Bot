import { createElement as h, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isMainOf, isPinned } from './sources.js'
import { currentPart } from './text.js'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon, CloseIcon, FolderIcon, GearIcon, PinIcon, UnreadIcon, PencilIcon, StarLineIcon, CopyIcon, HideIcon, TrashIcon, DuplicateIcon } from './icons.js'
import { useEscape } from './overlay-hooks.js'
import { useViewport, viewBottom } from './motion.js'
import { t } from './i18n.js'

export function ContextMenu({ menu, roster, actions, leaving = false }) {
  useEscape(() => actions.closeMenu())
  useEffect(() => {
    const onDown = (event) => { if (!(event.target instanceof Element) || !event.target.closest('.bt-menu')) actions.closeMenu() }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])
  const ref = useRef(null)
  const [place, setPlace] = useState({ left: menu.x, top: menu.y })
  // 'main', or 'sections' while the menu lists where to move the row.
  const [pane, setPane] = useState('main')
  const tick = useViewport()
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPlace({ left: Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(menu.y, viewBottom() - box.height - 8)) })
  }, [menu.x, menu.y, tick, pane])
  if (menu.kind === 'agent' || menu.kind === 'agent-session') return h(AgentMenu, { menu, roster, actions, leaving })
  if (menu.kind === 'section') return h(SectionMenu, { menu, roster, actions, leaving })
  const bot = roster.byId[menu.id]
  const room = roster.roomsById[menu.id]
  const entry = bot ?? room
  if (entry === undefined) return null
  const isMainBot = isMainOf(roster, menu.id)
  const pinnedNow = isPinned(roster, entry)
  const mainCount = (roster.mainBotIds ?? []).length
  const label = t('{name} actions', { name: bot?.name ?? room.name })
  if (pane === 'sections') {
    return h('div', { ref, className: 'bt-menu', role: 'menu', 'aria-label': label, style: place, 'data-leaving': leaving || undefined },
      h(SectionPicker, { entry, roster, actions }))
  }
  const groups = [
    [
      [pinnedNow ? t('Unpin') : t('Pin'), PinIcon, () => actions.setFlags(menu.id, { pinned: !pinnedNow })],
      [t('Mark as Unread'), UnreadIcon, () => actions.markUnread(menu.id)],
      [t('Move to section'), FolderIcon, () => setPane('sections'), false, true],
    ],
    [
      bot ? [t('Rename Bot'), PencilIcon, () => actions.renameBot(bot.id)] : null,
      bot ? [t('Edit Bot'), GearIcon, () => actions.openSettings('bots', bot.id)] : null,
      room ? [t('Group settings'), GearIcon, () => actions.openSettings('groups', room.id)] : null,
      room ? [t('Rename group'), PencilIcon, () => actions.renameBot(room.id)] : null,
      bot ? [t('Duplicate'), DuplicateIcon, async () => { const copy = await actions.duplicateBot(bot.id); actions.openSession(copy.id) }] : null,
      bot && !isMainBot ? [t('Make Main Bot'), StarLineIcon, () => actions.setMain(bot.id, true)] : null,
      bot && isMainBot && mainCount > 1 ? [t('Remove Main Bot role'), StarLineIcon, () => actions.setMain(bot.id, false)] : null,
    ],
    [[t('Copy conversation ID'), CopyIcon, () => navigator.clipboard?.writeText(bot ? currentPart(bot) : menu.id)]],
    [
      isMainBot ? null : [t('Hide from sidebar'), HideIcon, () => actions.setFlags(menu.id, { hidden: true })],
      isMainBot ? null : [room ? t('Delete group') : t('Delete'), TrashIcon, () => (bot ? actions.deleteBot(bot.id) : actions.deleteRoom(menu.id)), true],
    ],
  ].map(group => group.filter(Boolean)).filter(group => group.length > 0)
  return h('div', { ref, className: 'bt-menu', role: 'menu', 'aria-label': label, style: place, 'data-leaving': leaving || undefined },
    groups.map((group, index) => h(Fragment, { key: index },
      index > 0 ? h('div', { className: 'bt-menu-sep', role: 'separator' }) : null,
      group.map(([text, Icon, run, danger, stays]) => h('button', {
        key: text, type: 'button', role: 'menuitem', className: danger ? 'bt-danger' : undefined, 'aria-haspopup': stays ? 'menu' : undefined,
        onClick: () => {
          // An entry that opens another pane keeps the menu open.
          if (stays) { run(); return }
          actions.closeMenu()
          void Promise.resolve(run()).catch(error => actions.reportError(error, 'menu'))
        },
      }, h(Icon), text, stays ? h('span', { style: { marginLeft: 'auto', display: 'inline-flex' } }, h(ChevronRightIcon)) : null)))))
}

const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLocaleLowerCase() === b.toLocaleLowerCase()

// Where a Bot or group chat can go: a section that exists, a new one, or none.
function SectionPicker({ entry, roster, actions }) {
  const [draft, setDraft] = useState('')
  const move = (section) => {
    actions.closeMenu()
    void Promise.resolve(actions.setSection(entry.id, section)).catch(error => actions.reportError(error, 'menu'))
  }
  const sections = roster.sections ?? []
  return h(Fragment, null,
    h('div', { className: 'bt-menu-head' }, t('Move {name} to', { name: entry.name })),
    sections.map(section => h('button', { key: section.name, type: 'button', role: 'menuitemradio', 'aria-checked': sameName(entry.section, section.name), onClick: () => move(section.name) },
      h('span', { className: 'bt-menu-tick', 'aria-hidden': true }, sameName(entry.section, section.name) ? h(CheckIcon) : null), section.name)),
    sections.length > 0 ? h('div', { className: 'bt-menu-sep', role: 'separator' }) : null,
    h('form', { className: 'bt-menu-field', onSubmit: (event) => { event.preventDefault(); if (draft.trim() !== '') move(draft.trim()) } },
      h('input', { autoFocus: true, value: draft, maxLength: 24, placeholder: t('New section name, then Enter'), 'aria-label': t('New section'), onChange: event => setDraft(event.target.value) })),
    typeof entry.section === 'string' && entry.section !== '' ? h('button', { type: 'button', role: 'menuitem', onClick: () => move('') }, h(CloseIcon), t('Remove from section')) : null)
}

// A section heading's menu: fold, rename, move, delete. Deleting keeps its rows.
function SectionMenu({ menu, roster, actions, leaving }) {
  useEscape(() => actions.closeMenu())
  useEffect(() => {
    const onDown = (event) => { if (!(event.target instanceof Element) || !event.target.closest('.bt-menu')) actions.closeMenu() }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])
  const ref = useRef(null)
  const [place, setPlace] = useState({ left: menu.x, top: menu.y })
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(menu.id)
  const tick = useViewport()
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPlace({ left: Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(menu.y, viewBottom() - box.height - 8)) })
  }, [menu.x, menu.y, tick, renaming])
  const sections = roster.sections ?? []
  const index = sections.findIndex(section => sameName(section.name, menu.id))
  const section = sections[index]
  if (section === undefined) return null
  const run = (work) => { actions.closeMenu(); void Promise.resolve(work()).catch(error => actions.reportError(error, 'menu')) }
  const members = [...roster.bots, ...roster.rooms].filter(item => sameName(item.section, section.name)).length
  const items = [
    [section.collapsed ? t('Expand section') : t('Collapse section'), ChevronRightIcon, () => actions.arrangeSection(section.name, { collapsed: !section.collapsed })],
    [t('Rename section'), PencilIcon, null],
    index > 0 ? [t('Move up'), ArrowUpIcon, () => actions.arrangeSection(section.name, { to: index - 1 })] : null,
    index < sections.length - 1 ? [t('Move down'), ArrowDownIcon, () => actions.arrangeSection(section.name, { to: index + 1 })] : null,
  ].filter(Boolean)
  return h('div', { ref, className: 'bt-menu', role: 'menu', 'aria-label': t('{name} actions', { name: section.name }), style: place, 'data-leaving': leaving || undefined },
    renaming
      ? h('form', { className: 'bt-menu-field', onSubmit: (event) => { event.preventDefault(); if (draft.trim() !== '' && draft.trim() !== section.name) run(() => actions.renameSection(section.name, draft.trim())); else actions.closeMenu() } },
          h('input', { autoFocus: true, value: draft, maxLength: 24, 'aria-label': t('Rename section'), onFocus: event => event.target.select(), onChange: event => setDraft(event.target.value) }))
      : h(Fragment, null,
          items.map(([text, Icon, work]) => h('button', { key: text, type: 'button', role: 'menuitem', onClick: () => (work ? run(work) : setRenaming(true)) }, h(Icon), text)),
          h('div', { className: 'bt-menu-sep', role: 'separator' }),
          h('div', { className: 'bt-menu-head' }, members > 0 ? t('Deleting keeps its {count} chats, out of any section.', { count: members }) : t('This section is empty.')),
          h('button', { type: 'button', role: 'menuitem', className: 'bt-danger', onClick: () => run(() => actions.deleteSection(section.name)) }, h(TrashIcon), t('Delete section'))))
}

// Menus for the DSH Agent row and its Sessions; none of the Bot entries apply.
function AgentMenu({ menu, roster, actions, leaving }) {
  const ref = useRef(null)
  const [place, setPlace] = useState({ left: menu.x, top: menu.y })
  const tick = useViewport()
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPlace({ left: Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(menu.y, viewBottom() - box.height - 8)) })
  }, [menu.x, menu.y, tick])
  const agent = roster.agentsById[menu.kind === 'agent' ? menu.id : menu.agentId]
  if (agent === undefined) return null
  const groups = menu.kind === 'agent'
    ? [
        [
          [agent.pinned ? t('Unpin') : t('Pin'), PinIcon, () => actions.setFlags(agent.id, { pinned: !agent.pinned })],
        ],
        [
          [t('Remove DSH Agent'), TrashIcon, () => actions.removeAgent(agent.id), true],
        ],
      ]
    : [
        [
          [t('Rename'), PencilIcon, () => actions.beginAgentRename(menu.id)],
        ],
        [
          [t('Archive'), TrashIcon, () => actions.archiveAgentSession(agent.id, menu.id), true],
        ],
      ]
  return h('div', { ref, className: 'bt-menu', role: 'menu', 'aria-label': menu.kind === 'agent' ? 'DSH Agent' : t('Session actions'), style: place, 'data-leaving': leaving || undefined },
    groups.map((group, index) => h(Fragment, { key: index },
      index > 0 ? h('div', { className: 'bt-menu-sep', role: 'separator' }) : null,
      group.map(([label, Icon, run, danger]) => h('button', {
        key: label, type: 'button', role: 'menuitem', className: danger ? 'bt-danger' : undefined,
        onClick: () => { actions.closeMenu(); void Promise.resolve(run()).catch(error => console.warn('[ds-bot]', error)) },
      }, h(Icon), label)))))
}
