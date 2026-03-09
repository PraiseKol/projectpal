

# Plan: Halve All Prices

Single file change in `src/pages/Pricing.tsx` (lines 195-207). Halve both `price` and `originalPrice` for all base plans. The quarterly/yearly multipliers apply on top, so everything cascades automatically. The amount sent to Paystack is derived from these same values, so the backend charge updates automatically too.

## Changes

**`src/pages/Pricing.tsx` lines 195-207**

```typescript
const baseProPlans = [
  { price: 5000, credits: 120, originalPrice: 7500 },
  { price: 10000, credits: 240, originalPrice: 15000 },
  { price: 20000, credits: 480, originalPrice: 30000 },
  { price: 40000, credits: 960, originalPrice: 60000 },
];

const baseScholarPlans = [
  { price: 7500, credits: 120, originalPrice: 11250 },
  { price: 15000, credits: 240, originalPrice: 22500 },
  { price: 30000, credits: 480, originalPrice: 45000 },
  { price: 60000, credits: 960, originalPrice: 90000 },
];
```

No backend or edge function changes needed — the Paystack payment amount is constructed from these same price values on the frontend before being sent to the payment gateway, and the `verify-payment` function reads the actual charged amount from Paystack's response.

