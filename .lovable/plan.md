

# Plan: Fix Payment System and Add Ambassador Role Request Flow

## Problem Summary

1. **Payment "not configured"**: The Pricing page reads `VITE_PAYSTACK_PUBLIC_KEY` from `import.meta.env`, but this variable is NOT in the `.env` file. The Paystack public key is stored in the `app_settings` database table instead. The code checks if `paystackKey` is defined, finds it undefined, and shows "Payment system not configured".

2. **Ambassador Role Request**: Currently, ambassadors can only be assigned by admins through the admin panel. There's no way for users to request the role themselves, and no way for existing users to set a referral code from the Settings page.

---

## Fix 1: Payment System

**Root Cause**: Line 59 of `src/pages/Pricing.tsx`:
```typescript
const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
```
The `.env` file does not contain `VITE_PAYSTACK_PUBLIC_KEY`. The key exists in the `app_settings` table as `PAYSTACK_PUBLIC_KEY` with value `pk_test_c815d1b343e5d4087eeb23e833437334270ca6b6`.

**Fix**: Load the Paystack public key from the `app_settings` table on component mount, falling back to `import.meta.env.VITE_PAYSTACK_PUBLIC_KEY`.

**File: `src/pages/Pricing.tsx`**
- Replace the static env variable assignment with a `useState` + `useEffect` that queries `app_settings` for the key `PAYSTACK_PUBLIC_KEY`
- Fallback to `import.meta.env.VITE_PAYSTACK_PUBLIC_KEY` if the database lookup fails

---

## Fix 2: Ambassador Role Request System

### Database Changes

Create an `ambassador_requests` table to track role requests:

```sql
CREATE TABLE public.ambassador_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, status)
);

ALTER TABLE public.ambassador_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON public.ambassador_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests"
  ON public.ambassador_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON public.ambassador_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Admins can update requests
CREATE POLICY "Admins can update requests"
  ON public.ambassador_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
```

### Settings Page Changes

**File: `src/pages/Settings.tsx`**

Add two new sections:

1. **"Become an Ambassador" Card** - Shown to non-ambassador users:
   - A brief description of the ambassador program (earn 5% commission on referrals)
   - A "Request Ambassador Role" button that submits a request
   - Shows request status if already submitted (pending/approved/declined)

2. **"Referral Code" Card** - Shown to users who don't have a `referred_by` set:
   - An input field for entering a referral code
   - Validates the code against `referral_codes` table
   - A "Set Referral Code" button that permanently saves it to the profile's `referred_by` field and creates a referral record
   - Once set, shows the code as read-only with a "locked" indicator

### Ambassador Operations Edge Function

**File: `supabase/functions/ambassador-operations/index.ts`**

Add new actions:

- `requestAmbassadorRole`: Creates a record in `ambassador_requests` with status "pending"
- `getMyAmbassadorRequest`: Returns the user's current request status
- `setReferralCode`: Validates and permanently sets a referral code for the current user (updates `profiles.referred_by` and creates a `referrals` record)

### Admin Operations Edge Function

**File: `supabase/functions/admin-operations/index.ts`**

Add new actions:

- `getAmbassadorRequests`: Returns all pending ambassador requests for admin review
- `approveAmbassadorRequest`: Approves a request (adds ambassador role to `user_roles`, generates a referral code, updates request status)
- `declineAmbassadorRequest`: Declines a request with optional admin notes

### Admin Ambassador Management

**File: `src/components/Admin/AmbassadorManagement.tsx`**

Add a new sub-tab "Requests" that shows:
- List of pending ambassador role requests with user info
- Approve/Decline buttons for each request
- History of processed requests

### Dashboard Navigation

**File: `src/pages/Dashboard.tsx`**

The Ambassador button in the header is already conditionally shown for users with the ambassador role -- no changes needed here.

### Sign-up Form

**File: `src/pages/Auth.tsx`**

The referral code field already exists in the sign-up form -- no changes needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Pricing.tsx` | Load Paystack key from `app_settings` table |
| `src/pages/Settings.tsx` | Add Ambassador request card and Referral code card |
| `supabase/functions/ambassador-operations/index.ts` | Add `requestAmbassadorRole`, `getMyAmbassadorRequest`, `setReferralCode` actions |
| `supabase/functions/admin-operations/index.ts` | Add `getAmbassadorRequests`, `approveAmbassadorRequest`, `declineAmbassadorRequest` actions |
| `src/components/Admin/AmbassadorManagement.tsx` | Add "Requests" tab for admin review |
| **Database migration** | Create `ambassador_requests` table with RLS policies |

---

## Testing Checklist

1. Go to Pricing page and attempt a purchase -- verify payment modal opens (no "Payment system not configured" error)
2. Go to Settings as a regular user -- verify "Become an Ambassador" card appears with a request button
3. Submit an ambassador request and verify it shows as "Pending"
4. As admin, go to Admin > Ambassador Management and verify the request appears
5. Approve the request and verify the user now has the Ambassador button on their dashboard
6. As a user without a referral code set, verify the referral code input appears on Settings
7. Enter a valid referral code and verify it locks permanently
