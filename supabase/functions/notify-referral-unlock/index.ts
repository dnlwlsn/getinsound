// DEPRECATED 2026-04-27: Zero-fees referral feature retired.
// This function is disabled. Kept for rollback safety.
// Will be deleted in a future cleanup pass.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  return new Response(JSON.stringify({ skipped: true, reason: 'zero-fees feature retired' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
