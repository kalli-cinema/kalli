/** GET a JSON document with native fetch. No URL in the error: addon transport URLs embed debrid API keys. */
export async function getJson<T>(url: string, { timeout = 15000, headers }: { timeout?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`A fonte respondeu com erro ${res.status}. Confira a URL ou tente mais tarde.`)
  return res.json() as Promise<T>
}
