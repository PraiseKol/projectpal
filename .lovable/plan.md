
# Ambassador Auto-Removal, Re-Request, Dynamic Pricing Credits, and Claim Control

## 1. Auto-Remove Ambassadors Who Fail to Get 10 Referrals in 30 Days

### How it works
- A scheduled check runs whenever the ambassador-operations edge function is called (on any ambassador action), or via a dedicated admin action
- Actually, the cleanest approach: add a check in the `admin-operations` edge function as a new action `checkAmbassadorPerformance` that the admin can trigger manually, AND run the check automatically when the ambassador page loads (via ambassador-operations)
- Better approach: Add the check as part of the `getAmbassadorOverview` admin action so it runs automatically when admin views ambassadors. Also run it on a lightweight basis when any ambassador accesses their portal

### Logic
- For each user with the `ambassador` role, find when they were approved (from `ambassador_requests` table, `reviewed_at` field)
- Count referrals created since their approval date, in 30-day rolling windows
- If the current 30-day window (from approval date, rolling) has fewer than 10 referrals, remove the ambassador role
- Deactivate their referral code (`is_active = false`)
- Do NOT delete referral records or commission records -- historical data is preserved

### Files
- **`supabase/functions/admin-operations/index.ts`**: Add `checkAmbassadorPerformance` action that checks all ambassadors and removes underperformers
- **`supabase/functions/ambassador-operations/index.ts`**: On `getAmbassadorStats`, run a self-check for the current ambassador to warn them or handle removal

## 2. Allow Former Ambassadors to Re-Request

### Problem
The current `requestAmbassadorRole` action checks for existing pending requests but a declined user with a previous `declined` status can't re-request because `getMyAmbassadorRequest` returns the latest request (which is `declined`).

### Fix
- **`supabase/functions/ambassador-operations/index.ts`** (`requestAmbassadorRole`): Allow re-requests if the user no longer has the ambassador role and has no pending request. The current check already handles this -- it only blocks if there's an existing `pending` request or if they already have the role. But we need to make sure the UI shows the button again.
- **`src/components/Settings/AmbassadorRequestCard.tsx`**: If `requestStatus` is `declined` or if the user was removed (no ambassador role and latest request is `approved` but role was revoked), show the "Request Ambassador Role" button again. Specifically: if status is `declined` OR if the user has no ambassador role and no pending request, show the request button.

## 3. Dynamic Free Plan Credits on Pricing Page

### Problem
The pricing page hardcodes "8 credits per day" and "40 credits per month" for the free plan.

### Fix
- **`src/pages/Pricing.tsx`**: Fetch `default_daily_credits` and `default_monthly_credits` from the `app_settings` table on load. Use these values in:
  - The Free Plan card (lines 340-341)
  - The mobile plan comparison cards (lines 476-477)
  - The desktop comparison table (lines 635, 649-655)
  - The "How Credits Work" info section (line 801)

## 4. Admin Control for Ambassador Claim Button

### Setting
Add a new `app_setting`: `ambassador_claim_status` with values: `"open"`, `"closed"`, or `"coming_soon"`

### Admin UI
- **`src/components/Admin/AmbassadorManagement.tsx`**: Add a control card/section at the top of the ambassadors tab with 3-option selector (Open / Closed / Coming Soon) for claim status
- **`src/components/Admin/AppSettings.tsx`**: Add `ambassador_claim_status: "open"` to default settings

### Ambassador Page
- **`src/pages/Ambassador.tsx`**: Fetch `ambassador_claim_status` from `app_settings` on load
  - If `"closed"`: hide the claim commission section entirely
  - If `"coming_soon"`: show the section but replace the button with a disabled "Coming Soon" button
  - If `"open"` (default): show the claim button only when there's pending commission (current behavior)

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/admin-operations/index.ts` | Add `checkAmbassadorPerformance` action to auto-remove underperforming ambassadors |
| `supabase/functions/ambassador-operations/index.ts` | Add self-performance check; allow re-requests after removal |
| `src/components/Settings/AmbassadorRequestCard.tsx` | Show request button for declined/removed ambassadors |
| `src/pages/Pricing.tsx` | Fetch dynamic credit values from `app_settings` for free plan display |
| `src/components/Admin/AmbassadorManagement.tsx` | Add claim status control (open/closed/coming_soon) |
| `src/components/Admin/AppSettings.tsx` | Add `ambassador_claim_status` default |
| `src/pages/Ambassador.tsx` | Respect `ambassador_claim_status` setting for claim button visibility |

## Technical Details

### Ambassador Performance Check Logic (Edge Function)
```text
For each ambassador:
  1. Get approval date from ambassador_requests (reviewed_at where status = 'approved')
  2. Calculate current 30-day window start = max(approval_date, now - 30 days) 
     adjusted to align with 30-day periods from approval
  3. Count referrals in current window
  4. If count < 10:
     - DELETE from user_roles where user_id = X and role = 'ambassador'
     - UPDATE referral_codes SET is_active = false WHERE user_id = X
     - Do NOT delete from referrals or ambassador_commissions
```

### Re-Request Flow
```text
User removed from ambassador role
  -> Settings page: AmbassadorRequestCard sees no ambassador role
  -> getMyAmbassadorRequest returns latest request (status = "approved" from before)
  -> Since user is NOT currently an ambassador, show "Request Ambassador Role" button
  -> New request is inserted with status = "pending"
  -> Admin reviews and approves/declines
  -> If approved: role re-added, referral code re-activated (or new one generated)
```

### Claim Status Values
```text
"open"        -> Claim button visible when pending > 0
"closed"      -> Claim section hidden entirely  
"coming_soon" -> Claim section visible with disabled "Coming Soon" button
```
