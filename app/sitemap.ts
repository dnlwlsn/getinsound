import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const base = 'https://getinsound.com'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/explore`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/discover`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/for-artists`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for-fans`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/why-us`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const { data: artists } = await supabase
    .from('artists')
    .select('slug, updated_at')

  const artistRoutes: MetadataRoute.Sitemap = (artists ?? []).map(a => ({
    url: `${base}/${a.slug}`,
    lastModified: a.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticRoutes, ...artistRoutes]
}
