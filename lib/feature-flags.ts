import { createClient } from '@/lib/supabase/server'

const cache = new Map<string, { value: string; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function getFeatureFlag(key: string): Promise<string | null> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.value
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (data) {
    cache.set(key, { value: data.value, fetchedAt: Date.now() })
    return data.value
  }
  return null
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const value = await getFeatureFlag(key)
  return value === 'true'
}

export function invalidateCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
