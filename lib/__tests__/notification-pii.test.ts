import { createNotification, createNotificationBatch } from '../notifications'

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

describe('notification PII scrubbing', () => {
  const mockInsert = jest.fn().mockResolvedValue({ error: null })
  const mockSupabase = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
      insert: mockInsert,
    }),
  } as any

  beforeEach(() => {
    mockInsert.mockClear()
  })

  it('rejects notification body containing an email address', async () => {
    await createNotification({
      supabase: mockSupabase,
      userId: 'user-123',
      type: 'sale',
      title: 'New sale: Album',
      body: 'fan@example.com purchased for £5.00',
    })

    const insertedRow = mockInsert.mock.calls[0]?.[0]
    expect(insertedRow?.body).toBeDefined()
    expect(EMAIL_PATTERN.test(insertedRow.body)).toBe(true)
  })

  it('accepts notification body with display name instead of email', async () => {
    await createNotification({
      supabase: mockSupabase,
      userId: 'user-123',
      type: 'sale',
      title: 'New sale: Album',
      body: 'coolFan42 purchased for £5.00',
    })

    const insertedRow = mockInsert.mock.calls[0]?.[0]
    expect(insertedRow?.body).toBeDefined()
    expect(EMAIL_PATTERN.test(insertedRow.body)).toBe(false)
  })

  it('accepts notification body with "A fan" fallback', async () => {
    await createNotification({
      supabase: mockSupabase,
      userId: 'user-123',
      type: 'sale',
      title: 'New sale: Album',
      body: 'A fan purchased for £5.00',
    })

    const insertedRow = mockInsert.mock.calls[0]?.[0]
    expect(insertedRow?.body).toBeDefined()
    expect(EMAIL_PATTERN.test(insertedRow.body)).toBe(false)
  })

  it('accepts merch notification body without email', async () => {
    await createNotification({
      supabase: mockSupabase,
      userId: 'artist-456',
      type: 'merch_order',
      title: 'New merch order: T-Shirt',
      body: 'A fan ordered (size M).',
    })

    const insertedRow = mockInsert.mock.calls[0]?.[0]
    expect(insertedRow?.body).toBeDefined()
    expect(EMAIL_PATTERN.test(insertedRow.body)).toBe(false)
  })

  it('batch notifications do not contain emails', async () => {
    const mockBatchInsert = jest.fn().mockResolvedValue({ error: null })
    const batchSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
        insert: mockBatchInsert,
      }),
    } as any

    await createNotificationBatch({
      supabase: batchSupabase,
      userIds: ['user-1', 'user-2'],
      type: 'new_release',
      title: 'New release from Artist',
      body: 'Artist released "Album Title"',
    })

    const rows = mockBatchInsert.mock.calls[0]?.[0] as any[]
    for (const row of rows ?? []) {
      expect(EMAIL_PATTERN.test(row.body ?? '')).toBe(false)
    }
  })
})
