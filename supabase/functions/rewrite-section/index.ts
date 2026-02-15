import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RewriteType = "grammar" | "clarity" | "academic" | "expand" | "summarize";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user profile and credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is Scholar plan
    if (profile.plan_type !== "scholar") {
      return new Response(
        JSON.stringify({ error: "This feature is only available for Scholar plan users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check subscription expiry
    if (profile.credits_expiry_date) {
      const expiryDate = new Date(profile.credits_expiry_date);
      if (expiryDate < new Date()) {
        return new Response(
          JSON.stringify({ error: "Your subscription has expired. Please renew to continue using this feature." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch dynamic credit defaults from app_settings
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['default_daily_credits']);

    let DEFAULT_DAILY = 8;
    settingsData?.forEach((s: { key: string; value: string }) => {
      if (s.key === 'default_daily_credits') DEFAULT_DAILY = parseInt(s.value) || 8;
    });

    // Check credits
    const today = new Date().toISOString().split("T")[0];
    const resetDate = profile.daily_reset_date;
    let dailyCredits = profile.daily_credits;

    if (resetDate !== today) {
      dailyCredits = DEFAULT_DAILY;
      await supabase
        .from("profiles")
        .update({ daily_credits: DEFAULT_DAILY, daily_reset_date: today })
        .eq("id", user.id);
    }

    const hasCredits = dailyCredits > 0 || profile.paid_credits > 0;
    if (!hasCredits) {
      return new Response(
        JSON.stringify({ error: "No credits available" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { selectedText, rewriteType } = await req.json() as { selectedText: string; rewriteType: RewriteType };

    if (!selectedText || !rewriteType) {
      return new Response(
        JSON.stringify({ error: "Selected text and rewrite type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Rewriting section for user ${user.id}, type: ${rewriteType}`);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const promptMap: Record<RewriteType, string> = {
      grammar: `Fix all grammar, spelling, and punctuation errors in the following text. Maintain the original meaning and style. Only fix errors, do not rephrase unnecessarily.`,
      clarity: `Improve the clarity and readability of the following text. Make it easier to understand while maintaining the original meaning. Use simpler sentence structures where appropriate.`,
      academic: `Rewrite the following text in a more formal academic tone. Use appropriate academic vocabulary, avoid colloquialisms, and ensure it follows scholarly writing conventions.`,
      expand: `Expand the following text with more detail and explanation. Add relevant examples, elaboration, and supporting information while maintaining the original message.`,
      summarize: `Summarize the following text concisely while preserving the key points and main ideas. Make it shorter but keep the essential meaning.`,
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are an expert academic writing assistant. Provide clear, well-written improvements." 
          },
          { 
            role: "user", 
            content: `${promptMap[rewriteType]}\n\nORIGINAL TEXT:\n${selectedText}` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_rewrite",
              description: "Provide the rewritten text with explanation",
              parameters: {
                type: "object",
                properties: {
                  rewrittenText: {
                    type: "string",
                    description: "The improved/rewritten version of the text"
                  },
                  explanation: {
                    type: "string",
                    description: "Brief explanation of the changes made (1-2 sentences)"
                  }
                },
                required: ["rewrittenText", "explanation"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_rewrite" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    let result: { rewrittenText: string; explanation: string };

    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      result = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
    } else {
      throw new Error("Invalid AI response format");
    }

    // Deduct credit
    if (dailyCredits > 0) {
      await supabase
        .from("profiles")
        .update({ daily_credits: dailyCredits - 1 })
        .eq("id", user.id);
    } else {
      await supabase
        .from("profiles")
        .update({ paid_credits: profile.paid_credits - 1 })
        .eq("id", user.id);
    }

    console.log("Rewrite completed");

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Error in rewrite-section:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});