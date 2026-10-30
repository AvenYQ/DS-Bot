// The application menu of macOS carries a Quit with ⌘Q, as every Mac app does, tray or not.
import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { app, state } from './helpers/fake-electron.mjs'
import { startApp, waitFor } from './helpers/app-harness.mjs'
import { installHooks } from './helpers/register.mjs'

await installHooks()

// The menu of macOS is the menu of the app on macOS.
Object.defineProperty(process, 'platform', { value: 'darwin' })

before(async () => { await startApp({ packaged: false }) })

test('the application menu of macOS has a Quit on ⌘Q', async () => {
  await waitFor(() => state.menus.length > 0, 'set the menu')
  await waitFor(() => state.tray !== undefined, 'build the tray')
  const menu = state.menus.at(-1).template
  const items = menu[0].submenu
  assert.equal(menu[0].label, 'DeepSeek Bot', 'the menu of the app')
  const quit = items.at(-1)
  assert.equal(quit.label, 'Quit DeepSeek Bot', 'the menu ends the app')
  assert.equal(quit.accelerator, 'Command+Q', 'on ⌘Q')
  assert.equal(typeof quit.click, 'function', 'the entry works')
  // The menu keeps the rest of macOS: about, services and the hiding of the app.
  const roles = items.map(item => item.role).filter(Boolean)
  for (const role of ['about', 'services', 'hide', 'hideOthers', 'unhide']) assert.ok(roles.includes(role), `the menu keeps ${role}`)
})

test('the app ends', async () => {
  app.quit()
  await waitFor(() => state.tray.destroyed === true, 'take the tray away')
})
