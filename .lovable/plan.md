

# Plan: Update All "5%" References to "10%"

Six locations across 5 files still display the old 5% rate. All changes are text/comment updates only — the backend logic already uses `0.10`.

## Changes

### 1. `src/components/Settings/AmbassadorRequestCard.tsx`
- Line 56: `"Earn 5% commission..."` → `"Earn 10% commission..."`
- Line 71: `"Earn 5% commission on all subscriptions..."` → `"Earn 10% commission on all subscriptions..."`

### 2. `src/pages/Ambassador.tsx`
- Line 289: `"...earn 5% commission..."` → `"...earn 10% commission..."`
- Line 474: `"Your Earnings (5%)"` → `"Your Earnings (10%)"`

### 3. `src/pages/Auth.tsx`
- Line 701: `"Get 5% off your first..."` → `"Get 10% off your first 3 subscription upgrades..."`

### 4. `supabase/functions/verify-payment/index.ts`
- Line 187: Comment `"Calculate 5% commission"` → `"Calculate 10% commission"`

### 5. `supabase/functions/paystack-webhook/index.ts`
- Line 270: Comment `"Calculate 5% commission"` → `"Calculate 10% commission"`

No logic changes needed — all backend calculations already use `0.10`.

