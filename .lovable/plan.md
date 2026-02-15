
# Ambassador Page Updates and Referral Discount Feature

## 1. Copy Referral Code Button (Ambassador Page)

Add a "Copy Code" button next to the existing "Copy Referral Link" button in `src/pages/Ambassador.tsx`.

**File**: `src/pages/Ambassador.tsx`
- Add a `copyReferralCode` function that copies `referralCode.code` to clipboard
- Add a new `Button` next to the existing "Copy Referral Link" button

## 2. First-Time Referral Discount (5% off first subscription)

Users who have a referral code linked to their account (`referred_by` is set on their profile) get 5% off their **first** subscription payment only. Subsequent payments are full price.

### How "first time" is determined
- Check the `transactions` table for the user. If they have zero previous successful transactions, this is their first subscription -- apply 5% discount.

### Frontend: Pricing Page (`src/pages/Pricing.tsx`)
- On load, fetch the user's profile (`referred_by`) and transaction count
- If `referred_by` is set AND transaction count is 0, the user qualifies for a 5% referral discount
- Show a banner/badge on the pricing page: "5% referral discount applied to your first purchase!"
- In `openConfirmModal`, calculate the discounted price (`price * 0.95`) and pass the original + discounted prices
- In the confirmation modal, show the original price with a strikethrough and the discounted price
- Pass `referral_discount: true` and `original_amount` in the Paystack metadata so the backend knows
- Send the discounted amount (`price * 0.95 * 100`) to Paystack as the actual charge amount

### Backend: verify-payment (`supabase/functions/verify-payment/index.ts`)
- The `amount` from Paystack will already be the discounted amount (95% of original)
- The ambassador commission is 5% of the **amount actually paid**, so no special logic needed -- `Math.floor(amount * 0.05)` already works correctly on the discounted amount
- No changes needed to the commission calculation logic

### Backend: paystack-webhook (`supabase/functions/paystack-webhook/index.ts`)
- Same as verify-payment -- the amount from Paystack is already discounted, commission is 5% of what was paid
- No changes needed

### Summary of discount flow

```text
Normal payment (no referral):
  User pays: 10,000
  Ambassador commission: 500 (5% of 10,000)

First payment with referral discount:
  Original price: 10,000
  User pays: 9,500 (5% off)
  Ambassador commission: 475 (5% of 9,500)

Second payment (referral user, but not first time):
  User pays: 10,000 (full price)
  Ambassador commission: 500 (5% of 10,000)
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Ambassador.tsx` | Add "Copy Code" button next to "Copy Referral Link" |
| `src/pages/Pricing.tsx` | Fetch referral status + transaction count; apply 5% discount on first purchase; show discount in UI and confirmation modal |

No backend changes are needed -- the discount is applied at the Paystack payment amount level, and commission is already calculated as 5% of whatever was paid.
