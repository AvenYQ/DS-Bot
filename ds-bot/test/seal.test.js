import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  stdin: { contents: "export { sealMessage, SEALS } from './src/client/seal.js'", resolveDir: dirname(dirname(fileURLToPath(import.meta.url))) },
  bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: () => ({ createElement: () => null }) })
const { sealMessage, SEALS } = module.exports

test('a verdict answers in plain words and names the start of what it answers', () => {
  assert.equal(SEALS.map(seal => seal.kind).join(','), '准,驳回,知道了')
  assert.equal(sealMessage('准', '方案一：明早 8:00 南京南出发，\n二等座 443 元'), '准奏，照此办理。\n（批复：方案一：明早 8:00 南京南出发， 二等座 443 元）')
  assert.equal(sealMessage('驳回', 'x'.repeat(80), '  太贵了！ '), `驳回。理由：太贵了。\n（批复：${'x'.repeat(60)}…）`)
  assert.equal(sealMessage('驳回', '方案二', ''), '驳回，请重新拟办。\n（批复：方案二）')
  assert.equal(sealMessage('知道了', ''), '知道了，不必回复。')
  assert.doesNotMatch(sealMessage('准', '> 引用'), /【|^>/m)
})
