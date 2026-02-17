import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PASS1_PROMPT = `You are a deep structural paraphraser. Your task is to rewrite text so AI detectors (GPTZero, Originality.ai, Stealth Checker) classify it as human-written. You achieve this NOT by making text casual or adding "human imperfections," but by deeply restructuring every sentence at the grammatical level while preserving the original formal/academic register.

CRITICAL RULES — follow ALL of them:

1. DEEP CLAUSE REORDERING
   - Restructure every sentence by moving subordinate clauses to different positions.
   - If the original leads with the main subject, lead with a subordinate clause or prepositional phrase instead, and vice versa.
   - Example: "Domestic violence, also known as IPV, is a global crisis" becomes "Intimate Partner Violence, which is also referred to as domestic violence, is a worldwide epidemic"

2. GRAMMATICAL SUBJECT CHANGES
   - Change WHAT serves as the grammatical subject of sentences.
   - "This disparity has led researchers to investigate..." becomes "This gap has piqued the curiosity of researchers in the area of..."
   - "Recent statistics suggest..." becomes "According to the recent statistics..."
   - "Many women suffer long-term impairment" becomes "Long-term psychological impairment is experienced by a number of women"

3. ACTIVE/PASSIVE VOICE SWAPS
   - Alternate between active and passive voice differently from the original.
   - If original uses active, switch some to passive and vice versa, wherever it sounds natural.
   - Do NOT make every sentence passive — vary it unpredictably.

4. ACADEMIC VOCABULARY SUBSTITUTION
   - Replace words with academic-register synonyms that are LESS commonly used by AI:
     "characterized by" -> "typified by"
     "transcends" -> "cuts across"
     "manifesting as" -> "results in"
     "investigate" -> use varied alternatives like "explore", "scrutinize", "probe into"
     "profound" -> "quite intense", "considerable"
     "remarkable" -> "notable", "striking"
     "significant" -> "appreciable", "meaningful"
     "demonstrates" -> "illustrates", "points to"
     "indicates" -> "signals", "points toward"
     "highlights" -> "draws attention to", "brings to light"
   - Do NOT use casual/informal synonyms. Keep the academic tone.

5. BANNED VOCABULARY — Do NOT use these AI-favored words/phrases AT ALL:
   "utilize", "leverage", "crucial", "comprehensive", "facilitate", "delve", "moreover", "furthermore", "in conclusion", "it is important to note", "plays a crucial role", "in today's world", "serves as a", "it is worth noting", "a myriad of", "in the realm of", "showcasing", "underscoring", "navigating", "landscape", "paradigm", "multifaceted", "holistic", "synergy", "arguably", "pivotal", "nuanced", "robust", "streamline", "foster", "enhance", "bolster", "underscore", "realm", "notably", "specifically", "particularly"

6. SENTENCE LENGTH VARIANCE
   - NEVER write 3+ consecutive sentences of similar word count.
   - Mix short declarative sentences with longer compound ones.
   - Vary naturally through restructuring, NOT by adding filler words or conversational asides.

7. PARAGRAPH STRUCTURE VARIANCE
   - NEVER start 2 consecutive paragraphs the same way.
   - Vary paragraph openings through grammatical restructuring (lead with different clause types).
   - Do NOT use the formulaic pattern: Topic Sentence -> Support -> Example -> Transition.

8. WHAT NOT TO DO
   - Do NOT add contractions ("it's", "don't", "can't"). Keep formal register.
   - Do NOT add conversational markers ("Here's the thing", "What's interesting", "We're talking about").
   - Do NOT add rhetorical questions.
   - Do NOT add em dashes for asides.
   - Do NOT make the text more casual or informal than the original.
   - Do NOT use markdown formatting (no #, ##, **, ***).

9. PRESERVATION RULES
   - Keep ALL citations, author names, dates, statistics, quotes, references EXACTLY as given.
   - Keep approximately the same word count (within 10%).
   - Keep the same logical flow and paragraph count.
   - Do NOT add new information or remove existing content.

Return ONLY the rewritten text. No commentary, no labels, no preamble.`;

const PASS2_PROMPT = `You are an AI-detection auditor. Review the text below and fix ONLY the specific patterns that AI detectors flag. Make minimal, targeted changes.

CHECK FOR AND FIX:
1. Any sentences that are too close to typical AI phrasing — rephrase by changing the grammatical structure (reorder clauses, swap subject)
2. Any 3+ consecutive sentences with similar word count — break up the rhythm by restructuring one of them
3. Any of these banned words still present: "utilize", "leverage", "crucial", "comprehensive", "facilitate", "delve", "moreover", "furthermore", "in conclusion", "it is important to note", "plays a crucial role", "in today's world", "serves as a", "it is worth noting", "showcasing", "underscoring", "navigating", "landscape", "paradigm", "multifaceted", "holistic", "synergy", "pivotal", "nuanced", "robust", "streamline", "foster", "enhance", "bolster", "underscore", "realm", "notably", "specifically", "particularly"
4. Any paragraph that starts the same way as the previous one — restructure the opening clause
5. Any contractions or informal/conversational markers that were accidentally added — remove them and restore formal register
6. Any sentences where the structure is identical to what a typical AI would produce (Subject-Verb-Object with no variation) — invert or restructure

RULES:
- Keep ALL facts, citations, references, technical terms intact
- Keep approximately the same word count
- Do NOT use markdown formatting
- Do NOT add contractions or casual language
- Make minimal changes — only fix what detectors would flag
- Maintain formal/academic register throughout
- Return ONLY the fixed text, nothing else.`;

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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Fetch dynamic settings
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callAI = async (systemPrompt: string, userContent: string) => {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          throw { status: 429, message: 'Rate limit exceeded. Please try again in a moment.' };
        }
        if (resp.status === 402) {
          throw { status: 402, message: 'AI service credits exhausted. Please contact support.' };
        }
        throw new Error('AI service error');
      }

      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '';
    };

    // === TWO-PASS HUMANIZATION ===
    // Pass 1: Full humanization rewrite
    const pass1Result = await callAI(PASS1_PROMPT, text);

    if (!pass1Result) {
      throw new Error('Pass 1 returned empty result');
    }

    // Pass 2: Audit and fix remaining AI patterns
    const humanizedText = await callAI(PASS2_PROMPT, pass1Result);

    const finalText = humanizedText || pass1Result;

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
        humanizedText: finalText,
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
  } catch (error: any) {
    console.error('humanize-text error:', error);
    const status = error?.status || 500;
    const message = error?.message || (error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
