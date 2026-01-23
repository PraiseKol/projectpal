import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

// Define plan hierarchy (higher number = better plan)
const PLAN_HIERARCHY: Record<string, number> = {
  'free': 1,
  'pro': 2,
  'scholar': 3
};

function shouldUpdatePlan(currentPlan: string, newPlan: string, currentExpiry: string | null): boolean {
  const now = new Date();
  const expiryDate = currentExpiry ? new Date(currentExpiry) : null;
  
  // If no current subscription or expired, always update to new plan
  if (!expiryDate || expiryDate < now) {
    return true;
  }
  
  // If current subscription is active, only upgrade (never downgrade)
  const currentRank = PLAN_HIERARCHY[currentPlan] || 1;
  const newRank = PLAN_HIERARCHY[newPlan] || 1;
  
  return newRank >= currentRank;
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Verify Paystack webhook signature
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // Get signature from header
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      console.error('No signature provided');
      return new Response('No signature', { status: 401 });
    }

    // Get raw body for signature verification
    const body = await req.text();
    
    // Verify signature
    const isValid = await verifySignature(body, signature, PAYSTACK_SECRET_KEY);
    if (!isValid) {
      console.error('Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse event
    const event = JSON.parse(body);
    console.log(`Received Paystack webhook: ${event.event}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(supabaseAdmin, event.data);
        break;
      
      case 'subscription.create':
        console.log('Subscription created:', event.data.subscription_code);
        break;
      
      case 'subscription.disable':
        console.log('Subscription disabled:', event.data.subscription_code);
        break;
      
      case 'invoice.payment_failed':
        console.log('Payment failed for invoice:', event.data.invoice_code);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    // Paystack expects 200 OK
    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Paystack from retrying on parse errors
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});

async function handleChargeSuccess(supabase: any, data: any) {
  const reference = data.reference;
  const amount = data.amount / 100; // Convert from kobo
  const customerEmail = data.customer?.email;
  const metadata = data.metadata || {};
  
  console.log(`Processing charge.success: ref=${reference}, email=${customerEmail}, amount=${amount}`);

  if (!customerEmail) {
    console.error('No customer email in webhook data');
    return;
  }

  // Check for idempotency - if this reference was already processed
  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id')
    .eq('reference', reference)
    .single();

  if (existingTransaction) {
    console.log(`Transaction ${reference} already processed, skipping`);
    return;
  }

  // Find user by email
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error('Error listing users:', userError);
    return;
  }

  const user = userData.users.find((u: any) => u.email === customerEmail);
  if (!user) {
    console.error(`No user found with email: ${customerEmail}`);
    return;
  }

  const userId = user.id;
  console.log(`Found user ${userId} for email ${customerEmail}`);

  // Extract metadata
  const planType = metadata.plan_type || 'pro';
  const creditsToAdd = metadata.credits || 0;
  const durationDays = metadata.duration_days || 30;
  const billingPeriod = metadata.billing_period || 'monthly';

  console.log(`Metadata: plan=${planType}, credits=${creditsToAdd}, duration=${durationDays} days`);

  // Get current profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return;
  }

  // Calculate new paid credits with carry-over
  let currentPaidCredits = profile.paid_credits || 0;
  if (currentPaidCredits > 0) {
    const wasExpired = profile.credits_expiry_date 
      ? new Date(profile.credits_expiry_date) < new Date() 
      : false;
    console.log(`Carrying over ${currentPaidCredits} existing paid credits${wasExpired ? ' (were expired, now revived)' : ''}`);
  }

  const newPaidCredits = currentPaidCredits + creditsToAdd;
  
  // Set expiry date
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + durationDays);

  // Determine if we should update the plan type (prevent downgrades)
  const shouldUpdatePlanType = shouldUpdatePlan(
    profile.plan_type, 
    planType, 
    profile.credits_expiry_date
  );

  const finalPlanType = shouldUpdatePlanType ? planType : profile.plan_type;

  console.log(`Plan decision: current=${profile.plan_type}, requested=${planType}, final=${finalPlanType}, shouldUpdate=${shouldUpdatePlanType}`);
  console.log(`Updating profile: adding ${creditsToAdd} credits. New total: ${newPaidCredits}. Expiry: ${expiryDate.toISOString()}`);

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      plan_type: finalPlanType,
      paid_credits: newPaidCredits,
      credits_expiry_date: expiryDate.toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating profile:', updateError);
    return;
  }

  // Save transaction record
  const { data: transactionData, error: transactionError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      reference: reference,
      amount: amount,
      currency: data.currency || 'NGN',
      plan_type: planType,
      credits_purchased: creditsToAdd,
      status: 'success',
      billing_period: billingPeriod,
      duration_days: durationDays
    })
    .select()
    .single();

  if (transactionError) {
    console.error('Failed to save transaction:', transactionError);
  } else {
    console.log(`Successfully processed payment ${reference} for user ${userId}`);

    // Check if this user was referred by an ambassador
    const { data: referral } = await supabase
      .from('referrals')
      .select('ambassador_user_id')
      .eq('referred_user_id', userId)
      .maybeSingle();

    if (referral && transactionData) {
      // Calculate 5% commission
      const commissionAmount = Math.floor(amount * 0.05);
      
      console.log(`User ${userId} was referred by ambassador ${referral.ambassador_user_id}. Adding commission of ${commissionAmount}`);
      
      // Insert commission record
      const { error: commissionError } = await supabase
        .from('ambassador_commissions')
        .insert({
          ambassador_user_id: referral.ambassador_user_id,
          transaction_id: transactionData.id,
          referred_user_id: userId,
          transaction_amount: Math.round(amount),
          commission_amount: commissionAmount
        });

      if (commissionError) {
        console.error('Failed to create commission record:', commissionError);
      }
    }
  }
}