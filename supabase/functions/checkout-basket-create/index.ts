import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { STANDARD_FEE_BPS, FOUNDING_ARTIST_FEE_BPS, SHIPPING_COUNTRIES } from '../_shared/constants.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const SITE_URL = Deno.env.get('SITE_URL') || 'https://getinsound.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type BasketRequestItem =
  | { type: 'release'; release_id: string; custom_amount?: number }
  | { type: 'merch'; merch_id: string; variant?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestItems: BasketRequestItem[] = body.items;
    const origin: string = body.origin || 'https://getinsound.com';
    const fanCurrency: string | undefined = body.fan_currency;
    const refCode: string | undefined = body.ref_code;

    if (!requestItems || !Array.isArray(requestItems) || requestItems.length === 0) {
      return json({ error: 'items array required' }, 400);
    }
    if (requestItems.length > 20) {
      return json({ error: 'Maximum 20 items per basket' }, 400);
    }

    // Default untyped items to 'release' for backwards compat
    for (const item of requestItems) {
      if (!(item as any).type) (item as any).type = 'release';
    }

    const releaseItems = requestItems.filter((i): i is Extract<BasketRequestItem, { type: 'release' }> => i.type === 'release');
    const merchItems = requestItems.filter((i): i is Extract<BasketRequestItem, { type: 'merch' }> => i.type === 'merch');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch releases ──
    let releases: any[] = [];
    if (releaseItems.length > 0) {
      const releaseIds = releaseItems.map(i => i.release_id);
      const { data, error: relErr } = await admin
        .from('releases')
        .select(`
          id, slug, title, price_pence, currency, cover_url, published, artist_id,
          preorder_enabled, release_date, pwyw_enabled, pwyw_minimum_pence,
          artists!inner ( id, slug, name )
        `)
        .in('id', releaseIds)
        .eq('published', true);

      if (relErr) return json({ error: relErr.message }, 500);
      if (!data || data.length === 0) return json({ error: 'No valid releases found' }, 404);

      const staleIds = releaseIds.filter(id => !data.find((r: any) => r.id === id));
      if (staleIds.length > 0) {
        return json({ error: 'Some items are no longer available', stale_ids: staleIds }, 400);
      }
      releases = data;
    }

    // ── Fetch merch ──
    let merchData: any[] = [];
    if (merchItems.length > 0) {
      const merchIds = merchItems.map(i => i.merch_id);
      const { data, error: merchErr } = await admin
        .from('merch')
        .select(`
          id, name, price, currency, postage, stock, variants, is_active, photos,
          artist_id, artists!inner ( id, slug, name )
        `)
        .in('id', merchIds)
        .eq('is_active', true);

      if (merchErr) return json({ error: merchErr.message }, 500);
      if (!data || data.length === 0) return json({ error: 'No valid merch found' }, 404);

      const staleIds = merchIds.filter(id => !data.find((m: any) => m.id === id));
      if (staleIds.length > 0) {
        return json({ error: 'Some merch items are no longer available', stale_ids: staleIds }, 400);
      }

      // Validate stock and variants
      for (const reqItem of merchItems) {
        const m = data.find((d: any) => d.id === reqItem.merch_id)!;
        if (m.stock <= 0) return json({ error: `${m.name} is sold out` }, 400);
        if (reqItem.variant && m.variants) {
          const variants = m.variants as string[];
          if (!variants.includes(reqItem.variant)) {
            return json({ error: `Invalid variant for ${m.name}` }, 400);
          }
        }
      }
      merchData = data;
    }

    // ── Resolve Stripe accounts for all artists ──
    const allArtistIds = [
      ...new Set([
        ...releases.map((r: any) => r.artist_id),
        ...merchData.map((m: any) => m.artist_id),
      ]),
    ];

    const { data: accounts, error: accErr } = await admin
      .from('artist_accounts')
      .select('id, stripe_account_id, stripe_onboarded')
      .in('id', allArtistIds);

    if (accErr) return json({ error: accErr.message }, 500);

    const accountMap = new Map<string, string>();
    for (const acc of accounts || []) {
      if (!acc.stripe_onboarded || !acc.stripe_account_id) {
        const rel = releases.find((r: any) => r.artist_id === acc.id);
        const mer = merchData.find((m: any) => m.artist_id === acc.id);
        const artistObj = rel
          ? (Array.isArray(rel.artists) ? rel.artists[0] : rel.artists)
          : (mer ? (Array.isArray(mer.artists) ? mer.artists[0] : mer.artists) : null);
        return json({ error: `${artistObj?.name || 'An artist'} has not finished setting up payouts yet.` }, 400);
      }
      accountMap.set(acc.id, acc.stripe_account_id);
    }

    // ── Founding Artist fee check (releases only) ──
    const releaseArtistIds = [...new Set(releases.map((r: any) => r.artist_id))];
    const foundingArtistMap = new Map<string, boolean>();
    for (const artistId of releaseArtistIds) {
      const { data: faFee } = await admin
        .rpc('get_founding_artist_fee', { p_artist_id: artistId })
        .maybeSingle();

      let hasFoundingDiscount = false;
      if (faFee?.is_founding) {
        const firstSale = faFee.first_sale_at;
        if (!firstSale || (Date.now() - new Date(firstSale).getTime()) < 365 * 24 * 60 * 60 * 1000) {
          hasFoundingDiscount = true;
        }
      }
      foundingArtistMap.set(artistId, hasFoundingDiscount);
    }

    // ── Build basket items for session record ──
    const basketItems: any[] = [];
    for (const reqItem of releaseItems) {
      const release = releases.find((r: any) => r.id === reqItem.release_id)!;
      let unitAmount = release.price_pence;
      if (release.pwyw_enabled && reqItem.custom_amount != null) {
        const minimum = release.pwyw_minimum_pence ?? release.price_pence;
        if (reqItem.custom_amount >= minimum && reqItem.custom_amount >= release.price_pence) {
          unitAmount = reqItem.custom_amount;
        }
      }
      if (!unitAmount || unitAmount < 200) {
        return json({ error: `Invalid price for ${release.title}` }, 400);
      }
      basketItems.push({
        type: 'release',
        release_id: release.id,
        artist_id: release.artist_id,
        amount_pence: unitAmount,
        stripe_account_id: accountMap.get(release.artist_id)!,
      });
    }
    for (const reqItem of merchItems) {
      const merch = merchData.find((m: any) => m.id === reqItem.merch_id)!;
      basketItems.push({
        type: 'merch',
        merch_id: merch.id,
        artist_id: merch.artist_id,
        amount_pence: merch.price,
        postage_pence: merch.postage,
        variant: reqItem.variant || null,
        stripe_account_id: accountMap.get(merch.artist_id)!,
      });
    }

    // ── Store basket session ──
    const { data: basketRow, error: basketErr } = await admin
      .from('basket_sessions')
      .insert({
        items: basketItems,
        fan_currency: fanCurrency || 'GBP',
        ref_code: refCode || null,
      })
      .select('id')
      .single();

    if (basketErr) return json({ error: 'Failed to create basket session' }, 500);

    // ── Create one Stripe session per artist ──
    // Stripe only supports a single transfer_data destination per payment,
    // so multi-artist baskets get one checkout per artist.
    const hasMerch = merchItems.length > 0;

    // Group line items and fees by artist
    interface ArtistGroup {
      artistId: string;
      artistName: string;
      stripeAccountId: string;
      lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
      applicationFee: number;
      hasReleases: boolean;
      hasMerch: boolean;
    }

    const artistGroups = new Map<string, ArtistGroup>();
    for (const artistId of allArtistIds) {
      const rel = releases.find((r: any) => r.artist_id === artistId);
      const mer = merchData.find((m: any) => m.artist_id === artistId);
      const artistObj = rel
        ? (Array.isArray(rel.artists) ? rel.artists[0] : rel.artists)
        : (mer ? (Array.isArray(mer.artists) ? mer.artists[0] : mer.artists) : null);
      artistGroups.set(artistId, {
        artistId,
        artistName: artistObj?.name || 'Artist',
        stripeAccountId: accountMap.get(artistId)!,
        lineItems: [],
        applicationFee: 0,
        hasReleases: false,
        hasMerch: false,
      });
    }

    // Assign release line items
    for (const reqItem of releaseItems) {
      const release = releases.find((r: any) => r.id === reqItem.release_id)!;
      const artist = Array.isArray(release.artists) ? release.artists[0] : release.artists;
      const group = artistGroups.get(release.artist_id)!;

      let unitAmount = release.price_pence;
      if (release.pwyw_enabled && reqItem.custom_amount != null) {
        const minimum = release.pwyw_minimum_pence ?? release.price_pence;
        if (reqItem.custom_amount >= minimum && reqItem.custom_amount >= release.price_pence) {
          unitAmount = reqItem.custom_amount;
        }
      }

      const bps = foundingArtistMap.get(release.artist_id) ? FOUNDING_ARTIST_FEE_BPS : STANDARD_FEE_BPS;
      group.applicationFee += Math.round((unitAmount * bps) / 10000);
      group.hasReleases = true;
      group.lineItems.push({
        quantity: 1,
        price_data: {
          currency: (fanCurrency || release.currency || 'GBP').toLowerCase(),
          unit_amount: unitAmount,
          product_data: {
            name: release.title,
            description: `by ${artist.name}`,
            images: release.cover_url ? [release.cover_url] : undefined,
          },
        },
      });
    }

    // Assign merch line items
    for (const reqItem of merchItems) {
      const merch = merchData.find((m: any) => m.id === reqItem.merch_id)!;
      const artist = Array.isArray(merch.artists) ? merch.artists[0] : merch.artists;
      const group = artistGroups.get(merch.artist_id)!;

      group.applicationFee += Math.round((merch.price * STANDARD_FEE_BPS) / 10000);
      group.hasMerch = true;
      const variant = reqItem.variant || null;
      const itemName = variant ? `${merch.name} (${variant})` : merch.name;
      const photos = (merch.photos as string[]) || [];

      group.lineItems.push({
        quantity: 1,
        price_data: {
          currency: (fanCurrency || merch.currency || 'GBP').toLowerCase(),
          unit_amount: merch.price,
          product_data: {
            name: itemName,
            description: `by ${artist.name}`,
            images: photos.length > 0 ? [photos[0]] : undefined,
          },
        },
      });

      if (merch.postage > 0) {
        group.lineItems.push({
          quantity: 1,
          price_data: {
            currency: (fanCurrency || merch.currency || 'GBP').toLowerCase(),
            unit_amount: merch.postage,
            product_data: { name: `Postage — ${itemName}` },
          },
        });
      }
    }

    // Create one Stripe session per artist group
    const sessions: { artist_name: string; client_secret: string; session_id: string; has_releases: boolean; has_merch: boolean }[] = [];

    for (const group of artistGroups.values()) {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'payment',
        ui_mode: 'embedded',
        redirect_on_completion: 'never',
        line_items: group.lineItems,
        payment_intent_data: {
          application_fee_amount: group.applicationFee,
          transfer_data: { destination: group.stripeAccountId },
          metadata: {
            type: 'basket',
            basket_session_id: basketRow.id,
            artist_id: group.artistId,
          },
        },
        metadata: {
          type: 'basket',
          basket_session_id: basketRow.id,
          artist_id: group.artistId,
          fan_currency: fanCurrency || 'GBP',
        },
      };

      if (group.hasMerch) {
        sessionParams.shipping_address_collection = {
          allowed_countries: SHIPPING_COUNTRIES as [string, ...string[]],
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      sessions.push({
        artist_name: group.artistName,
        client_secret: session.client_secret!,
        session_id: session.id,
        has_releases: group.hasReleases,
        has_merch: group.hasMerch,
      });
    }

    return json({
      sessions,
      has_merch: hasMerch,
      has_releases: releaseItems.length > 0,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
