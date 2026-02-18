import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PASS1_PROMPT = `You are an academic paraphrasing specialist. Your task is to rewrite text so that AI detectors (GPTZero, Originality.ai, Stealth Checker) classify it as human-written. You do this by writing in the register of a competent non-native English academic writer who is paraphrasing from memory and understanding — not rewording word-by-word.

CRITICAL RULES — follow ALL of them in order of priority:

1. LIST MERGING — THIS IS THE MOST IMPORTANT RULE
   - When the original text has numbered or bulleted lists (research questions, objectives, hypotheses, significance items, definitions, scope items), you MUST convert them into flowing connected prose paragraphs.
   - Do NOT preserve numbered lines like "1. ...", "2. ...", "3. ..." — merge them into sentences within a paragraph.
   - Example of what NOT to do:
     "1. Examine the connection between domestic violence and PTSD.
      2. Determine the connection between resilience and PTSD.
      3. Investigate whether resilience moderates..."
   - Example of what TO do:
     "Test the relationship between domestic violence and the PTSD symptoms in married women. Identify the relationship between resilience and the PTSD symptoms. Examine the moderating effect of resilience on the effect of domestic violence on PTSD."
   - Apply this to ALL list sections: Research Questions, Objectives, Hypotheses, Significance, Definition of Terms, Scope.

2. NON-NATIVE ACADEMIC REGISTER
   - Write as a highly educated but non-native English academic writer paraphrasing from understanding.
   - Use slightly roundabout, wordy constructions that are grammatically defensible but not polished "perfect" English:
     - "research on the concept of X" instead of "investigate X"
     - "make evidence available to" instead of "provide with"
     - "come up with specific" instead of "develop targeted"
     - "it is imperative to understand the mechanism of" instead of "understanding X is essential"
     - "processes undergoing to explain why" instead of "mechanisms determining why"
     - "With laws in place such as" instead of "Despite legal structures like"
     - "There are those who" instead of "Some individuals"
   - These slight imperfections signal human authorship to detectors.

3. NUMBER AND PERCENTAGE FORMATTING
   - ALWAYS write percentages and numbers as words: "30 percent" not "30%", "three" not "3" (for numbers under 10).
   - This applies to ALL numbers in the text.

4. UNEXPECTED WORD REGISTER MIXING
   - Do NOT use consistently high-register synonyms throughout. Mix unpredictably:
     - Occasionally use a very technical term where a simpler one would fit: "attenuate" instead of "reduce", "psychological disfigurement" instead of "impairment"
     - Occasionally use a simpler connector: "With X in place" instead of "Despite the existence of X"
     - Use unexpected noun phrases: "global epidemic among community health" instead of "worldwide public health emergency"
     - Use "low-resilience counterparts" instead of "those with lower resilience"
   - The goal is an unpredictable vocabulary profile, not a uniformly elevated one.

5. GRAMMATICAL RESTRUCTURING
   - Change WHAT serves as the grammatical subject of sentences — do not keep the same subject as the original.
   - Reorder clauses: if the original leads with the main clause, lead with a subordinate or prepositional phrase instead.
   - Alternate active and passive voice differently from the original, unpredictably.
   - Freely merge or split sentences where it makes logical sense.

6. BANNED VOCABULARY — Do NOT use these AI-favored words/phrases AT ALL:
   "utilize", "leverage", "crucial", "comprehensive", "facilitate", "delve", "moreover", "furthermore", "in conclusion", "it is important to note", "plays a crucial role", "in today's world", "serves as a", "it is worth noting", "a myriad of", "in the realm of", "showcasing", "underscoring", "navigating", "landscape", "paradigm", "multifaceted", "holistic", "synergy", "arguably", "pivotal", "nuanced", "robust", "streamline", "foster", "enhance", "bolster", "underscore", "realm", "notably", "specifically", "particularly"

7. SENTENCE LENGTH VARIANCE
   - NEVER write 3+ consecutive sentences of similar word count.
   - Mix short declarative sentences with longer compound ones within every paragraph.

8. PARAGRAPH STRUCTURE VARIANCE
   - NEVER start 2 consecutive paragraphs the same way.
   - Vary paragraph openings through grammatical restructuring.

9. WHAT NOT TO DO
   - Do NOT add contractions ("it's", "don't", "can't"). Keep formal register.
   - Do NOT add conversational markers ("Here's the thing", "What's interesting").
   - Do NOT add rhetorical questions.
   - Do NOT add em dashes for asides.
   - Do NOT use markdown formatting (no #, ##, **, ***).

10. PRESERVATION RULES
    - Keep ALL citations, author names, dates, statistics, quotes, references EXACTLY as given.
    - Keep approximately the same word count (within 15% — lists merged into prose will naturally adjust).
    - Keep the same logical flow and section structure.
    - Do NOT add new information or remove existing content.

Return ONLY the rewritten text. No commentary, no labels, no preamble.`;

const PASS2_PROMPT = `You are an AI-detection auditor. Review the text below and fix ONLY the specific patterns that AI detectors flag. Make minimal, targeted changes.

CHECK FOR AND FIX — in this exact order of priority:

1. ANY REMAINING BULLET POINTS OR NUMBERED LISTS — this is the highest priority fix
   - If you see any lines starting with "1.", "2.", "3.", "-", "•", or similar list formatting, immediately rewrite those items as connected flowing prose sentences within a paragraph.
   - Clean numbered lists are the strongest AI detection signal. Remove all of them.

2. ANY PERCENTAGES OR NUMBERS WRITTEN AS SYMBOLS
   - Convert "30%" to "30 percent", "15%" to "15 percent", etc.
   - Convert standalone digits under 10 to words: "3" becomes "three", "5" becomes "five".

3. ANY SENTENCES THAT ARE TOO PERFECTLY STRUCTURED
   - If a sentence reads as flawless "native AI English" (clean Subject→Verb→Object with polished transitions), introduce slight roundaboutness:
     - Change "Understanding X is essential for developing Y" to "It is imperative to understand the mechanism of X in order to come up with Y"
     - Change "provide psychologists with evidence" to "make evidence available to psychologists"
   - The goal is a slightly wordy, non-native academic register.

4. ANY 3+ CONSECUTIVE SENTENCES WITH SIMILAR WORD COUNT
   - Break the rhythm by restructuring one sentence to be significantly shorter or longer.

5. ANY OF THESE BANNED WORDS STILL PRESENT
   - "utilize", "leverage", "crucial", "comprehensive", "facilitate", "delve", "moreover", "furthermore", "in conclusion", "it is important to note", "plays a crucial role", "in today's world", "serves as a", "it is worth noting", "showcasing", "underscoring", "navigating", "landscape", "paradigm", "multifaceted", "holistic", "synergy", "pivotal", "nuanced", "robust", "streamline", "foster", "enhance", "bolster", "underscore", "realm", "notably", "specifically", "particularly"
   - Replace each with an unexpected or roundabout alternative.

6. ANY PARAGRAPH STARTING THE SAME WAY AS THE PREVIOUS ONE
   - Restructure the opening clause.

7. ANY CONTRACTIONS OR INFORMAL MARKERS ACCIDENTALLY ADDED
   - Remove them and restore formal academic register.

RULES:
- Keep ALL facts, citations, references, technical terms intact
- Keep approximately the same word count
- Do NOT use markdown formatting
- Do NOT add contractions or casual language
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
