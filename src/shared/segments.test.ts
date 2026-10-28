import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creditsStart, fromIntroDb, segmentAt, segments } from './segments.ts'

const anime = [
  { title: 'Prologue', time: 0 },
  { title: 'Opening', time: 95 },
  { title: 'Part A', time: 185 },
  { title: 'Ending', time: 1290 },
  { title: 'Preview', time: 1380 }
]

test('anime chapters: opening and ending + preview as one credits stretch', () => {
  const s = segments(anime, 1420)
  assert.deepEqual(s, [
    { kind: 'intro', start: 95, end: 185 },
    { kind: 'credits', start: 1290, end: 1420 }
  ])
  assert.equal(segmentAt(s, 100)?.kind, 'intro')
  assert.equal(segmentAt(s, 200), undefined)
  assert.equal(creditsStart(s, 1420), 1290)
})

test('recap, post-credits scene, and generic chapter names', () => {
  const s = segments(
    [
      { title: 'Recap', time: 0 },
      { title: 'Chapter 2', time: 60 },
      { title: 'End Credits', time: 6000 },
      { title: 'Post-Credits Scene', time: 6400 }
    ],
    6500
  )
  assert.deepEqual(
    s.map((x) => x.kind),
    ['recap', 'credits', 'post']
  )
  assert.equal(segments([{ title: 'Chapter 1', time: 0 }, { title: 'Chapter 2', time: 300 }], 600).length, 0)
  assert.equal(segments([{ title: 'Chapter 2', time: 300 }, { title: 'Opening', time: 600 }], 600).length, 0)
})

test('no credits chapter: the last 40 s (or 5%) count as credits', () => {
  assert.equal(creditsStart([], 2600), 2560)
  assert.equal(creditsStart([], 7200), 7160)
  // An early "credits" chapter (opening credits) is not the end.
  assert.equal(creditsStart([{ kind: 'credits', start: 30, end: 120 }], 2600), 2560)
})

test('TheIntroDB: recap and intro, credits to the end, a film post-credits scene between two credits spans', () => {
  assert.deepEqual(
    fromIntroDb({ intro: [{ start_ms: 56000, end_ms: 97000 }], recap: [{ start_ms: null, end_ms: 56000 }], credits: [{ start_ms: 3734000, end_ms: null }] }, 3800),
    [
      { kind: 'recap', start: 0, end: 56 },
      { kind: 'intro', start: 56, end: 97 },
      { kind: 'credits', start: 3734, end: 3800 }
    ]
  )
  const film = fromIntroDb({ credits: [{ start_ms: 7039000, end_ms: 7512000 }, { start_ms: 7546000, end_ms: 7561000 }] }, 7570)
  assert.deepEqual(film, [
    { kind: 'credits', start: 7039, end: 7512 },
    { kind: 'post', start: 7512, end: 7546 },
    { kind: 'credits', start: 7546, end: 7561 }
  ])
  assert.equal(creditsStart(film, 7570), 7039)
})
