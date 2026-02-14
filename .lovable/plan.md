

# Plan: Switch Paystack to Live Keys

## Step 1: Update Live Secret Key

I'll request your **live secret key** (`sk_live_...`) using the secure secrets tool. This will update the `PAYSTACK_SECRET_KEY` used by the `verify-payment` and `paystack-webhook` backend functions.

## Step 2: Update Live Public Key

I'll request your **live public key** (`pk_live_...`) and update it in the `app_settings` database table, replacing the current test public key value.

## What You Need Ready

- Your Paystack **live secret key** (from Paystack Dashboard > Settings > API Keys & Webhooks)
- Your Paystack **live public key** (from the same page)

I'll prompt you securely for each key during implementation.

