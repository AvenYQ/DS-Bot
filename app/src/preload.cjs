// Gives the page that the app's Host serves the app's own bridge. On Windows it also marks the
// page for the frameless window the way DSH Desktop's preload does
// (apps/desktop/src/preload-windows.ts, preload-platform.ts and preload-theme.ts; see NOTICE),
// but without data-platform: that puts DSH's shortcuts on native menu input, which this
// window does not have.
const { contextBridge, ipcRenderer } = require('electron')

const host = process.argv.find(value => value.startsWith('--ds-bot-origin='))?.slice('--ds-bot-origin='.length)
if (host !== undefined && location.origin === host) {
  // DS Bot's settings show and move the app's data location through this.
  contextBridge.exposeInMainWorld('dsBotApp', {
    dataLocation: () => ipcRenderer.invoke('ds-bot:data-location'),
    moveData: (workspace) => ipcRenderer.invoke('ds-bot:move-data', typeof workspace === 'string' ? workspace : undefined),
    teamWorkspaceChanged: (path) => { ipcRenderer.send('ds-bot:team-workspace', String(path)) },
    // The Bot browsers, in the shape of DSH Desktop's browser bridge so that ds-bot drives both
    // alike; `forget` clears a key's storage, which here outlives the app.
    browser: browserBridge(),
    // The app's own updater, for the About row's state and buttons.
    updates: updatesBridge(),
  })
  const caption = process.argv.find(value => value.startsWith('--ds-bot-caption='))
  const macFrame = process.argv.includes('--ds-bot-mac-frame')
  if (caption !== undefined || macFrame) {
    ipcRenderer.on('ds-bot:fullscreen', (_event, fullscreen) => {
      const root = document.documentElement
      if (root === null) return
      if (fullscreen) root.dataset.fullscreen = 'true'
      else delete root.dataset.fullscreen
    })
    const start = () => {
      if (macFrame) macFrameless()
      else frameless(caption.slice('--ds-bot-caption='.length), process.argv.includes('--ds-bot-mica'))
    }
    // A preload runs before the document root exists.
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start, { once: true })
    else start()
  }
}

function browserBridge() {
  const listeners = new Map()
  const viewListeners = new Set()
  ipcRenderer.on('ds-bot:browser-view-changed', (_event, change) => {
    for (const listener of [...viewListeners]) {
      try { listener(change) } catch (error) { console.error('DeepSeek Bot: a browser view listener failed', error) }
    }
  })
  ipcRenderer.on('ds-bot:browser-open-requested', (_event, request) => {
    if (typeof request?.lease !== 'string' || typeof request.url !== 'string') return
    for (const listener of [...(listeners.get(request.lease) ?? [])]) {
      try { listener(request.url) } catch (error) { console.error('DeepSeek Bot: a browser link handler failed', error) }
    }
  })
  return {
    acquire: key => ipcRenderer.invoke('ds-bot:browser-acquire', String(key)),
    release: lease => ipcRenderer.invoke('ds-bot:browser-release', String(lease)),
    forget: key => ipcRenderer.invoke('ds-bot:browser-forget', String(key)),
    views: {
      create: (botId, tabId, url) => ipcRenderer.invoke('ds-bot:browser-view-create', String(botId), String(tabId), typeof url === 'string' ? url : undefined),
      sync: botId => ipcRenderer.invoke('ds-bot:browser-view-sync', String(botId)),
      place: (tabId, rect, visible) => ipcRenderer.invoke('ds-bot:browser-view-place', String(tabId), rect, visible === true),
      navigate: (botId, tabId, url) => ipcRenderer.invoke('ds-bot:browser-view-navigate', String(botId), String(tabId), String(url)),
      command: (botId, tabId, command) => ipcRenderer.invoke('ds-bot:browser-view-command', String(botId), String(tabId), String(command)),
      focus: (botId, tabId) => ipcRenderer.invoke('ds-bot:browser-view-focus', String(botId), String(tabId)),
      read: (botId, tabId, script) => ipcRenderer.invoke('ds-bot:browser-view-read', String(botId), String(tabId), String(script)),
      close: (botId, tabId) => ipcRenderer.invoke('ds-bot:browser-view-close', String(botId), String(tabId)),
      hold: (botId, held) => ipcRenderer.invoke('ds-bot:browser-view-hold', String(botId), held === true),
      subscribe(listener) { viewListeners.add(listener); return () => viewListeners.delete(listener) },
    },
    // Cookie imports, only in the app: sources and a two-step pick/harvest → preview → apply.
    importSources: () => ipcRenderer.invoke('ds-bot:browser-import-sources'),
    importPick: () => ipcRenderer.invoke('ds-bot:browser-import-pick'),
    importLive: (source, close) => ipcRenderer.invoke('ds-bot:browser-import-live', String(source), close === true),
    importApply: (key, pending) => ipcRenderer.invoke('ds-bot:browser-import-apply', String(key), String(pending)),
    importCancel: (pending) => ipcRenderer.invoke('ds-bot:browser-import-cancel', String(pending)),
    onOpenRequested(lease, listener) {
      const id = String(lease)
      let set = listeners.get(id)
      if (set === undefined) { set = new Set(); listeners.set(id, set) }
      set.add(listener)
      return () => {
        set.delete(listener)
        if (set.size === 0 && listeners.get(id) === set) listeners.delete(id)
      }
    },
  }
}

function updatesBridge() {
  const listeners = new Set()
  ipcRenderer.on('ds-bot:app-update-changed', (_event, state) => {
    for (const listener of [...listeners]) {
      try { listener(state) } catch (error) { console.error('DeepSeek Bot: an update state handler failed', error) }
    }
  })
  return {
    state: () => ipcRenderer.invoke('ds-bot:app-update-state'),
    check: () => ipcRenderer.invoke('ds-bot:app-update-check'),
    install: () => ipcRenderer.invoke('ds-bot:app-update-install'),
    open: () => ipcRenderer.invoke('ds-bot:app-update-open'),
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

// macOS without a title bar: the traffic lights stand where the brand was, in the sidebar's
// first row. That row and the conversation's header move the window (adoptDragRegions); the
// controls in them stay clickable. In fullscreen the lights are gone and the brand comes back.
const MAC_FRAME_CSS = `
html[data-ds-bot-mac]:not([data-fullscreen]) .bt-side-top>.bt-brand{visibility:hidden}
html[data-ds-bot-mac]:not([data-fullscreen]) .bt-side-top{-webkit-app-region:drag}
html[data-ds-bot-mac] .bt-side-top>.bt-brand{order:-2}
html[data-ds-bot-mac] .bt-side-top .bt-side-collapse{order:-1}
/* Expanded, as in Grok Bot: the sidebar toggle is a plain icon left of search and new chat. */
html[data-ds-bot-mac] .bt-side-top .bt-side-collapse{background:transparent!important;box-shadow:none!important;border-color:transparent!important;width:30px;height:30px;color:color-mix(in srgb,var(--bt-ink) 72%,transparent)}
html[data-ds-bot-mac] .bt-side-top .bt-side-collapse:hover{background:var(--bt-hover)!important}
/* Collapsed, as in Grok Bot: a rail of avatars under the traffic lights (the app moves the
   lights left and the page widens the rail to 76px), and at its foot the sidebar toggle and
   new chat, above the account. */
/* On macOS DSH closes the sidebar's column to 0px and the page widens it to the rail after;
   with no right panel open, the rail's width is set here from the first frame instead, so the
   sidebar shrinks once, straight to 76px (watchRail covers the case with a right panel). */
html[data-ds-bot-mac] [data-sidebar-collapsed][data-rightbar-collapsed]{grid-template-columns:76px minmax(0px,1fr) minmax(0px,0px)!important}
/* Opening and closing the sidebar is one glide on one curve, however DSH times its own
   transition; not while the window is resized or a column is dragged. */
@media (prefers-reduced-motion:no-preference){html[data-ds-bot-mac]:not([data-bt-resizing]) :has(>[class*="_sidebarCol"]):not([data-dragging]){transition:grid-template-columns .32s cubic-bezier(.32,.72,0,1)!important}}
html[data-ds-bot-mac] [class*="_root"][class*="_collapsed"]{position:relative;padding:52px 8px 6px!important}
html[data-ds-bot-mac] [class*="_root"][class*="_collapsed"]::before{content:"";position:absolute;top:0;left:0;right:0;height:48px;-webkit-app-region:drag}
html[data-ds-bot-mac] [class*="_collapsed"] [class*="_logoRow"]{-webkit-app-region:no-drag}
html[data-ds-bot-mac] [class*="_collapsed"] [class*="_regionArea"]{overflow:visible!important;margin-bottom:76px}
html[data-ds-bot-mac] [class*="_collapsed"] [class*="_footArea"]{display:flex!important;justify-content:center}
html[data-ds-bot-mac] .bt-rail .bt-list{scrollbar-width:none}
html[data-ds-bot-mac] .bt-rail .bt-list::-webkit-scrollbar{display:none}
html[data-ds-bot-mac] [class*="_collapsed"] :is([class*="_logoRow"],.bt-rail>.bt-round:not(.bt-update)){position:absolute!important;left:50%;transform:translateX(-50%);margin:0!important;z-index:2}
html[data-ds-bot-mac] [class*="_collapsed"] [class*="_logoRow"]{bottom:116px;height:32px;display:flex;align-items:center}
html[data-ds-bot-mac] [class*="_collapsed"] .bt-rail>.bt-round:not(.bt-update){bottom:82px}
html[data-ds-bot-mac] [class*="_collapsed"] :is([class*="_logoRow"] [class*="_toggle"],.bt-rail>.bt-round:not(.bt-update)){width:32px!important;height:32px!important;min-width:0!important;padding:0!important;border:0!important;border-radius:8px!important;display:inline-grid!important;place-items:center;background:none!important;box-shadow:none!important;color:color-mix(in srgb,var(--bt-ink) 72%,transparent)}
html[data-ds-bot-mac] [class*="_collapsed"] :is([class*="_logoRow"] [class*="_toggle"],.bt-rail>.bt-round:not(.bt-update)):hover{background:var(--bt-hover)!important;color:var(--bt-ink)}
html[data-ds-bot-mac] [class*="_collapsed"] .bt-rail>.bt-round:not(.bt-update) svg{width:18px;height:18px}
html[data-ds-bot-mac] [class*="_collapsed"] [class*="_logoRow"] [class*="_railMark"]{display:none}
html[data-ds-bot-mac] [class*="_collapsed"] [class*="_logoRow"] [class*="_panelIcon"]{display:block!important;opacity:1!important;width:18px;height:18px}
`

function macFrameless() {
  const root = document.documentElement
  root.dataset.dsBotMac = ''
  const style = document.createElement('style')
  style.textContent = MAC_FRAME_CSS
  document.head.append(style)
  adoptDragRegions()
  watchRail()
  let resizing
  addEventListener('resize', () => {
    root.dataset.btResizing = ''
    clearTimeout(resizing)
    resizing = setTimeout(() => { delete root.dataset.btResizing }, 200)
  })
}

// Which parts of the page move the window is DSH's own: it marks them [data-window-drag]
// (the conversation's header, the tab strip) and keeps every control out, but only under
// html[data-platform="darwin"], which this window does not set (see the top). Its rules are
// copied here under html[data-ds-bot-mac], read from its stylesheets at run time so that a
// newer DSH brings its own. Without them a drag region (the sidebar's first row) swallows
// the clicks on the buttons in it.
function adoptDragRegions() {
  const style = document.createElement('style')
  document.head.append(style)
  let last = ''
  const copy = () => {
    const rules = []
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === style) continue
      let list
      try { list = sheet.cssRules } catch { continue }
      for (const rule of list) {
        const text = rule.cssText
        if (text.includes('app-region') && text.includes('[data-platform="darwin"]')) rules.push(text.replaceAll('[data-platform="darwin"]', '[data-ds-bot-mac]'))
      }
    }
    const next = rules.join('\n')
    if (next !== last) style.textContent = last = next
  }
  copy()
  new MutationObserver(copy).observe(document.head, { childList: true })
  window.addEventListener('load', copy, { once: true })
}

// DSH sets the rail's width on the frame's grid (56px), too narrow for the traffic lights:
// while the sidebar is collapsed its column becomes 76px, and the app moves the lights.
// DSH narrows the column first and marks the sidebar collapsed only when that animation
// ends, so the narrow column itself is the sign: it goes to 76px at once, and the sidebar
// shrinks straight to its final width instead of to 56px and then out again.
const RAIL = '76px'
function watchRail() {
  let collapsed
  const sync = () => {
    const frame = document.querySelector('[class*="_sidebarCol"]')?.parentElement
    const columns = frame?.style.gridTemplateColumns
    const lead = typeof columns === 'string' ? /^(\d+(?:\.\d+)?)px /.exec(columns) : null
    const now = lead !== null ? Number(lead[1]) <= parseFloat(RAIL) : document.querySelector('[class*="_root"][class*="_collapsed"]') !== null
    if (now !== collapsed) {
      collapsed = now
      ipcRenderer.send('ds-bot:mac-lights', now)
    }
    if (now && lead !== null && `${lead[1]}px` !== RAIL) frame.style.gridTemplateColumns = columns.replace(/^\d+(?:\.\d+)?px/, RAIL)
  }
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: true })
  sync()
}

function frameless(height, mica) {
  const root = document.documentElement
  root.dataset.windowsTitlebar = ''
  root.style.setProperty('--dsh-windows-titlebar-height', `${height}px`)
  // DSH keeps the dialog mask off the caption band, which then stays bright above a dimmed
  // page; here the band is part of the page, so the mask covers it too.
  root.style.setProperty('--dsh-frame-chrome-top', '0px')
  let theme
  const sendTheme = () => {
    const value = root.getAttribute('data-ds-theme-source')
    if (value === null || value === theme) return
    theme = value
    ipcRenderer.send('ds-bot:native-theme', value)
  }
  new MutationObserver(sendTheme).observe(root, { attributeFilter: ['data-ds-theme-source'] })
  sendTheme()
  captionColors(mica)
}

// The caption buttons stand on the rightmost open column with Mica (the right sidebar or the
// conversation) and on the sidebar-colored band without it. Theme variables can resolve apart
// from what is painted, so the color comes from the element itself: the first one up from it
// that is not transparent.
function captionColors(mica) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) return
  const opaque = (color) => {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    return alpha === 0 ? undefined : `rgb(${red}, ${green}, ${blue})`
  }
  // The surface's color with the layers above the caption buttons (a dialog's mask) painted over it.
  const covered = (base, frame) => {
    const layers = []
    for (const element of document.elementsFromPoint(innerWidth - 1, 1)) {
      if (frame !== null && (element === frame || element.contains(frame) || frame.contains(element))) break
      for (const pseudo of ['::after', null, '::before']) layers.push(getComputedStyle(element, pseudo).backgroundColor)
    }
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = base
    context.fillRect(0, 0, 1, 1)
    for (const color of layers.reverse()) {
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
    }
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
    return `rgb(${red}, ${green}, ${blue})`
  }
  const column = () => {
    if (!mica) return document.querySelector('div[class*="_sidebarCol"]')
    const right = document.querySelector('div[class*="_rightbarCol"]')
    return right !== null && right.getBoundingClientRect().width > 0 ? right : document.querySelector('div[class*="_centerCol"]')
  }
  let frame
  const surface = () => {
    const start = column()
    // Opening or closing the right sidebar changes the frame's columns.
    if (start !== null && frame === undefined) {
      frame = start.parentElement
      observer.observe(frame, { attributes: true, attributeFilter: ['style'] })
    }
    for (let element = start; element !== null; element = element.parentElement) {
      const color = opaque(getComputedStyle(element).backgroundColor)
      if (color !== undefined) return [covered(color, frame ?? null), opaque(getComputedStyle(element).color)]
    }
    return undefined
  }
  let sent = ''
  let tries = 0
  const send = () => {
    const colors = surface()
    // The frame appears once DSH has booted; until then the main process's colors hold.
    if (colors === undefined || colors[1] === undefined) {
      if (tries++ < 120) setTimeout(send, 250)
      return
    }
    const current = colors.join()
    if (current === sent) return
    sent = current
    ipcRenderer.send('ds-bot:caption-colors', ...colors)
  }
  // A dialog mounts anywhere in the page, which changes all the time; one look per frame.
  let queued = false
  const queue = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; send() })
  }
  const observer = new MutationObserver(queue)
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'style'], childList: true, subtree: true })
  observer.observe(document.head, { childList: true, subtree: true, characterData: true })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ds-theme-source', 'style'] })
  // A stylesheet link is added before it loads; its rules apply without another mutation.
  document.head.addEventListener('load', send, true)
  send()
}
