import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const CODE_LENGTH = 32
const CODE_TTL_MS = 5 * 60 * 1000

export async function createTransferCode(userId: string): Promise<string> {
  const code = crypto.randomBytes(CODE_LENGTH).toString('hex')
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  await getAdminClient()
    .from('auth_transfer_codes')
    .insert({ code, user_id: userId, expires_at: expiresAt })

  return code
}

export async function redeemTransferCode(code: string): Promise<string | null> {
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('auth_transfer_codes')
    .update({ used: true })
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle()

  if (error || !data) return null
  return data.user_id
}
