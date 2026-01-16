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

    if (profile.plan_type !== 'scholar') {
      return new Response(
        JSON.stringify({ error: 'Scholar plan required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;

    let dailyCredits = profile.daily_credits;
    let paidCredits = profile.paid_credits || 0;
    const creditsExpiryDate = profile.credits_expiry_date;

    // Check if paid credits have expired
    const paidCreditsExpired = creditsExpiryDate ? new Date(creditsExpiryDate) < new Date() : true;

    // Reset daily credits if needed
    if (needsDailyReset) {
      dailyCredits = 8;
    }

    // Credit deduction logic for Scholar users:
    // 1. Use daily credits first (free bonus)
    // 2. Then use paid credits (if not expired)
    
    let canProceed = false;
    let creditSource = '';

    if (dailyCredits > 0) {
      dailyCredits -= 1;
      canProceed = true;
      creditSource = 'daily';
    } else if (paidCredits > 0 && !paidCreditsExpired) {
      paidCredits -= 1;
      canProceed = true;
      creditSource = 'paid';
    }

    if (!canProceed) {
      const errorMessage = paidCreditsExpired 
        ? 'Your paid credits have expired. Please purchase more credits.'
        : 'Insufficient credits. Please purchase more credits.';
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Paraphrase credit deducted from: ${creditSource}. Daily: ${dailyCredits}, Paid: ${paidCredits}`);

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

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
    }

    return new Response(
      JSON.stringify({
        paraphrased_text: paraphrasedText,
        profile: {
          daily_credits: dailyCredits,
          paid_credits: paidCredits,
          credits_expiry_date: creditsExpiryDate,
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
