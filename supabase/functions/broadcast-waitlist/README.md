# broadcast-waitlist

Manually-triggered Supabase Edge Function that emails every row in `waitlist` (and optionally `waitlist_overflow`) via Resend.

## One-time setup

1. **Resend**
   - Create account at https://resend.com
   - Add and verify `getinsound.com` as a sending domain (adds SPF/DKIM DNS records to Cloudflare)
   - Create an API key — copy the `re_...` value

2. **Secrets** (from the repo root, with Supabase CLI linked to your project):
   ```bash
   supabase secrets set \
     RESEND_API_KEY=re_xxx \
     BROADCAST_SECRET="$(openssl rand -hex 32)" \
     BROADCAST_FROM='Dan at Insound <dan@getinsound.com>'
   ```
   Grab the `BROADCAST_SECRET` value — you'll need it to trigger the function. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the runtime.

3. **Deploy**
   ```bash
   supabase functions deploy broadcast-waitlist
   ```
   No Resend SDK to install — the function calls `api.resend.com` with `fetch`, which is all a Deno edge runtime needs.

4. **Migrate** (also creates the `waitlist_overflow` table from the earlier task)
   ```bash
   supabase db push
   ```

## Triggering the first broadcast

Always dry-run first. It returns the recipient count + first 10 addresses so you can sanity-check before sending anything.

```bash
PROJECT_REF=rvsfriqjobwuzzfdiyxg          # your project ref
BROADCAST_SECRET=paste-the-secret-here
ENDPOINT="https://${PROJECT_REF}.functions.supabase.co/broadcast-waitlist"

# Build the JSON payload from the HTML email file
HTML=$(jq -Rs . < supabase/functions/broadcast-waitlist/emails/001-founding-update.html)

# 1. DRY RUN — no email is sent, you just get the count
curl -sS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $BROADCAST_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"subject\": \"You're in. Here's where we are.\",
    \"html\": $HTML,
    \"dry_run\": true
  }" | jq .

# 2. Send to a single test address first
curl -sS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $BROADCAST_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"subject\": \"You're in. Here's where we are.\",
    \"html\": $HTML,
    \"limit\": 1
  }" | jq .

# 3. Real send to the whole waitlist
curl -sS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $BROADCAST_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"subject\": \"You're in. Here's where we are.\",
    \"html\": $HTML
  }" | jq .
```

Options in the POST body:
- `subject` (required)
- `html` (required)
- `text` (optional — auto-derived from HTML if omitted)
- `include_overflow` (bool — also send to `waitlist_overflow`)
- `limit` (int — cap recipients, useful for test sends)
- `dry_run` (bool — returns recipient count without sending)
- `from` (string — override the From header for this send)

The function de-dupes emails across both tables case-insensitively before sending.

## Admin UI path (later)

When you want a UI instead of curl:

1. Build a `/admin/broadcast` page in the Next.js app (gate behind your existing Supabase auth — check the session user is in an `admins` table or matches a hardcoded email).
2. The page is a form: subject, textarea for HTML, a "dry run" toggle, a recipient-count preview, and a big red "Send" button.
3. On submit, call the same edge function from the server side so the `BROADCAST_SECRET` never hits the browser. A Next.js route handler at `app/api/broadcast/route.ts` with `BROADCAST_SECRET` read from `process.env` is the minimum. The route forwards `{ subject, html, dry_run }` straight through.
4. Optional nicety: a dropdown that loads HTML files from `supabase/functions/broadcast-waitlist/emails/` so you pick a template instead of pasting.

Keep the function itself identical — it's already the API. The UI is just a nicer client for it.
