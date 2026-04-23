import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const PLATFORM_FEE_BPS = 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const merchId: string | undefined = body.merch_id;
    const variant: string | undefined = body.variant;
    const origin: string = body.origin || 'https://getinsound.com';
    const fanCurrency: string | undefined = body.fan_currency;
    const fanLocale: string | undefined = body.fan_locale;
    const fanId: string | undefined = body.fan_id;

    if (!merchId) return json({ error: 'merch_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: merch, error: merchErr } = await admin
      .from('merch')
      .select(`
        id, name, description, price, currency, postage, stock, variants, is_active, photos,
        artist_id, artists!inner ( id, slug, name )
      `)
      .eq('id', merchId)
      .eq('is_active', true)
      .maybeSingle();

    if (merchErr) return json({ error: merchErr.message }, 500);
    if (!merch) return json({ error: 'Merch item not found' }, 404);
    if (merch.stock <= 0) return json({ error: 'Item is sold out' }, 400);

    if (variant && merch.variants) {
      const variants = merch.variants as string[];
      if (!variants.includes(variant)) {
        return json({ error: 'Invalid variant' }, 400);
      }
    }

    const artist = Array.isArray(merch.artists) ? merch.artists[0] : merch.artists;

    const { data: account, error: accErr } = await admin
      .from('artist_accounts')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', merch.artist_id)
      .maybeSingle();
    if (accErr) return json({ error: accErr.message }, 500);

    if (!account?.stripe_onboarded || !account?.stripe_account_id) {
      return json({ error: 'This artist has not finished setting up payouts yet.' }, 400);
    }

    const itemAmount = merch.price;
    const postageAmount = merch.postage;
    const applicationFee = Math.round((itemAmount * PLATFORM_FEE_BPS) / 10000);

    const currency = (fanCurrency || merch.currency || 'GBP').toLowerCase();
    const photos = (merch.photos as string[]) || [];
    const itemName = variant ? `${merch.name} (${variant})` : merch.name;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      redirect_on_completion: 'never',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: itemAmount,
            product_data: {
              name: itemName,
              description: `by ${artist.name}`,
              images: photos.length > 0 ? [photos[0]] : undefined,
            },
          },
        },
        ...(postageAmount > 0 ? [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: postageAmount,
            product_data: {
              name: 'Postage',
            },
          },
        }] : []),
      ],
      shipping_address_collection: {
        allowed_countries: ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'SE', 'DK', 'NO', 'JP'],
      },
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: account.stripe_account_id },
        metadata: {
          type: 'merch',
          merch_id: merch.id,
          artist_id: merch.artist_id,
          ...(variant ? { variant } : {}),
          ...(fanId ? { fan_id: fanId } : {}),
        },
      },
      metadata: {
        type: 'merch',
        merch_id: merch.id,
        artist_id: merch.artist_id,
        fan_currency: fanCurrency || merch.currency || 'GBP',
        fan_locale: fanLocale || '',
        ...(variant ? { variant } : {}),
        ...(fanId ? { fan_id: fanId } : {}),
      },
    });

    return json({ client_secret: session.client_secret, session_id: session.id });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
