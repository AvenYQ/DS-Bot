import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import { bundleOf, prepareMacUpdate, swapScript } from '../src/mac-update.mjs'

describe('macOS self-update', () => {
  it('finds the bundle the app runs from', () => {
    assert.equal(bundleOf('/Applications/DeepSeek Bot.app/Contents/MacOS/DeepSeek Bot'), '/Applications/DeepSeek Bot.app')
    assert.equal(bundleOf('/usr/local/bin/electron'), undefined)
  })

  it('swaps the bundle only after the app quits, and keeps the old one when the move fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'swap-'))
    const to = join(root, 'Apps', 'DeepSeek Bot.app')
    const from = join(root, 'new', 'DeepSeek Bot.app')
    await mkdir(to, { recursive: true }); await writeFile(join(to, 'version'), 'old')
    await mkdir(from, { recursive: true }); await writeFile(join(from, 'version'), 'new')
    const sleeper = spawn('sleep', ['0.6'])
    const script = join(root, 'swap.sh')
    await writeFile(script, swapScript({ pid: sleeper.pid, from, to, log: join(root, 'swap.log') }), { mode: 0o755 })
    const started = Date.now()
    await promisify(execFile)('/bin/sh', [script])
    assert.ok(Date.now() - started >= 400, 'waited for the app to quit')
    assert.equal(await readFile(join(to, 'version'), 'utf8'), 'new')
    assert.deepEqual((await readdir(join(root, 'Apps'))).filter(name => name.includes('.old-')), [], 'the old bundle is gone')
    assert.match(await readFile(join(root, 'swap.log'), 'utf8'), /swap: done/)
  })

  it('changes nothing when the download does not match its release', async () => {
    const body = new Blob(['not the zip']).stream()
    const fetch = async () => new Response(body, { status: 200, headers: { 'content-length': '11' } })
    await assert.rejects(prepareMacUpdate({ version: '1.0.0', url: 'https://example.invalid/a.zip', digest: `sha256:${'0'.repeat(64)}`, execPath: '/Applications/DeepSeek Bot.app/Contents/MacOS/DeepSeek Bot', fetch, log: { info() {}, error() {} } }), /does not match/)
  })
})
