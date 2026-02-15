import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDIT_COST = 2;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, currentQuestionnaire } = await req.json();

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

    // Fetch dynamic credit defaults from app_settings
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .in('key', ['default_daily_credits', 'default_monthly_credits']);

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const currentQuestionnaireContext = currentQuestionnaire
      ? `\n\nThe user's current questionnaire state:\n\`\`\`json\n${JSON.stringify(currentQuestionnaire, null, 2)}\n\`\`\``
      : '';

    const systemPrompt = `You are a questionnaire design assistant for ProjectPal. You help users create well-structured questionnaires for academic research.

When the user asks you to create, modify, or generate a questionnaire (or parts of one), you MUST include a structured JSON block in your response using the delimiter |||QUESTIONNAIRE_JSON||| followed by the JSON.

When the user is just asking a question or chatting (not requesting generation), do NOT include the JSON block.

The JSON must match this exact TypeScript structure:
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
          "scaleDirection": "1to5" | "5to1" (only for rating_scale type),
          "options": ["string", "string", ...] (required for multiple_choice type, at least 2 options)
        }
      ]
    }
  ]
}

Guidelines:
- Generate unique UUIDs for all id fields (use format like "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx")
- Use appropriate question types based on what's being asked
- For Likert-scale questions, use "rating_scale" with "scaleDirection": "1to5"
- Group related questions into logical sections
- Include helpful descriptions for sections and helper text for complex questions
- For academic research questionnaires, follow standard survey methodology
- If the user asks to modify the existing questionnaire, include the FULL updated questionnaire in the JSON (not just the changes)
- Always provide a conversational explanation BEFORE the JSON block

${currentQuestionnaireContext}`;

    const conversationHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'ai' ? 'assistant' : msg.role,
      content: msg.content,
    }));

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message },
        ],
      }),
    });

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

    // Parse out questionnaire JSON if present
    let reply = fullReply;
    let questionnaire = null;

    const delimiterIndex = fullReply.indexOf('|||QUESTIONNAIRE_JSON|||');
    if (delimiterIndex !== -1) {
      reply = fullReply.substring(0, delimiterIndex).trim();
      const jsonPart = fullReply.substring(delimiterIndex + '|||QUESTIONNAIRE_JSON|||'.length).trim();
      
      // Extract JSON - handle markdown code blocks
      let jsonStr = jsonPart;
      const codeBlockMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }
      
      try {
        questionnaire = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse questionnaire JSON:', e);
        // Still return the reply even if JSON parsing fails
      }
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
