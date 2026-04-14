-- Drop leftover tables from a prior project that previously used this Supabase instance.
drop table if exists public.matches cascade;
drop table if exists public.candidates cascade;
drop table if exists public.jobs cascade;
