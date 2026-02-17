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

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Please provide text to humanize' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (text.length > 50000) {
      return new Response(
        JSON.stringify({ error: 'Text is too long. Maximum 50,000 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('daily_credits, monthly_credits, paid_credits, plan_type, credits_expiry_date, daily_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch dynamic credit cost from app_settings
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .in('key', ['credit_cost_humanizer', 'default_daily_credits', 'default_monthly_credits']);

    let creditCost = 5;
    let DEFAULT_DAILY = 8;
    let DEFAULT_MONTHLY = 40;

    settingsData?.forEach((s: { key: string; value: string }) => {
      if (s.key === 'credit_cost_humanizer') {
        const v = parseInt(s.value);
        if (!isNaN(v) && v > 0) creditCost = v;
      }
      if (s.key === 'default_daily_credits') DEFAULT_DAILY = parseInt(s.value) || 8;
      if (s.key === 'default_monthly_credits') DEFAULT_MONTHLY = parseInt(s.value) || 40;
    });

    // Handle daily reset
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;
    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits || 0;

    const paidCreditsExpired = profile.credits_expiry_date
      ? new Date(profile.credits_expiry_date) < new Date()
      : true;
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;

    if (needsDailyReset) {
      if (isActiveSubscriber) {
        dailyCredits = DEFAULT_DAILY;
      } else {
        const lastResetMonth = profile.daily_reset_date ? new Date(profile.daily_reset_date).getMonth() : -1;
        const currentMonth = new Date().getMonth();
        if (lastResetMonth !== currentMonth) {
          monthlyCredits = DEFAULT_MONTHLY;
        }
        dailyCredits = monthlyCredits > 0 ? Math.min(DEFAULT_DAILY, monthlyCredits) : 0;
      }
    }

    // Check credits
    const totalAvailable = isActiveSubscriber
      ? dailyCredits + paidCredits
      : Math.min(dailyCredits, monthlyCredits);

    if (totalAvailable < creditCost) {
      return new Response(
        JSON.stringify({
          error: `This action requires ${creditCost} credits. You have ${totalAvailable} credits remaining.`,
          credits_required: creditCost,
          credits_available: totalAvailable,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert text humanizer. Your job is to rewrite the given text so that it reads as naturally human-written as possible, while preserving the original meaning, facts, and academic quality.

RULES:
1. Vary sentence lengths naturally — mix short punchy sentences with longer, more complex ones.
2. Use natural transitions and connectors: "However,", "That said,", "Interestingly,", "It's worth noting that", "On the other hand,", "In a similar vein,".
3. Avoid repetitive sentence starters — don't begin consecutive sentences with the same word or structure.
4. Replace overly formal or robotic phrasing with more natural academic alternatives. For example:
   - "It is important to note that" → "Notably," or "What stands out here is"
   - "This study aims to" → "The goal here is to" or "This research sets out to"
   - "Furthermore" (overused) → "Beyond that," or "Adding to this,"
5. Add subtle hedging language where appropriate: "tends to," "appears to," "it seems," "arguably," "in many cases."
6. Introduce minor stylistic variations — occasionally use rhetorical questions, em dashes, or parenthetical asides.
7. Maintain the SAME factual content, citations, references, and technical terms exactly as they are. Do NOT alter any citations, author names, dates, statistics, or quoted material.
8. Keep approximately the same word count (within 10%).
9. Preserve paragraph structure and logical flow.
10. Do NOT add new information or remove existing content.
11. Do NOT use markdown formatting symbols (no #, ##, **, ***). Write in plain text.
12. The output should feel like it was written by a thoughtful human academic, not generated by AI.

Return ONLY the humanized text, nothing else.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI service error');
    }

    const aiData = await aiResponse.json();
    const humanizedText = aiData.choices?.[0]?.message?.content || '';

    // Deduct credits
    if (isActiveSubscriber) {
      if (dailyCredits >= creditCost) {
        dailyCredits -= creditCost;
      } else {
        const remaining = creditCost - dailyCredits;
        dailyCredits = 0;
        paidCredits -= remaining;
      }
    } else {
      dailyCredits -= creditCost;
      monthlyCredits -= creditCost;
    }

    await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        monthly_credits: monthlyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        humanizedText,
        credits_used: creditCost,
        profile: {
          daily_credits: dailyCredits,
          monthly_credits: monthlyCredits,
          paid_credits: paidCredits,
          credits_expiry_date: profile.credits_expiry_date,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('humanize-text error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
