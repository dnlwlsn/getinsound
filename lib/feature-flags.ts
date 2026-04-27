const cache = new Map<string, { value: string; fetchedAt: number }>()

export function invalidateCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
