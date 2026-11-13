import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google's models can be slow or overloaded. Wait only a limited time, then switch to the other model.
const GEMINI_FAST_MODEL = Deno.env.get('GEMINI_LITE_MODEL') ?? 'gemini-3.5-flash-lite';
const GEMINI_STRONG_MODEL = Deno.env.get('GEMINI_STRONG_MODEL') ?? 'gemini-3.8-flash';
const GEMINI_RETRY_STATUSES = [429, 500, 502, 503, 504];

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    // The timer only covers waiting for the answer to start, so streaming replies are not cut off
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGemini(url: string, init: RequestInit): Promise<Response> {
  const isImage = /image/.test(url);

  try {
    const res = await fetchWithTimeout(url, init, 35000);
    if (!GEMINI_RETRY_STATUSES.includes(res.status)) return res;
    console.warn(`[GEMINI] ${res.status} from the first model, trying the other one`);
  } catch (e) {
    console.warn('[GEMINI] first model too slow or failed, trying the other one:', String(e).slice(0, 80));
  }

  // Work out which model was used, then switch to the other one (image calls keep their own model)
  let currentModel = url.match(/\/models\/([^/:]+):/)?.[1] ?? '';
  let fallbackInit: RequestInit = init;
  if (typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.model) currentModel = body.model;
    } catch {
      /* body is not JSON */
    }
  }
  const alternative = currentModel === GEMINI_FAST_MODEL ? GEMINI_STRONG_MODEL : GEMINI_FAST_MODEL;
  let fallbackUrl = url;
  if (!isImage) {
    fallbackUrl = url.replace(/\/models\/[^/:]+:/, `/models/${alternative}:`);
    if (typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        if (body.model) fallbackInit = { ...init, body: JSON.stringify({ ...body, model: alternative }) };
      } catch {
        /* body is not JSON */
      }
    }
  }

  let lastResponse: Response | null = null;
  let lastError: unknown = null;
  for (const wait of [1000, 2500]) {
    await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetchWithTimeout(fallbackUrl, fallbackInit, 45000);
      if (!GEMINI_RETRY_STATUSES.includes(res.status)) return res;
      lastResponse = res;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error('AI service is not responding');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Credit cost determined dynamically by mode

function deductCredits(
  creditCost: number,
  dailyCredits: number,
  monthlyCredits: number,
  paidCredits: number,
  isActiveSubscriber: boolean
): { success: boolean; dailyCredits: number; monthlyCredits: number; paidCredits: number } {
  let remaining = creditCost;

  if (isActiveSubscriber) {
    if (dailyCredits >= remaining) {
      dailyCredits -= remaining;
      return { success: true, dailyCredits, monthlyCredits, paidCredits };
    } else if (dailyCredits > 0) {
      remaining -= dailyCredits;
      dailyCredits = 0;
    }
    if (paidCredits >= remaining) {
      paidCredits -= remaining;
      return { success: true, dailyCredits, monthlyCredits, paidCredits };
    }
    return { success: false, dailyCredits, monthlyCredits, paidCredits };
  } else {
    if (dailyCredits >= remaining && monthlyCredits >= remaining) {
      dailyCredits -= remaining;
      monthlyCredits -= remaining;
      return { success: true, dailyCredits, monthlyCredits, paidCredits };
    }
    return { success: false, dailyCredits, monthlyCredits, paidCredits };
  }
}


// ---------- Reading and cleaning the questionnaire the AI returns ----------
const VALID_TYPES = ['yes_no', 'short_text', 'long_text', 'rating_scale', 'multiple_choice'];

function normalizeQuestionnaire(raw: any): any | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return null;
  const seen = new Set<string>();
  const uid = (v: unknown): string => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || seen.has(s)) {
      const fresh = crypto.randomUUID();
      seen.add(fresh);
      return fresh;
    }
    seen.add(s);
    return s;
  };

  const sections = raw.sections
    .map((sec: any) => {
      const questions = (Array.isArray(sec?.questions) ? sec.questions : [])
        .map((q: any) => {
          const text = String(q?.text ?? '').trim();
          if (!text) return null;
          const out: any = { id: uid(q?.id), text, type: VALID_TYPES.includes(q?.type) ? q.type : 'short_text' };
          const helper = String(q?.helperText ?? '').trim();
          if (helper) out.helperText = helper;
          if (out.type === 'rating_scale') out.scaleDirection = q?.scaleDirection === '5to1' ? '5to1' : '1to5';
          if (out.type === 'multiple_choice') {
            const options = [...new Set((Array.isArray(q?.options) ? q.options : []).map((o: unknown) => String(o).trim()).filter(Boolean))];
            if (options.length >= 2) out.options = options;
            else out.type = 'short_text';
          }
          return out;
        })
        .filter(Boolean);
      const description = String(sec?.description ?? '').trim();
      return {
        id: uid(sec?.id),
        title: String(sec?.title ?? '').trim() || 'Untitled section',
        ...(description ? { description } : {}),
        questions,
      };
    })
    .filter((sec: any) => sec.questions.length > 0);

  if (sections.length === 0) return null;
  const result: any = { title: String(raw.title ?? '').trim() || 'Untitled Questionnaire', sections };
  const subtitle = String(raw.subtitle ?? '').trim();
  const introText = String(raw.introText ?? '').trim();
  if (subtitle) result.subtitle = subtitle;
  if (introText) result.introText = introText;
  if (Array.isArray(raw.labels)) result.labels = raw.labels.map((l: unknown) => String(l).trim()).filter(Boolean).slice(0, 12);
  return result;
}

function extractQuestionnaire(fullReply: string): { reply: string; questionnaire: any | null } {
  const delimiter = '|||QUESTIONNAIRE_JSON|||';
  const idx = fullReply.indexOf(delimiter);
  let reply = fullReply;
  let jsonPart = '';
  if (idx !== -1) {
    reply = fullReply.substring(0, idx).trim();
    jsonPart = fullReply.substring(idx + delimiter.length).trim();
  } else {
    const fenced = fullReply.match(/```json\s*([\s\S]*?)```/);
    if (fenced) {
      jsonPart = fenced[1];
      reply = fullReply.replace(fenced[0], '').trim();
    }
  }
  if (!jsonPart) return { reply, questionnaire: null };

  const block = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = (block ? block[1] : jsonPart).trim();
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  try {
    return { reply, questionnaire: normalizeQuestionnaire(JSON.parse(jsonStr)) };
  } catch (e) {
    console.error('Failed to parse questionnaire JSON:', e);
    return { reply, questionnaire: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, currentQuestionnaire, mode = 'chat' } = await req.json();
    
    // Will be set after fetching from app_settings
    let CREDIT_COST = mode === 'build' ? 5 : 2;

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
      .select('*')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    // Credit handling
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;
    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits || 0;
    const paidCreditsExpired = profile.credits_expiry_date ? new Date(profile.credits_expiry_date) < new Date() : true;
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;

    // Fetch dynamic credit defaults AND questionnaire costs from app_settings
    const costKey = mode === 'build' ? 'credit_cost_questionnaire_build' : 'credit_cost_questionnaire_chat';
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .in('key', ['default_daily_credits', 'default_monthly_credits', costKey]);

    // Override credit cost from app_settings if set
    const costSetting = settingsData?.find((s: { key: string; value: string }) => s.key === costKey);
    if (costSetting) {
      const dynamicCost = parseInt(costSetting.value);
      if (!isNaN(dynamicCost) && dynamicCost > 0) {
        CREDIT_COST = dynamicCost;
        console.log(`[QUESTIONNAIRE] Dynamic cost from app_settings: ${costKey} = ${CREDIT_COST}`);
      }
    }

    let DEFAULT_DAILY = 8;
    let DEFAULT_MONTHLY = 40;
    settingsData?.forEach((s: { key: string; value: string }) => {
      if (s.key === 'default_daily_credits') DEFAULT_DAILY = parseInt(s.value) || 8;
      if (s.key === 'default_monthly_credits') DEFAULT_MONTHLY = parseInt(s.value) || 40;
    });

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

    const totalAvailable = isActiveSubscriber ? dailyCredits + paidCredits : Math.min(dailyCredits, monthlyCredits);
    if (totalAvailable < CREDIT_COST) {
      return new Response(
        JSON.stringify({ error: `This action requires ${CREDIT_COST} credits. You have ${totalAvailable} remaining.`, credits_required: CREDIT_COST }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const currentQuestionnaireContext = currentQuestionnaire
      ? `\n\nThe user's current questionnaire state:\n\`\`\`json\n${JSON.stringify(currentQuestionnaire, null, 2)}\n\`\`\``
      : '';

    const chatModePrompt = `You are the questionnaire design guide inside ProjectPal. Your job is to INTERVIEW the user so that the questionnaire builder gets everything it needs. You never write the questionnaire itself in this chat: the Build button does that after the interview.

WHAT THE BUILDER NEEDS (the checklist):
1. Topic and purpose of the study or survey
2. Respondents: who will answer (for example 300-level students of a Nigerian university, or customers of a small business)
3. Objectives, research questions or hypotheses: what the user wants to find out
4. Variables or concepts to measure (for example social media use and academic performance)
5. Sections wanted (for example demographics, one section per variable, open feedback)
6. Question types and rating scale: multiple choice, yes/no, short and long written answers, and 1 to 5 rating questions (the rating scale labels are fixed as Very Poor, Poor, Average, Good, Very Good, and the user can choose whether 1 or 5 is the lowest). For agree/disagree style statements, the builder uses a multiple choice question with the options Strongly Agree to Strongly Disagree.
7. Roughly how many questions per section, and any questions that MUST be included
8. Introduction or consent text, and the tone or language level

HOW TO REPLY EVERY TIME (keep the reply under 220 words):
- Start with one short sentence confirming what you understood from the user's last message. Do not repeat everything.
- Show the checklist as a list. Each line starts with a green tick (\u2705) if it is already clear or an empty box (\u2B1C) if it is still needed, followed by a short label.
- Ask for the next one to three missing items only, most important first (items 1 to 4 matter most). Give a short example answer for each, so the user knows exactly what to write.
- If the message is vague (for example "make me a survey"), explain in one or two sentences what to send and give one complete example of a good first message.
- When items 1 to 4 are clear, say so, summarise the plan in 4 to 6 short bullet points, and tell the user they can press the Build button now or add more detail first. Invite changes.
- If the user already has a questionnaire in the builder (see the current state below), treat the conversation as refining it: ask what they want to change or add and mention the exact sections or questions concerned.
- If the user asks a question about questionnaire design, answer it briefly and well, then go back to the checklist.
- Use plain, friendly English. Do NOT include |||QUESTIONNAIRE_JSON||| and do NOT output any JSON, under any circumstances in chat mode.
${currentQuestionnaireContext}`;

    const buildModePrompt = `You are a questionnaire design assistant for ProjectPal. Using the ENTIRE conversation, generate the complete questionnaire now. If the conversation is thin, make sensible assumptions that suit an academic research survey and list those assumptions briefly in your explanation.

## IF A QUESTIONNAIRE ALREADY EXISTS (see the current state below)
Treat the request as an update. Return the COMPLETE updated questionnaire. Keep every existing section and question that the user did not ask you to change (keep their text and ids), and apply only the requested changes and additions.

## STRUCTURE AND QUALITY
- A title, a short subtitle if useful, and an introText that states the purpose, that taking part is voluntary, and that answers are confidential and used only for research.
- For a research study: Section 1 is Demographics (for example gender, age range, level or status, as relevant), then one section per variable or objective, then a closing section for open comments when suitable. At least 3 to 4 sections.
- At least 8 to 10 questions per section, more if the user asked for more. Follow any question counts and must-have questions the user gave.
- Mix the question types sensibly: multiple_choice, rating_scale, yes_no, short_text and long_text.
- Every section has a clear title and a one-sentence description. Add helperText to questions that could be ambiguous.
- The rating scale has FIXED labels (1 to 5 as Very Poor, Poor, Average, Good, Very Good, or reversed with 5to1). So phrase rating_scale questions as ratings, for example "How would you rate the quality of...", never as agree or disagree statements. When the user wants agree or disagree statements, use multiple_choice with the options Strongly Agree, Agree, Neutral, Disagree, Strongly Disagree.
- multiple_choice questions need at least 4 options where it makes sense (always at least 2), and demographic options must cover everyone (add an "Other" or "Prefer not to say" option where suitable).
- Questions must be neutral, clear, one idea per question, with no leading wording.

## OUTPUT FORMAT
First write a short friendly explanation (what you built, how many sections and questions, and any assumptions). Then write the delimiter |||QUESTIONNAIRE_JSON||| followed by the JSON, and nothing after the JSON.

The JSON must match this structure exactly:
{
  "title": "string",
  "subtitle": "optional string",
  "introText": "optional string",
  "sections": [
    {
      "id": "UUID string",
      "title": "string",
      "description": "optional string",
      "questions": [
        {
          "id": "UUID string",
          "text": "string",
          "helperText": "optional string",
          "type": "yes_no" | "short_text" | "long_text" | "rating_scale" | "multiple_choice",
          "scaleDirection": "1to5" | "5to1" (only for rating_scale),
          "options": ["string", "string"] (only for multiple_choice, at least 2)
        }
      ]
    }
  ]
}
Use a unique UUID (like "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx") for every id.
${currentQuestionnaireContext}`;

    const systemPrompt = mode === 'build' ? buildModePrompt : chatModePrompt;

    const conversationHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'ai' ? 'assistant' : msg.role,
      content: msg.content,
    }));

    const callAI = () =>
      fetchGemini('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
          max_tokens: mode === 'build' ? 16000 : 1500,
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message },
          ],
        }),
      });

    let reply = '';
    let questionnaire: any = null;
    const maxAttempts = mode === 'build' ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const aiResponse = await callAI();

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: 'AI service payment required.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errText = await aiResponse.text();
        console.error('AI gateway error:', aiResponse.status, errText);
        throw new Error('AI gateway error');
      }

      const aiData = await aiResponse.json();
      const fullReply = aiData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
      const parsed = extractQuestionnaire(fullReply);
      reply = parsed.reply;
      questionnaire = mode === 'build' ? parsed.questionnaire : null;

      if (mode !== 'build' || questionnaire) break;
      console.warn(`[QUESTIONNAIRE] Build attempt ${attempt} returned no usable questionnaire`);
    }

    if (mode === 'build' && !questionnaire) {
      // Nothing usable came back, so nothing is charged
      return new Response(
        JSON.stringify({ error: 'The questionnaire could not be generated this time. No credits were used. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (mode !== 'build') {
      reply = reply.replace(/\|\|\|QUESTIONNAIRE_JSON\|\|\|[\s\S]*$/, '').trim();
    }

    // Deduct credits
    const deductResult = deductCredits(CREDIT_COST, dailyCredits, monthlyCredits, paidCredits, isActiveSubscriber);
    if (!deductResult.success) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabaseClient
      .from('profiles')
      .update({
        daily_credits: deductResult.dailyCredits,
        monthly_credits: deductResult.monthlyCredits,
        paid_credits: deductResult.paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        reply,
        questionnaire,
        credits_used: CREDIT_COST,
        profile: {
          daily_credits: deductResult.dailyCredits,
          monthly_credits: deductResult.monthlyCredits,
          paid_credits: deductResult.paidCredits,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('questionnaire-ai error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
