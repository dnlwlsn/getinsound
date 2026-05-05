import type Stripe from 'npm:stripe@17';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function resolveStripeCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from('fan_profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!(existing as any).deleted) return profile.stripe_customer_id;
    } catch {}
    await admin
      .from('fan_profiles')
      .update({ stripe_customer_id: null })
      .eq('id', userId);
  }

  const existing = await stripe.customers.list({ email, limit: 1 });
  let customerId: string;

  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
  }

  await admin
    .from('fan_profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);

  return customerId;
}
