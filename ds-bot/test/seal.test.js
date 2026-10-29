import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  stdin: { contents: "export { verdictOf, freshStamp } from './src/client/seal.js'", resolveDir: dirname(dirname(fileURLToPath(import.meta.url))) },
  bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: () => ({ createElement: () => null }), Date })
const { verdictOf, freshStamp } = module.exports

test('a reply that is only a verdict is told apart from one that only mentions it', () => {
  for (const text of ['准', '准！', ' 准奏。', '同意', 'OK同意'.slice(2), '可以～']) assert.equal(verdictOf(text)?.stamp, '准', text)
  for (const text of ['不同意', '驳回!', '不行。', '否']) assert.equal(verdictOf(text)?.stamp, '驳回', text)
  for (const text of ['知道了', '已阅', '收到。', '好的']) assert.equal(verdictOf(text)?.stamp, '已阅', text)
  for (const text of ['准备一下明天的会', '同意你的看法，但要改', '好', '', '准 不准']) assert.equal(verdictOf(text), undefined, text)
})

test('a seal lands with motion once, and only for a reply newer than the window', () => {
  assert.equal(freshStamp('a', Date.now() + 1000), true)
  assert.equal(freshStamp('a', Date.now() + 1000), false, 'not twice')
  assert.equal(freshStamp('b', Date.now() - 60_000), false, 'an old reply is shown still')
})
