

# Plan: Update Referral Discount to 10% for First 3 Plans + 10% Ambassador Commission

Currently: referred users get 5% off their **first** purchase only, ambassadors earn 5% commission. 

New: referred users get **10% off their first 3 purchases**, ambassadors earn **10% commission on every purchase** by referred users.

## Changes

### 1. `src/pages/Pricing.tsx` — Referred user discount (frontend)

**`checkReferralDiscount` function (lines 99-120):**
- Instead of checking if transaction count === 0 (first purchase only), check if count < 3
- Store the count so we can show "X of 3 discounted purchases remaining"

**`confirmPurchase` (line 152):**
- Change `0.95` to `0.90` (10% discount)

**Discount banner (line 339):**
- Update text: "10% referral discount applied! You have X of 3 discounted purchases remaining"

**Confirm modal (lines 1005-1022):**
- Change "5% off" label to "10% off"
- Change `0.95` to `0.90`

### 2. `supabase/functions/verify-payment/index.ts` — Ambassador commission (backend)

**Line 188:**
- Change commission from `0.05` (5%) to `0.10` (10%)
- Remove the referral-only gating — ambassador earns 10% on **every** transaction by referred users (already scoped to referred users via the referrals table lookup)

### 3. `supabase/functions/paystack-webhook/index.ts` — Same commission change

**handleChargeSuccess function (~line 230):**
- Change commission from `0.05` to `0.10`

### 4. `ambassador_commissions` table

- Update `commission_rate` default from `0.05` to `0.10` via migration

### Summary

| What | Before | After |
|------|--------|-------|
| Referred user discount | 5%, first purchase only | 10%, first 3 purchases |
| Ambassador commission | 5% | 10% |
| Commission scope | Every referred purchase | Every referred purchase (unchanged) |

