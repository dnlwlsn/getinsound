import { createNotification, createNotificationBatch, shouldSendEmail } from '../notifications'

function mockSupabase(opts: {
  prefIn_app?: boolean | null
  prefEmail?: boolean | null
  suppressedIds?: string[]
} = {}) {
  const insertFn = jest.fn().mockResolvedValue({ error: null })
  return {
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'notification_preferences') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: opts.prefIn_app !== undefined
                      ? { in_app: opts.prefIn_app, email: opts.prefEmail ?? true }
                      : null,
                  }),
                }),
                in: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: (opts.suppressedIds ?? []).map(id => ({ user_id: id })),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return { insert: insertFn }
      }),
    } as any,
    insertFn,
  }
}

describe('createNotification — preference integration', () => {
  it('inserts notification when no preference exists (default on)', async () => {
    const { supabase, insertFn } = mockSupabase()
    await createNotification({
      supabase, userId: 'u1', type: 'sale', title: 'New sale',
    })
    expect(insertFn).toHaveBeenCalledTimes(1)
    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1',
      type: 'sale',
      title: 'New sale',
    }))
  })

  it('inserts notification when in_app is true', async () => {
    const { supabase, insertFn } = mockSupabase({ prefIn_app: true })
    await createNotification({
      supabase, userId: 'u1', type: 'sale', title: 'New sale',
    })
    expect(insertFn).toHaveBeenCalledTimes(1)
  })

  it('skips notification when in_app is false', async () => {
    const { supabase, insertFn } = mockSupabase({ prefIn_app: false })
    await createNotification({
      supabase, userId: 'u1', type: 'sale', title: 'New sale',
    })
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('passes body and link through to insert', async () => {
    const { supabase, insertFn } = mockSupabase()
    await createNotification({
      supabase, userId: 'u1', type: 'sale', title: 'Title', body: 'Body text', link: '/dashboard',
    })
    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Body text',
      link: '/dashboard',
    }))
  })

  it('sets body and link to null when not provided', async () => {
    const { supabase, insertFn } = mockSupabase()
    await createNotification({
      supabase, userId: 'u1', type: 'sale', title: 'Title',
    })
    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      body: null,
      link: null,
    }))
  })
})

describe('createNotificationBatch — preference integration', () => {
  function mockBatchSupabase(suppressedIds: string[] = []) {
    const insertFn = jest.fn().mockResolvedValue({ error: null })
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'notification_preferences') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: suppressedIds.map(id => ({ user_id: id })),
                  }),
                }),
              }),
            }),
          }
        }
        return { insert: insertFn }
      }),
    } as any
    return { supabase, insertFn }
  }

  it('sends to all users when no suppression preferences', async () => {
    const { supabase, insertFn } = mockBatchSupabase([])
    await createNotificationBatch({
      supabase, userIds: ['u1', 'u2', 'u3'], type: 'new_release', title: 'New release',
    })
    expect(insertFn).toHaveBeenCalledTimes(1)
    const rows = insertFn.mock.calls[0][0]
    expect(rows).toHaveLength(3)
  })

  it('excludes users who have suppressed in_app', async () => {
    const { supabase, insertFn } = mockBatchSupabase(['u2'])
    await createNotificationBatch({
      supabase, userIds: ['u1', 'u2', 'u3'], type: 'new_release', title: 'New release',
    })
    const rows = insertFn.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows.map((r: any) => r.user_id)).toEqual(['u1', 'u3'])
  })

  it('does nothing when all users are suppressed', async () => {
    const { supabase, insertFn } = mockBatchSupabase(['u1', 'u2'])
    await createNotificationBatch({
      supabase, userIds: ['u1', 'u2'], type: 'new_release', title: 'New release',
    })
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('does nothing for empty userIds', async () => {
    const { supabase, insertFn } = mockBatchSupabase()
    await createNotificationBatch({
      supabase, userIds: [], type: 'new_release', title: 'New release',
    })
    expect(insertFn).not.toHaveBeenCalled()
  })
})

describe('shouldSendEmail', () => {
  it('returns true when no preference exists (default on)', async () => {
    const { supabase } = mockSupabase()
    const result = await shouldSendEmail({ supabase, userId: 'u1', type: 'sale' })
    expect(result).toBe(true)
  })

  it('returns true when email is true', async () => {
    const { supabase } = mockSupabase({ prefIn_app: true, prefEmail: true })
    const result = await shouldSendEmail({ supabase, userId: 'u1', type: 'sale' })
    expect(result).toBe(true)
  })

  it('returns false when email is false', async () => {
    const { supabase } = mockSupabase({ prefIn_app: true, prefEmail: false })
    const result = await shouldSendEmail({ supabase, userId: 'u1', type: 'sale' })
    expect(result).toBe(false)
  })
})
