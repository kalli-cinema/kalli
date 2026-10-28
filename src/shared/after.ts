/** A film of a TMDB collection; `release_date` is `YYYY-MM-DD`, empty when not announced. */
export type Part = { id: number; release_date?: string }

/** The film that follows `id` in its collection by release date, only once it is out (`today` as `YYYY-MM-DD`). */
export function nextPart(parts: Part[], id: number, today: string): Part | undefined {
  const dated = parts.filter((p) => p.release_date).sort((a, b) => a.release_date!.localeCompare(b.release_date!))
  const at = dated.findIndex((p) => p.id === id)
  const next = at >= 0 ? dated[at + 1] : undefined
  return next && next.release_date! <= today ? next : undefined
}
