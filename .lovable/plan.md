
# Admin Page Fixes

## Problem Summary
1. **Total Users shows "1"**: The `profiles` table has RLS policies that only let users see their own profile. When the admin page queries profiles from the browser, it only gets 1 row (the admin's own). The actual count is 9 users (5 free, 4 scholar).
2. **Email Campaigns empty**: No campaigns exist in the `email_campaigns` table. The weekly digest emails are sent automatically via a scheduled job (pg_cron every Friday at 11 AM UTC) that calls the `send-newsletter` function directly -- these are not stored as campaigns in the table. To see them here, you would need to create campaigns through this interface.
3. **Maintenance mode and feature flags don't actually do anything**: The toggles save values to the database, but no part of the app reads these settings to block access or show a maintenance banner.
4. **Settings save correctly**: The `app_settings` table has a unique constraint on `key` and the edge function uses upsert, so saving works. The credit/toggle values persist properly.

## Plan

### 1. Fix User Count -- Fetch Profiles via Edge Function (Critical)

**File: `supabase/functions/admin-operations/index.ts`**
- Add a new action `getAllProfiles` that fetches all profiles using the service role key (bypasses RLS)
- Returns the full list of profiles

**File: `src/pages/Admin.tsx`**
- Replace the direct `supabase.from("profiles").select("*")` call with `callAdminOperation("getAllProfiles")`
- This ensures the admin sees all 9 users (and future users) instead of just 1

### 2. Enforce Maintenance Mode Across the App

**File: `src/components/MaintenanceBanner.tsx`** (new)
- Create a banner component that reads the `maintenance_mode` setting from `app_settings`
- When enabled, shows a prominent banner at the top of every page: "The app is currently under maintenance. Some features may be unavailable."

**File: `src/App.tsx`**
- Add the `MaintenanceBanner` component inside the router so it appears on all pages
- For non-admin users, when maintenance mode is on, block access to feature pages and show a maintenance page instead

### 3. Enforce Feature Flags on Feature Pages

**File: `src/hooks/useAppSettings.ts`** (new)
- Create a reusable hook that fetches and caches `app_settings` values
- Returns settings like `isFeatureEnabled("chat")`, `isMaintenanceMode()`, etc.

**File: `src/pages/Chat.tsx`, `src/pages/Paraphraser.tsx`, `src/pages/DataAnalysis.tsx`, `src/pages/DocumentEditor.tsx`**
- Each page checks its corresponding feature flag using the hook
- If disabled, show a message: "This feature is currently unavailable" instead of the normal content

### 4. Email Campaign Explanation and Improvements

**How the email system currently works:**
- A scheduled job (pg_cron) runs every Friday at 11 AM UTC
- It calls the `send-newsletter` edge function which sends personalized weekly digest emails to all users who haven't unsubscribed
- These scheduled emails are NOT tracked as campaigns in the `email_campaigns` table -- they run independently

**What this means:**
- The Email Campaigns tab is for creating and sending ad-hoc/manual campaigns (marketing blasts, announcements, etc.)
- The weekly digest is a separate automated system
- No manual campaigns have been created yet, which is why the table is empty

No code changes needed for email campaigns -- the functionality is already working correctly for creating, previewing, sending, and deleting campaigns.

### 5. Verify Transactions Section
The transactions section queries directly from the `transactions` table with an RLS policy that allows admins to view all transactions. This should work correctly already. No changes needed.

## Technical Details

### New Edge Function Action: `getAllProfiles`
```
case "getAllProfiles": {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  result = { profiles: data };
  break;
}
```

### New Hook: `useAppSettings`
- Fetches all rows from `app_settings` on mount
- Provides helper functions: `getSetting(key)`, `isMaintenanceMode`, `isFeatureEnabled(feature)`
- Caches with a 60-second stale time to avoid excessive queries

### Files to Create
- `src/hooks/useAppSettings.ts` -- reusable settings hook
- `src/components/MaintenanceBanner.tsx` -- maintenance mode banner

### Files to Modify
- `supabase/functions/admin-operations/index.ts` -- add `getAllProfiles` action
- `src/pages/Admin.tsx` -- use edge function for profiles instead of direct query
- `src/App.tsx` -- add maintenance banner
- `src/pages/Chat.tsx` -- add feature flag check
- `src/pages/Paraphraser.tsx` -- add feature flag check
- `src/pages/DataAnalysis.tsx` -- add feature flag check
- `src/pages/DocumentEditor.tsx` -- add feature flag check
