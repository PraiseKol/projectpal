
# Fix Dynamic Credit Limits in Edge Functions and Settings Page

## Problem

The admin can update `default_daily_credits` and `default_monthly_credits` in the App Settings panel, which saves to the `app_settings` table. However, all 5 edge functions and the Settings page hardcode `8` (daily) and `40` (monthly) when resetting credits. So admin changes have no effect on actual credit allocation.

## Solution

Each edge function that resets credits needs to fetch the current defaults from `app_settings` before using them. The Settings page also needs to fetch these values.

## Files to Modify

| File | Hardcoded Values |
|------|-----------------|
| `supabase/functions/chat-ai/index.ts` | `dailyCredits = 8`, `monthlyCredits = 40`, `Math.min(8, ...)` |
| `supabase/functions/paraphrase-ai/index.ts` | `dailyCredits = 8`, `monthlyCredits = 40`, `Math.min(8, ...)` |
| `supabase/functions/questionnaire-ai/index.ts` | `dailyCredits = 8`, `monthlyCredits = 40`, `Math.min(8, ...)` |
| `supabase/functions/generate-ppt/index.ts` | `dailyCredits = 8` |
| `supabase/functions/rewrite-section/index.ts` | `dailyCredits = 8`, `daily_credits: 8` |
| `src/pages/Settings.tsx` | `8` used in `getSmartDailyCredits()` |

## Implementation

### In each edge function

Add a helper fetch early in the request (after auth, before credit logic) using the **service role client** (since `app_settings` RLS requires authenticated user but we need reliable access):

```typescript
// Fetch dynamic credit defaults from app_settings
const { data: settingsData } = await supabaseAdmin
  .from('app_settings')
  .select('key, value')
  .in('key', ['default_daily_credits', 'default_monthly_credits']);

let DEFAULT_DAILY = 8;
let DEFAULT_MONTHLY = 40;
settingsData?.forEach((s: { key: string; value: string }) => {
  if (s.key === 'default_daily_credits') DEFAULT_DAILY = parseInt(s.value) || 8;
  if (s.key === 'default_monthly_credits') DEFAULT_MONTHLY = parseInt(s.value) || 40;
});
```

Then replace all hardcoded `8` with `DEFAULT_DAILY` and `40` with `DEFAULT_MONTHLY`.

**Note:** Some edge functions (chat-ai, paraphrase-ai, questionnaire-ai) already create a user-scoped Supabase client. For the `app_settings` query, we need a **service role client** to avoid RLS issues (the existing user client should work since `app_settings` has a permissive SELECT policy for authenticated users, but service role is safer). For functions that already have a service role client (like those importing `SUPABASE_SERVICE_ROLE_KEY`), we use that. For others, we can use the user's authenticated client since the RLS policy on `app_settings` allows all authenticated reads.

### Specific changes per function

**chat-ai/index.ts (lines 220-246):**
- Replace `dailyCredits = 8` with `dailyCredits = DEFAULT_DAILY`
- Replace `monthlyCredits = 40` with `monthlyCredits = DEFAULT_MONTHLY`
- Replace `Math.min(8, monthlyCredits)` with `Math.min(DEFAULT_DAILY, monthlyCredits)`

**paraphrase-ai/index.ts (lines 68-85):**
- Replace `dailyCredits = 8` with `dailyCredits = DEFAULT_DAILY`
- Replace `monthlyCredits = 40` with `monthlyCredits = DEFAULT_MONTHLY`
- Replace `Math.min(8, monthlyCredits)` with `Math.min(DEFAULT_DAILY, monthlyCredits)`

**questionnaire-ai/index.ts (lines 80-88):**
- Replace `dailyCredits = 8` with `dailyCredits = DEFAULT_DAILY`
- Replace `monthlyCredits = 40` with `monthlyCredits = DEFAULT_MONTHLY`
- Replace `Math.min(8, monthlyCredits)` with `Math.min(DEFAULT_DAILY, monthlyCredits)`

**generate-ppt/index.ts (line 1525):**
- Replace `dailyCredits = 8` with `dailyCredits = DEFAULT_DAILY`

**rewrite-section/index.ts (lines 77-81):**
- Replace both `8` references with `DEFAULT_DAILY`

**Settings.tsx (lines 86-98):**
- Fetch `default_daily_credits` from `app_settings` (similar to how Dashboard.tsx already does)
- Use the fetched value instead of hardcoded `8` in `getSmartDailyCredits()`

### handle_new_user database function

The `handle_new_user()` trigger also hardcodes `monthly_credits = 40` and `daily_credits = 8`. This will be updated via a migration to read from `app_settings` dynamically using a subquery:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() ...
  -- Replace hardcoded values with:
  COALESCE((SELECT value::int FROM app_settings WHERE key = 'default_daily_credits'), 8)
  COALESCE((SELECT value::int FROM app_settings WHERE key = 'default_monthly_credits'), 40)
```

## Summary of All Changes

1. **5 edge functions** -- add `app_settings` lookup, replace hardcoded `8`/`40` with dynamic values
2. **Settings.tsx** -- fetch defaults from `app_settings` for smart credit display
3. **handle_new_user() DB trigger** -- use dynamic defaults from `app_settings` for new user creation
