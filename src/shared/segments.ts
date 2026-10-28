// Skippable parts of a video: from the file's chapter names (Blu-ray, web and anime releases name them), else from
// TheIntroDB's community timestamps (`fromIntroDb`). Files with neither get the end-of-video fallback for credits.

export type Chapter = { title?: string; time: number }

export type SegmentKind = 'recap' | 'intro' | 'credits' | 'post'

export type Segment = { kind: SegmentKind; start: number; end: number }

const KIND: [RegExp, SegmentKind][] = [
  [/\b(mid|post)[- ]?credits?\b|\bstinger\b|\bafter[- ]credits\b|cena p[óo]s/i, 'post'],
  [/\brecap\b|previously|anteriormente|resumo/i, 'recap'],
  [/\b(opening|intro(duction)?|op|theme|title sequence|main title|abertura)\b/i, 'intro'],
  [/\b(ending|end ?credits|credits|outro|ed|cr[ée]ditos|preview|next episode|next time|pr[óo]ximo epis[óo]dio)\b/i, 'credits']
]

/** Named chapters as segments, in order; a chapter ends where the next begins (the last one at `dur`). */
export function segments(chapters: Chapter[], dur: number): Segment[] {
  const out: Segment[] = []
  chapters.forEach((c, i) => {
    const kind = KIND.find(([re]) => re.test(c.title ?? ''))?.[1]
    if (!kind) return
    const end = chapters[i + 1]?.time ?? dur
    const prev = out.at(-1)
    // "Ending" then "Preview" read as one stretch of credits.
    if (prev && prev.kind === kind && Math.abs(prev.end - c.time) < 1) prev.end = end
    else if (end > c.time) out.push({ kind, start: c.time, end })
  })
  return out
}

type Span = { start_ms: number | null; end_ms: number | null }
/** TheIntroDB's answer for one video (`api.theintrodb.org/v2/media`); a null start is 0, a null end the video's end. */
export type IntroDb = { intro?: Span[]; recap?: Span[]; credits?: Span[]; preview?: Span[] }

/**
 * TheIntroDB's spans as segments, in order. A preview reads as credits; a gap between two credits spans (a film's
 * credits broken by a scene) is the post-credits scene.
 */
export function fromIntroDb(db: IntroDb, dur: number): Segment[] {
  const span = (kind: SegmentKind) => (s: Span) => ({ kind, start: (s.start_ms ?? 0) / 1000, end: s.end_ms == null ? dur : s.end_ms / 1000 })
  const credits = [...(db.credits ?? []), ...(db.preview ?? [])].map(span('credits')).sort((a, b) => a.start - b.start)
  const post = credits.slice(1).flatMap((c, i) => (c.start - credits[i].end > 5 ? [{ kind: 'post' as const, start: credits[i].end, end: c.start }] : []))
  return [...(db.recap ?? []).map(span('recap')), ...(db.intro ?? []).map(span('intro')), ...credits, ...post]
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)
}

/** A video's segments: its named chapters when it has any, else TheIntroDB's (when it knows the video). */
export function videoSegments(chapters: Chapter[], dur: number, db?: IntroDb | null): Segment[] {
  const named = segments(chapters, dur)
  return named.length || !db || !dur ? named : fromIntroDb(db, dur)
}

/** The segment playing at `pos`, if any. */
export const segmentAt = (list: Segment[], pos: number) => list.find((s) => pos >= s.start && pos < s.end - 1)

/**
 * Where the credits start: the credits chapter, else a guess near the end. A series offers the next episode from
 * there; a video is watched once past it.
 */
export function creditsStart(list: Segment[], dur: number): number {
  const credits = list.find((s) => s.kind === 'credits' && s.start > dur * 0.6)
  return credits ? credits.start : Math.max(dur * 0.95, dur - 40)
}
