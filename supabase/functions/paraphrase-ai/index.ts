import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_USER_WORD_LIMIT = 120;
const FREE_USER_DAILY_LIMIT = 1;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
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

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;

    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits || 0;
    let dailyParaphraseCount = profile.daily_paraphrase_count || 0;
    const creditsExpiryDate = profile.credits_expiry_date;

    // Check if subscription has expired
    const paidCreditsExpired = creditsExpiryDate ? new Date(creditsExpiryDate) < new Date() : true;
    
    // Determine user type
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;
    const isFreeUser = profile.plan_type === 'free' || paidCreditsExpired;

    // Enhanced logging
    console.log(`[PARAPHRASE] User: ${user.id}, Plan: ${profile.plan_type}`);
    console.log(`[PARAPHRASE] Before - Daily: ${profile.daily_credits}, Monthly: ${profile.monthly_credits}, Paid: ${profile.paid_credits}`);
    console.log(`[PARAPHRASE] Daily Paraphrase Count: ${dailyParaphraseCount}, Needs Reset: ${needsDailyReset}`);
    console.log(`[PARAPHRASE] Is Free User: ${isFreeUser}, Active Subscriber: ${isActiveSubscriber}`);

    // Reset daily counts if new day
    if (needsDailyReset) {
      dailyParaphraseCount = 0;
      
      if (isActiveSubscriber) {
        dailyCredits = 8;
        console.log(`[PARAPHRASE] Daily credits reset to 8`);
      } else {
        // Free/expired users
        const lastResetMonth = profile.daily_reset_date ? new Date(profile.daily_reset_date).getMonth() : -1;
        const currentMonth = new Date().getMonth();
        
        if (lastResetMonth !== currentMonth) {
          monthlyCredits = 40;
          console.log(`[PARAPHRASE] New month - Monthly credits reset to 40`);
        }
        
        if (monthlyCredits > 0) {
          dailyCredits = Math.min(8, monthlyCredits);
        } else {
          dailyCredits = 0;
        }
      }
    }

    // Word count check for free users
    const wordCount = text.trim().split(/\s+/).length;
    if (isFreeUser && wordCount > FREE_USER_WORD_LIMIT) {
      console.log(`[PARAPHRASE] Free user exceeded word limit: ${wordCount} > ${FREE_USER_WORD_LIMIT}`);
      return new Response(
        JSON.stringify({ 
          error: `Free users are limited to ${FREE_USER_WORD_LIMIT} words. Your text has ${wordCount} words. Please upgrade for unlimited paraphrasing.`,
          word_limit_exceeded: true,
          word_count: wordCount,
          word_limit: FREE_USER_WORD_LIMIT
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Daily limit check for free users
    if (isFreeUser && dailyParaphraseCount >= FREE_USER_DAILY_LIMIT) {
      console.log(`[PARAPHRASE] Free user hit daily limit: ${dailyParaphraseCount} >= ${FREE_USER_DAILY_LIMIT}`);
      return new Response(
        JSON.stringify({ 
          error: 'Free users can only paraphrase once per day. Come back tomorrow or upgrade for unlimited access!',
          daily_limit_reached: true,
          daily_count: dailyParaphraseCount,
          daily_limit: FREE_USER_DAILY_LIMIT
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credit deduction logic - 2 credits per paraphrase
    const paraphraseCost = 2;
    let canProceed = false;
    let creditSource = '';

    if (isActiveSubscriber) {
      // Active subscribers: daily credits → paid credits
      if (dailyCredits >= paraphraseCost) {
        dailyCredits -= paraphraseCost;
        canProceed = true;
        creditSource = 'daily';
      } else if (dailyCredits > 0 && paidCredits >= (paraphraseCost - dailyCredits)) {
        const fromPaid = paraphraseCost - dailyCredits;
        dailyCredits = 0;
        paidCredits -= fromPaid;
        canProceed = true;
        creditSource = 'daily+paid';
      } else if (paidCredits >= paraphraseCost) {
        paidCredits -= paraphraseCost;
        canProceed = true;
        creditSource = 'paid';
      }
    } else {
      // Free users: use daily credits from monthly pool
      if (dailyCredits >= paraphraseCost && monthlyCredits >= paraphraseCost) {
        dailyCredits -= paraphraseCost;
        monthlyCredits -= paraphraseCost;
        canProceed = true;
        creditSource = 'daily (from monthly pool)';
      }
    }

    if (!canProceed) {
      console.log(`[PARAPHRASE] Insufficient credits`);
      return new Response(
        JSON.stringify({ error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PARAPHRASE] Deducted ${paraphraseCost} credits from: ${creditSource}. After - Daily: ${dailyCredits}, Monthly: ${monthlyCredits}, Paid: ${paidCredits}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a paraphrasing assistant. Rewrite the given text while maintaining its meaning, using different words and sentence structures. Maintain academic tone and clarity.',
          },
          { role: 'user', content: `Paraphrase this text:\n\n${text}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const paraphrasedText = aiData.choices[0].message.content;

    await supabaseClient.from('paraphrase_logs').insert({
      user_id: user.id,
      input_text: text,
      output_text: paraphrasedText,
    });

    // Update profile with new credits and paraphrase count
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        monthly_credits: monthlyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
        daily_paraphrase_count: isFreeUser ? dailyParaphraseCount + 1 : profile.daily_paraphrase_count,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
    }

    return new Response(
      JSON.stringify({
        paraphrased_text: paraphrasedText,
        can_export: !isFreeUser, // Free users cannot export
        word_count: wordCount,
        profile: {
          daily_credits: dailyCredits,
          monthly_credits: monthlyCredits,
          paid_credits: paidCredits,
          credits_expiry_date: creditsExpiryDate,
          daily_paraphrase_count: isFreeUser ? dailyParaphraseCount + 1 : profile.daily_paraphrase_count,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in paraphrase-ai function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
