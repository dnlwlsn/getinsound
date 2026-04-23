-- 0013_digital_content_consent.sql
-- Track when a fan consents to immediate digital content access,
-- waiving the 14-day cancellation right per Consumer Contracts Regulations 2013.

alter table public.purchases
  add column digital_content_consent_at timestamptz;
