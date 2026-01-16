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
    const { message, session_id } = await req.json();
    
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
      throw new Error('Unauthorized');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // Check credits and handle resets
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;

    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits || 0;
    const creditsExpiryDate = profile.credits_expiry_date;

    // Check if paid credits have expired
    const paidCreditsExpired = creditsExpiryDate ? new Date(creditsExpiryDate) < new Date() : true;

    // Enhanced logging - before state
    console.log(`[CREDIT] User: ${user.id}, Plan: ${profile.plan_type}`);
    console.log(`[CREDIT] Before - Daily: ${profile.daily_credits}, Monthly: ${profile.monthly_credits}, Paid: ${profile.paid_credits}`);
    console.log(`[CREDIT] Daily Reset Date: ${profile.daily_reset_date}, Today: ${today}, Needs Reset: ${needsDailyReset}`);
    console.log(`[CREDIT] Expiry: ${creditsExpiryDate}, Expired: ${paidCreditsExpired}`);

    // Reset daily credits if needed (all users get 8 free daily credits)
    if (needsDailyReset) {
      dailyCredits = 8;
      console.log(`[CREDIT] Daily credits reset to 8`);
      
      // For free users only: check monthly credit reset
      if (profile.plan_type === 'free') {
        const lastResetMonth = profile.daily_reset_date ? new Date(profile.daily_reset_date).getMonth() : -1;
        const currentMonth = new Date().getMonth();
        
        if (lastResetMonth !== currentMonth) {
          // New month - reset monthly credits to 40 for free users
          monthlyCredits = 40;
          console.log(`[CREDIT] Monthly credits reset to 40 for free user`);
        }
      }
    }

    // Credit deduction logic:
    // 1. Use daily credits first (free bonus for all users)
    // 2. For Free users: then use monthly credits (capped at 40)
    // 3. For Pro/Scholar users: then use paid credits (if not expired)
    
    let canProceed = false;
    let creditSource = '';

    if (dailyCredits > 0) {
      dailyCredits -= 1;
      canProceed = true;
      creditSource = 'daily';
    } else if (profile.plan_type === 'free' && monthlyCredits > 0) {
      // Free users use monthly credits after daily
      monthlyCredits -= 1;
      canProceed = true;
      creditSource = 'monthly';
    } else if (profile.plan_type !== 'free' && paidCredits > 0 && !paidCreditsExpired) {
      // Pro/Scholar users use paid credits after daily (if not expired)
      paidCredits -= 1;
      canProceed = true;
      creditSource = 'paid';
    }

    if (!canProceed) {
      const errorMessage = profile.plan_type === 'free' 
        ? 'Insufficient credits. Upgrade to Pro or Scholar for more credits!'
        : paidCreditsExpired 
          ? 'Your paid credits have expired. Please purchase more credits.'
          : 'Insufficient credits. Please purchase more credits.';
      
      console.log(`[CREDIT] Insufficient credits - Plan: ${profile.plan_type}, Expired: ${paidCreditsExpired}`);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREDIT] Deducted from: ${creditSource}. After - Daily: ${dailyCredits}, Monthly: ${monthlyCredits}, Paid: ${paidCredits}`);

    // Fetch conversation history
    const { data: previousMessages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('sender, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Build conversation history
    const conversationHistory = previousMessages?.map(msg => ({
      role: msg.sender === 'ai' ? 'assistant' : 'user',
      content: msg.content,
    })) || [];

    // Call Lovable AI
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
            content: `You are ScholarAI, an academic project assistant. You help students with:
1. Generating project topics and titles
2. Writing research proposals
3. Creating Chapters 1-5 (Introduction, Literature Review, Methodology, Results/Discussion, Conclusion)
4. Editing and improving academic content
5. Generating proper academic references in APA, MLA, or Harvard format
6. Providing academic writing guidance

Always write in formal academic English. Be helpful, thorough, and maintain academic integrity. When generating chapters, structure them properly with appropriate headings and subheadings.`,
          },
          ...conversationHistory,
          { role: 'user', content: message },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;

    // Save AI message to database
    await supabaseClient.from('messages').insert({
      session_id,
      sender: 'ai',
      content: aiMessage,
    });

    // Update user profile with new credits
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        monthly_credits: monthlyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
    }

    // Return response
    return new Response(
      JSON.stringify({
        response: aiMessage,
        profile: {
          daily_credits: dailyCredits,
          monthly_credits: monthlyCredits,
          paid_credits: paidCredits,
          credits_expiry_date: creditsExpiryDate,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in chat-ai function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
