

# Admin Page Updates and Overlay Improvements

## 1. Align FeatureGate Overlay with Maintenance Mode Style

**Problem**: The FeatureGate overlay has different opacity/styling than the maintenance mode overlay.

**Fix** in `src/components/FeatureGate.tsx`:
- Match the maintenance mode pattern: use a `fixed inset-0 z-50` overlay with `bg-background/80` backdrop (no wrapper div with opacity/blur on children since MaintenanceBanner doesn't wrap children either -- it's a standalone fixed overlay)
- The current FeatureGate wraps children with `opacity-30 blur-[1px]` which differs from MaintenanceBanner's approach. Align them to use the same `bg-background/80` fixed overlay style.

## 2. Replace "Back to Dashboard" with "Refresh to Check Status" on Maintenance Modal

**Fix** in `src/components/MaintenanceBanner.tsx`:
- Replace the `<Link to="/dashboard">Back to Dashboard</Link>` button with a "Refresh to Check Status" button that calls `window.location.reload()`

## 3. Fix "Adjust Credits" Not Reflecting on User's Dashboard

**Problem**: The edge function `adjustCredits` action correctly updates `daily_credits` or `paid_credits` in the profiles table. However, when adjusting "daily" credits, the admin is modifying the *remaining* daily credits for the current day -- but the user's dashboard uses `getSmartDailyCredits()` which may reset to the default on a new day. This is actually correct behavior. The real issue is likely that the admin sees the updated value but the user doesn't see it because the user's dashboard caches the profile on load and doesn't refetch.

Actually, looking more carefully: the `adjustCredits` action updates `daily_credits` or `paid_credits` directly on the profile. This should work. The user just needs to refresh their dashboard. This is expected behavior -- there's no real bug here except possible confusion. However, to make it clearer for admins, I'll add `monthly_credits` as a credit type option since that's also on the profile and relevant for free users.

**Fix** in `src/components/Admin/UserDetailModal.tsx`:
- Add "monthly" as a credit type option alongside "daily" and "paid"
- Update the edge function `adjustCredits` to handle `monthly` credit type

**Fix** in `supabase/functions/admin-operations/index.ts`:
- Add `monthly_credits` handling in the `adjustCredits` case

## 4. Set Expiry Date When Admin Changes Plan

**Problem**: When admin changes a user's plan via `updatePlan`, only `plan_type` is updated -- no `credits_expiry_date` is set.

**Fix** in `src/components/Admin/UserDetailModal.tsx`:
- Add an expiry date input (default: 30 days from now) in the Plan tab
- Pass the expiry date to the edge function

**Fix** in `supabase/functions/admin-operations/index.ts`:
- In the `updatePlan` action, also set `credits_expiry_date` based on the provided expiry date (default: 30 days from now if not specified)
- If changing to "free", clear the expiry date

## 5. Make Suspension Actually Block the User

**Problem**: The `toggleUserStatus` action updates `status` in the profiles table, but nothing on the frontend checks this status to block the user.

**Fix**: Create a new `SuspensionBanner` component (similar to `MaintenanceBanner`) that:
- On every route change, checks the current user's profile `status` field
- If `status === "suspended"`, shows a fixed unclosable modal overlay (matching maintenance style) stating "Your account has been suspended"
- Include a "Refresh to Check Status" button (same as maintenance)
- No data loss -- just an overlay preventing interaction

**New file**: `src/components/SuspensionBanner.tsx`

**Update** `src/App.tsx`:
- Add `<SuspensionBanner />` alongside `<MaintenanceBanner />`

## 6. Add Total Commission and Net Revenue Cards to Stats Overview

**Problem**: The overview is missing total commission and net revenue (revenue minus commission) cards.

**Fix** in `src/pages/Admin.tsx`:
- Fetch commission totals from the `getAmbassadorOverview` action (which already returns `totalCommissions`)
- Pass `totalCommission` to `StatsOverview`

**Fix** in `src/components/Admin/StatsOverview.tsx`:
- Add `totalCommission` to the stats prop interface
- Add two new cards:
  - "Total Commission" -- showing the total ambassador commission amount
  - "Net Revenue" -- showing `totalRevenue - totalCommission`

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/FeatureGate.tsx` | Align overlay style with maintenance mode |
| `src/components/MaintenanceBanner.tsx` | Replace "Back to Dashboard" with "Refresh to Check Status" |
| `src/components/Admin/UserDetailModal.tsx` | Add monthly credits type, add expiry date input for plan changes |
| `supabase/functions/admin-operations/index.ts` | Handle monthly credits in adjustCredits, set expiry date in updatePlan |
| `src/components/SuspensionBanner.tsx` | New component -- checks profile status and shows unclosable modal if suspended |
| `src/App.tsx` | Add SuspensionBanner |
| `src/pages/Admin.tsx` | Fetch and pass totalCommission to StatsOverview |
| `src/components/Admin/StatsOverview.tsx` | Add Total Commission and Net Revenue cards |

