// macOS: the app updates itself without an Apple Developer ID. Squirrel (electron-updater)
// only accepts a build signed with one; this build is signed ad hoc, so the app does the
// work itself: it downloads the release's zip, checks it against the digest GitHub keeps
// for the asset, unpacks it with ditto, and hands a small script the swap. The script waits
// for the app to quit, puts the new bundle in place of the old one, and opens it again.
// A file the app downloads itself carries no quarantine flag, so the new version opens
// without Gatekeeper's prompt.
import { spawn, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, rm, writeFile, constants } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

// The bundle the running app was started from: …/DeepSeek Bot.app/Contents/MacOS/DeepSeek Bot.
export function bundleOf(execPath) {
  const at = execPath.lastIndexOf('.app/Contents/MacOS/')
  return at < 0 ? undefined : execPath.slice(0, at + 4)
}

// Whether the app can replace itself: it runs from a bundle in a folder it may write to.
export async function canSelfUpdate(execPath) {
  const bundle = bundleOf(execPath)
  if (bundle === undefined || bundle.includes('/AppTranslocation/')) return false
  try {
    await access(dirname(bundle), constants.W_OK)
    await access(bundle, constants.W_OK)
    return true
  } catch {
    return false
  }
}

const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`

// The swap, run by /bin/sh once the app has quit: the old bundle moves aside and is removed
// only after the new one is in place, so a failed move leaves the old version where it was.
export function swapScript({ pid, from, to, log }) {
  return `#!/bin/sh
exec >>${quote(log)} 2>&1
echo "$(date) swap: waiting for ${pid}"
i=0
while kill -0 ${pid} 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 3000 ]; then echo "$(date) swap: the app did not quit, nothing changed"; exit 0; fi
  sleep 0.2
done
old=${quote(`${to}.old-${Date.now()}`)}
if mv ${quote(to)} "$old"; then
  if mv ${quote(from)} ${quote(to)}; then
    rm -rf "$old"
    /usr/bin/xattr -dr com.apple.quarantine ${quote(to)} 2>/dev/null
    echo "$(date) swap: done"
  else
    mv "$old" ${quote(to)}
    echo "$(date) swap: failed, the old version stays"
  fi
fi
/usr/bin/open ${quote(to)} || echo "$(date) swap: could not open the app"
`
}

/**
 * Downloads and unpacks the update, and starts the swap that runs after the app quits.
 * Returns once the app may quit; throws (and changes nothing) when any step fails.
 * @param {{ version: string, url: string, digest?: string, execPath: string, fetch?: typeof fetch,
 *   onProgress?: (fraction: number) => void, log?: Pick<Console, 'info' | 'error'> }} options
 */
export async function prepareMacUpdate({ version, url, digest, execPath, fetch = globalThis.fetch, onProgress, log = console }) {
  const bundle = bundleOf(execPath)
  if (bundle === undefined) throw new Error('DeepSeek Bot is not running from an app bundle')
  const work = await mkdtemp(join(tmpdir(), 'ds-bot-update-'))
  try {
    const zip = join(work, 'update.zip')
    const response = await fetch(url, { headers: { 'user-agent': `DeepSeek-Bot/${version}` }, redirect: 'follow' })
    if (!response.ok || response.body === null) throw new Error(`download failed: HTTP ${String(response.status)}`)
    const total = Number(response.headers.get('content-length')) || 0
    const hash = createHash('sha256')
    let received = 0
    const counted = Readable.fromWeb(response.body).on('data', (chunk) => {
      hash.update(chunk)
      received += chunk.length
      if (total > 0) onProgress?.(received / total)
    })
    await pipeline(counted, createWriteStream(zip))
    const sum = hash.digest('hex')
    const want = typeof digest === 'string' && digest.startsWith('sha256:') ? digest.slice(7) : undefined
    if (want !== undefined && want !== sum) throw new Error('the download does not match its release')
    const unpacked = join(work, 'unpacked')
    await mkdir(unpacked)
    await run('/usr/bin/ditto', ['-x', '-k', zip, unpacked])
    const app = join(unpacked, bundle.slice(bundle.lastIndexOf('/') + 1))
    const plist = await readFile(join(app, 'Contents', 'Info.plist'), 'utf8')
    const shown = /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]*)<\/string>/u.exec(plist)?.[1]
    if (shown !== version) throw new Error(`the download is version ${shown ?? 'unknown'}, not ${version}`)
    await rm(zip, { force: true })
    const script = join(work, 'swap.sh')
    await writeFile(script, swapScript({ pid: process.pid, from: app, to: bundle, log: join(work, 'swap.log') }), { mode: 0o755 })
    const child = spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' })
    child.unref()
    return { bundle, work }
  } catch (error) {
    await rm(work, { recursive: true, force: true }).catch(() => {})
    log.error(`DeepSeek Bot: update ${version} not prepared: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}
