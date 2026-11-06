import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let EXPORT_COST = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('plan_type, daily_credits, monthly_credits, paid_credits, daily_reset_date, credits_expiry_date')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    // Fetch dynamic credit defaults AND export cost
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .in('key', ['default_daily_credits', 'default_monthly_credits', 'credit_cost_questionnaire_export']);

    // Override export cost from app_settings if set
    const exportCostSetting = settingsData?.find((s: { key: string; value: string }) => s.key === 'credit_cost_questionnaire_export');
    if (exportCostSetting) {
      const dynamicCost = parseInt(exportCostSetting.value);
      if (!isNaN(dynamicCost) && dynamicCost > 0) {
        EXPORT_COST = dynamicCost;
        console.log(`[EXPORT] Dynamic cost from app_settings: ${EXPORT_COST}`);
      }
    }

    let DEFAULT_DAILY = 8;
    let DEFAULT_MONTHLY = 40;
    settingsData?.forEach((s: { key: string; value: string }) => {
      if (s.key === 'default_daily_credits') DEFAULT_DAILY = parseInt(s.value) || 8;
      if (s.key === 'default_monthly_credits') DEFAULT_MONTHLY = parseInt(s.value) || 40;
    });

    // Credit handling
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;
    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits || 0;
    const paidCreditsExpired = profile.credits_expiry_date ? new Date(profile.credits_expiry_date) < new Date() : true;
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;

    // Exporting a questionnaire is a Scholar feature: free users and expired plans can build and preview only
    if (!isActiveSubscriber) {
      return new Response(
        JSON.stringify({ error: 'Exporting questionnaires is available on the Scholar plan.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (needsDailyReset) {
      if (isActiveSubscriber) {
        dailyCredits = DEFAULT_DAILY;
      } else {
        const lastResetMonth = profile.daily_reset_date ? new Date(profile.daily_reset_date).getMonth() : -1;
        const currentMonth = new Date().getMonth();
        if (lastResetMonth !== currentMonth) monthlyCredits = DEFAULT_MONTHLY;
        dailyCredits = monthlyCredits > 0 ? Math.min(DEFAULT_DAILY, monthlyCredits) : 0;
      }
    }

    // Check available credits
    const totalAvailable = isActiveSubscriber ? dailyCredits + paidCredits : Math.min(dailyCredits, monthlyCredits);
    if (totalAvailable < EXPORT_COST) {
      return new Response(
        JSON.stringify({
          error: `Export requires ${EXPORT_COST} credits. You have ${totalAvailable} remaining.`,
          credits_required: EXPORT_COST,
          credits_available: totalAvailable,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits: daily first, then paid (subscribers) or daily+monthly together (free)
    let remaining = EXPORT_COST;
    if (isActiveSubscriber) {
      if (dailyCredits >= remaining) {
        dailyCredits -= remaining;
      } else {
        remaining -= dailyCredits;
        dailyCredits = 0;
        paidCredits -= remaining;
      }
    } else {
      dailyCredits -= remaining;
      monthlyCredits -= remaining;
    }

    // Update profile
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
        success: true,
        credits_used: EXPORT_COST,
        profile: { daily_credits: dailyCredits, monthly_credits: monthlyCredits, paid_credits: paidCredits },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('questionnaire-export error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
