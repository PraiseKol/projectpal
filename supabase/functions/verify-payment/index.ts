import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    // Verify payment with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('Paystack verification error:', paystackResponse.status, errorText);
      throw new Error('Payment verification failed');
    }

    const paystackData = await paystackResponse.json();

    if (paystackData.data.status !== 'success') {
      return new Response(
        JSON.stringify({ error: 'Payment was not successful' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract metadata from payment
    const amount = paystackData.data.amount / 100; // Paystack returns amount in kobo
    const metadata = paystackData.data.metadata;
    const planType = metadata.plan_type;
    const creditsToAdd = metadata.credits;
    const durationDays = metadata.duration_days || 30; // Default to 30 days for legacy purchases
    const billingPeriod = metadata.billing_period || 'monthly';

    console.log(`Payment metadata: plan=${planType}, credits=${creditsToAdd}, duration=${durationDays} days, billing=${billingPeriod}`);

    // Get current profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // Calculate new paid credits with carry-over logic
    // Always carry over existing paid credits when a new subscription is made
    // (even if they had expired - the new subscription "revives" them)
    let currentPaidCredits = profile.paid_credits || 0;

    if (currentPaidCredits > 0) {
      const wasExpired = profile.credits_expiry_date 
        ? new Date(profile.credits_expiry_date) < new Date() 
        : false;
      console.log(`[CREDIT] Carrying over ${currentPaidCredits} existing paid credits${wasExpired ? ' (were expired, now revived)' : ''}`);
    }

    const newPaidCredits = currentPaidCredits + creditsToAdd;
    
    // Set/extend credits expiry date based on duration_days from metadata
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    console.log(`Payment verified. Adding ${creditsToAdd} credits. New total: ${newPaidCredits}. Expiry: ${expiryDate.toISOString()}`);

    // Update profile with new paid credits and plan
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        plan_type: planType,
        paid_credits: newPaidCredits,
        credits_expiry_date: expiryDate.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    // Save transaction record using service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        reference: reference,
        amount: amount,
        currency: paystackData.data.currency,
        plan_type: planType,
        credits_purchased: creditsToAdd,
        status: 'success',
        billing_period: billingPeriod,
        duration_days: durationDays
      });

    if (transactionError) {
      console.error('Failed to save transaction:', transactionError);
      // Don't fail the request if transaction logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        credits_added: creditsToAdd,
        new_plan: planType,
        new_paid_credits: newPaidCredits,
        credits_expiry_date: expiryDate.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-payment function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
