import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextPart } from './after.ts'

const saga = [
  { id: 3, release_date: '2026-12-18' },
  { id: 1, release_date: '2021-09-15' },
  { id: 9, release_date: '' },
  { id: 2, release_date: '2024-02-27' }
]

test('next film of a collection, by release date, only once out', () => {
  assert.equal(nextPart(saga, 1, '2026-10-27')?.id, 2)
  assert.equal(nextPart(saga, 2, '2026-10-27'), undefined)
  assert.equal(nextPart(saga, 2, '2026-12-18')?.id, 3)
  assert.equal(nextPart(saga, 3, '2027-01-01'), undefined)
  assert.equal(nextPart(saga, 42, '2026-10-27'), undefined)
})
