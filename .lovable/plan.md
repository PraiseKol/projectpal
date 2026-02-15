
# Admin Page Improvements

## 1. Credit Configuration - Make It Effective on Dashboard

**Problem**: The dashboard hardcodes `/8` daily credits and `/40` monthly credits. When an admin changes these values in Settings, users still see the old hardcoded numbers.

**Fix**: 
- Update `src/pages/Dashboard.tsx` to fetch `default_daily_credits` and `default_monthly_credits` from the `app_settings` table on load
- Replace all hardcoded `8` and `40` references with the fetched values
- The `getSmartDailyCredits()` function currently uses hardcoded `8` -- this will use the admin-configured value instead
- The display strings like `/8` and `/40` will become dynamic

**Files changed**: `src/pages/Dashboard.tsx`

---

## 2. Maintenance Mode & Feature Gate - Locked Dashboard with Modal Overlay

**Problem**: Currently, maintenance mode shows a blank "Under Maintenance" screen, and disabled features show a blank "Feature Unavailable" screen. You want users to see the actual page behind a locked overlay with an unclosable modal.

**Fix for Maintenance Mode** (`src/components/MaintenanceBanner.tsx`):
- Instead of rendering a full-screen block, render the children (the normal page) with a fixed overlay on top
- The overlay will have a semi-transparent backdrop and an unclosable dialog (no X button, no click-outside-to-close) explaining maintenance is active
- Admins continue to see just the yellow banner as before

Since `MaintenanceBanner` is rendered in `App.tsx` separately from the routes (not wrapping them), the approach will change: convert it into a layout wrapper or use a fixed-position modal overlay that sits on top of the entire app.

**Fix for Feature Gate** (`src/components/FeatureGate.tsx`):
- When a feature is disabled, render the children (the actual page) underneath
- Overlay with a fixed, unclosable modal stating the feature is disabled by the administrator
- The page behind will be visible but not interactive (pointer-events: none)

**Files changed**: `src/components/MaintenanceBanner.tsx`, `src/components/FeatureGate.tsx`

---

## 3. Questionnaire Builder Feature Flag

**Problem**: No feature flag exists for the Questionnaire Builder, so admins cannot toggle it on/off.

**Fix**:
- Add `feature_questionnaire_builder_enabled: "true"` to the default settings in `src/components/Admin/AppSettings.tsx`
- Add a toggle switch for "Questionnaire Builder" in the Feature Flags section of AppSettings
- Wrap the `/questionnaire-builder` route with `FeatureGate feature="questionnaire_builder"` in `src/App.tsx`

**Files changed**: `src/components/Admin/AppSettings.tsx`, `src/App.tsx`

---

## 4. Role Management - Search in Assign Dialog + Grouped Sections

**Problem**: The "Assign Role" dialog has a Select dropdown for users, making it hard to find users in a long list. Also, the roles list mixes all role types together.

**Fix - Search in Assign Dialog**:
- Replace the user Select dropdown in the assign role dialog with a searchable input + filtered list (using the existing `Input` component)
- Users can type a name or email to filter the list, then click to select

**Fix - Grouped Role Sections**:
- Instead of one flat table of all roles, group them into sections: "Super Admins", "Admins", "Ambassadors", "Moderators"
- Each section has its own heading and list of users with that role
- Empty sections are hidden

**Files changed**: `src/components/Admin/RoleManagement.tsx`

---

## 5. Activity Section - Limit to Latest 100

**Problem**: The activity feed currently fetches up to 50 items per category from the edge function. You want a total cap of the latest 100 across all activity types.

**Fix**:
- In `src/components/Admin/ActivityMonitor.tsx`, change the `.slice(0, 50)` to `.slice(0, 100)` for the unified feed
- In the edge function `supabase/functions/admin-operations/index.ts`, the `getRecentActivity` action already takes a `limit` parameter (default 50). Update the default to a higher number (e.g., 50 per category) so the combined and sorted list can produce 100 total items. The frontend will cap at 100.

**Files changed**: `src/components/Admin/ActivityMonitor.tsx`

---

## Summary of All Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Fetch app_settings for daily/monthly credit defaults; replace hardcoded 8 and 40 |
| `src/components/MaintenanceBanner.tsx` | Show locked page + unclosable modal instead of blank screen |
| `src/components/FeatureGate.tsx` | Show locked page + unclosable modal instead of blank screen |
| `src/components/Admin/AppSettings.tsx` | Add questionnaire_builder feature flag toggle |
| `src/App.tsx` | Wrap questionnaire-builder route with FeatureGate |
| `src/components/Admin/RoleManagement.tsx` | Add search to assign dialog; group roles by type into sections |
| `src/components/Admin/ActivityMonitor.tsx` | Change activity feed cap from 50 to 100 |
