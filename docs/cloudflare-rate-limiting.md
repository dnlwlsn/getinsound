# Cloudflare Rate Limiting — Setup Guide

## Rule: General API Rate Limit

- **Name:** API General Rate Limit
- **Matching URL:** `getinsound.com/api/*`
- **Rate:** 100 requests per minute per IP
- **Action:** Block (returns 429)
- **Response headers:** `Retry-After: 60`
- **Duration:** Block for 60 seconds

### Steps

1. Go to Cloudflare Dashboard → your zone → Security → WAF → Rate limiting rules
2. Create a new rule with the settings above
3. Test with: `for i in $(seq 1 110); do curl -s -o /dev/null -w "%{http_code}\n" https://getinsound.com/api/health; done`
4. Requests 101+ should return 429
