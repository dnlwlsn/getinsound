import { getUserRole, UserRole } from '../auth'

function mockSupabase(artistData: any, profileData: any) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => {
            if (table === 'artists') return { data: artistData, error: null }
            if (table === 'fan_profiles') return { data: profileData, error: null }
            return { data: null, error: null }
          },
        }),
      }),
    }),
  } as any
}

describe('getUserRole', () => {
  it('returns artist role when artist record exists', async () => {
    const supabase = mockSupabase({ slug: 'test-artist' }, { has_seen_welcome: true })
    const result = await getUserRole(supabase, 'user-123')
    expect(result).toEqual<UserRole>({
      isArtist: true,
      artistSlug: 'test-artist',
      hasSeenWelcome: true,
    })
  })

  it('returns fan role when no artist record', async () => {
    const supabase = mockSupabase(null, { has_seen_welcome: true })
    const result = await getUserRole(supabase, 'user-123')
    expect(result).toEqual<UserRole>({
      isArtist: false,
      artistSlug: null,
      hasSeenWelcome: true,
    })
  })

  it('defaults hasSeenWelcome to false when no profile', async () => {
    const supabase = mockSupabase(null, null)
    const result = await getUserRole(supabase, 'user-123')
    expect(result).toEqual<UserRole>({
      isArtist: false,
      artistSlug: null,
      hasSeenWelcome: false,
    })
  })

  it('handles artist without fan profile', async () => {
    const supabase = mockSupabase({ slug: 'artist' }, null)
    const result = await getUserRole(supabase, 'user-123')
    expect(result.isArtist).toBe(true)
    expect(result.hasSeenWelcome).toBe(false)
  })

  it('runs both queries in parallel', async () => {
    let callOrder: string[] = []
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              callOrder.push(table)
              return { data: null, error: null }
            },
          }),
        }),
      }),
    } as any

    await getUserRole(supabase, 'user-123')
    expect(callOrder).toHaveLength(2)
    expect(callOrder).toContain('artists')
    expect(callOrder).toContain('fan_profiles')
  })
})
