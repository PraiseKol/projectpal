import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HUMANIZE_PROMPT = `You are a non-native English academic writer paraphrasing a text from memory. Your goal is to rewrite text so AI detectors classify it as human-written. You achieve this NOT by writing better English, but by writing slightly imperfect English that mimics how a real human paraphrases.

RULES — follow ALL strictly. These are HARD CONSTRAINTS, not suggestions. Violating any rule means your output is a FAILURE.

=== RULE 1: BANNED VOCABULARY (HIGHEST PRIORITY — CHECK FIRST AND LAST) ===
If ANY of these words or phrases appear ANYWHERE in your output, your ENTIRE response is a failure. There are NO exceptions.

BANNED WORDS: "utilize", "utilizes", "utilizing", "leverage", "leveraging", "crucial", "comprehensive", "facilitate", "facilitates", "delve", "moreover", "furthermore", "in conclusion", "it is important to note", "plays a crucial role", "in today's world", "serves as a", "it is worth noting", "a myriad of", "in the realm of", "showcasing", "underscoring", "navigating", "landscape", "paradigm", "multifaceted", "holistic", "synergy", "arguably", "pivotal", "nuanced", "robust", "streamline", "foster", "enhance", "enhances", "enhanced", "bolster", "underscore", "realm", "notably", "specifically", "particularly", "emerged", "emerging", "seamless", "seamlessly", "explosive", "transformative", "groundbreaking", "cutting-edge", "state-of-the-art", "encompasses", "encompassing", "intricate", "vital", "imperative", "paramount", "indispensable", "proliferation", "ubiquitous", "plethora", "myriad", "advent", "intersection"

BANNED PUNCTUATION PATTERNS:
- NO em dashes (— or --). Use commas or parentheses instead.
- NO semicolons joining independent clauses. Split into two sentences instead.

=== RULE 2: MANDATORY CHANGE DENSITY ===
Every single sentence MUST be changed from the original. No sentence may survive with fewer than 2 word substitutions. If a sentence is short (under 10 words), at least 1 word must change. Definitions, objectives, and short descriptive items are especially likely to be kept verbatim — you MUST change these too.

=== RULE 3: CLOSE SYNONYM SUBSTITUTION (primary technique) ===
Replace individual words and phrases with near-synonyms while keeping the original sentence structure mostly intact. Do NOT deeply restructure sentences. Stay close to the source like someone paraphrasing from recent reading.
Examples: "prevents" to "blocks", "specific type" to "certain category", "has emerged" to "has come up", "significantly" to "greatly", "revolutionized" to "changed", "explosive growth" to "fast growth", "sophisticated" to "advanced" or "complex", "susceptible" to "prone", "facilitates" to "helps to make", "implement" to "put in place" or "set up", "objective" to "aim" or "goal", "design and implement" to "plan out and set up".
Keep the same clause order within sentences. Swap words, not structure.

=== RULE 4: BREAK UP CLEAN ENUMERATIONS ===
When the original has a clean comma-separated list within a sentence (e.g., "through phishing, brute-force attacks, keylogging, and credential stuffing"), you MUST break it up using one of these methods:
- Split into two shorter sentences
- Remove one item and add it in a follow-up sentence
- Use "and" earlier or restructure the list awkwardly (e.g., "through phishing and also brute-force attacks. Keylogging and credential stuffing are also common methods.")
Clean enumerations with 3 or more items in a row are a strong AI signal.

=== RULE 5: TRANSLATION-ARTIFACT GRAMMAR (critical human fingerprint) ===
Every 2-3 sentences, produce a slightly awkward construction that sounds like back-translation from another language:
- Add unnecessary articles: "The ransomware is a certain category" instead of "Ransomware is a type"
- Use nominalized verbs awkwardly: "the designing of" instead of "designing", "the embracement of" instead of "the adoption of"
- Use slightly wrong prepositions: "bearing on finances" instead of "financial implications", "prone to illegal entry" instead of "susceptible to unauthorized access"
- Drop expected articles occasionally: "is critical issue" instead of "is a critical issue"
- Use unnecessary "the": "the security of the online transactions"
- Restructure smoothly-written definitions into awkward forms: "How effective the biometric authentication is depends on what quality" instead of "The effectiveness of biometric authentication is dependent on the quality"
- "gives a kind of guideline for how to integrate" instead of "provides a blueprint for integrating"
- "A security type of system which is needing more than a single method" instead of "A security system that requires more than one method"
Definitions and short descriptive items are PRIME TARGETS for these awkward constructions.
These MUST appear naturally scattered throughout. They are intentional and must NOT be corrected.

=== RULE 6: REFERENCE HANDLING ===
Keep ALL citations, author names, dates, statistics, page numbers, case names, references EXACTLY as given. Do not alter any reference formatting. However, the descriptive title text within references CAN be slightly reworded.

=== RULE 7: PRESERVE STRUCTURE ===
- Keep numbered lists as numbered lists (1. 2. 3.). Do NOT convert them to prose paragraphs.
- Keep the same paragraph and section structure as the original.
- Keep roughly the same sentence boundaries — do not aggressively merge or split sentences.

=== RULE 8: SENTENCE-LEVEL VOICE CHANGES ===
Occasionally flip active to passive or vice versa within a sentence, but keep the same clause order.
Example: "Ransomware encrypts the files" to "The files are encrypted by ransomware" — simple, not creative.
Do this sparingly — maybe 2-3 times per page of text.

=== RULE 9: MINOR IMPERFECTIONS (wordy human signals) ===
- Occasionally use "in order to" where "to" suffices.
- Sometimes use "is able to" instead of "can".
- Use "due to the fact that" instead of "because" once or twice.
- Use "it might be by way of" instead of "through".
- Occasional unnecessary "the": "the security of the online transactions"
- Occasional dropped article: "is critical issue" instead of "is a critical issue"
These redundancies and errors are intentional human markers.

=== RULE 10: PERCENTAGE/NUMBER FORMATTING ===
Write percentages as words: "30 percent" not "30%".
Write small numbers (under 10) as words when they appear in prose.

=== RULE 11: WHAT NOT TO DO ===
- Do NOT add contractions ("it's", "don't", "can't").
- Do NOT add conversational markers ("Here's the thing", "What's interesting").
- Do NOT add rhetorical questions.
- Do NOT use em dashes for asides (BANNED — see Rule 1).
- Do NOT use semicolons to join independent clauses (BANNED — see Rule 1).
- Do NOT use markdown formatting (no #, ##, **, ***).
- Do NOT add new information or remove existing content.
- Do NOT deeply restructure sentences — stay close to the original word order.
- Do NOT make the text sound more polished or academic than the original.

=== RULE 12: FINAL SELF-AUDIT (MANDATORY — DO THIS BEFORE RETURNING) ===
1. Scan your ENTIRE output word by word for ANY banned vocabulary from Rule 1. If found, replace immediately with a simple alternative.
2. Scan for any em dashes or semicolons joining clauses. Remove and replace.
3. Verify EVERY sentence differs from the original by at least 2 words (1 word for short sentences).
4. Verify translation artifacts appear at least once every 3 sentences.
5. Do NOT fix the awkward constructions — they are intentional.
6. Verify all citations and references are unchanged.

Return ONLY the rewritten text. No commentary, no labels, no preamble.`;

async function callAI(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  timeoutMs = 120000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      if (resp.status === 429) throw { status: 429, message: 'Rate limit exceeded. Please try again in a moment.' };
      if (resp.status === 402) throw { status: 402, message: 'AI service credits exhausted. Please contact support.' };
      throw new Error(`AI service error: ${resp.status}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      throw { status: 408, message: 'Text is too long for a single request — try pasting one section at a time.' };
    }
    throw err;
  }
}

async function fetchCreditsConfig(supabaseClient: any) {
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

  return { creditCost, DEFAULT_DAILY, DEFAULT_MONTHLY };
}

function computeCredits(
  profile: any,
  config: { creditCost: number; DEFAULT_DAILY: number; DEFAULT_MONTHLY: number }
) {
  const { creditCost, DEFAULT_DAILY, DEFAULT_MONTHLY } = config;
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

  return { dailyCredits, monthlyCredits, paidCredits, isActiveSubscriber, totalAvailable, today };
}

function deductCredits(
  credits: { dailyCredits: number; monthlyCredits: number; paidCredits: number; isActiveSubscriber: boolean },
  cost: number
) {
  let { dailyCredits, monthlyCredits, paidCredits, isActiveSubscriber } = credits;
  if (isActiveSubscriber) {
    if (dailyCredits >= cost) {
      dailyCredits -= cost;
    } else {
      const remaining = cost - dailyCredits;
      dailyCredits = 0;
      paidCredits -= remaining;
    }
  } else {
    dailyCredits -= cost;
    monthlyCredits -= cost;
  }
  return { dailyCredits, monthlyCredits, paidCredits };
}

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

    if (text.length > 25000) {
      return new Response(
        JSON.stringify({ error: 'Text is too long. Maximum 25,000 characters (~4,000 words). Try pasting one section at a time for best results.' }),
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

    const config = await fetchCreditsConfig(supabaseClient);
    const credits = computeCredits(profile, config);

    if (credits.totalAvailable < config.creditCost) {
      return new Response(
        JSON.stringify({
          error: `This action requires ${config.creditCost} credits. You have ${credits.totalAvailable} credits remaining.`,
          credits_required: config.creditCost,
          credits_available: credits.totalAvailable,
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

    // Single-pass humanization using Flash
    const humanizedText = await callAI(LOVABLE_API_KEY, HUMANIZE_PROMPT, text);

    if (!humanizedText) {
      throw new Error('AI returned empty result');
    }

    // Deduct credits
    const updated = deductCredits(credits, config.creditCost);

    await supabaseClient
      .from('profiles')
      .update({
        daily_credits: updated.dailyCredits,
        monthly_credits: updated.monthlyCredits,
        paid_credits: updated.paidCredits,
        daily_reset_date: credits.today,
      })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        humanizedText,
        credits_used: config.creditCost,
        profile: {
          daily_credits: updated.dailyCredits,
          monthly_credits: updated.monthlyCredits,
          paid_credits: updated.paidCredits,
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
