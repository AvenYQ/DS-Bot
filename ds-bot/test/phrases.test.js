import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanPhrases, PHRASES_MAX, PHRASE_MAX } from '../src/host/phrases.js'

test('catchphrases split on Chinese and Latin separators and drop repeats and trailing dots', () => {
  assert.deepEqual(cleanPhrases('斟酌中…、权衡利弊。；容我想想\n斟酌中'), ['斟酌中', '权衡利弊', '容我想想'])
  assert.deepEqual(cleanPhrases(['  a  ', '', null, 'b...']), ['a', 'b'])
  assert.deepEqual(cleanPhrases(''), [])
  assert.deepEqual(cleanPhrases(undefined), [])
})

test('catchphrases are capped in number and length', () => {
  assert.equal(cleanPhrases(Array.from({ length: 10 }, (_, i) => `p${i}`)).length, PHRASES_MAX)
  assert.equal(cleanPhrases('字'.repeat(40))[0].length, PHRASE_MAX)
})
