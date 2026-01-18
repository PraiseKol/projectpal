import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface DiffSuggestion {
  id: string;
  original: string;
  replacement: string;
  explanation: string;
  type: "grammar" | "clarity" | "style" | "structure" | "content";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instruction, documentContent } = await req.json();

    if (!instruction || !documentContent) {
      return new Response(
        JSON.stringify({ error: "Missing instruction or documentContent" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user profile and credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan_type, daily_credits, paid_credits, credits_expiry_date")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has Scholar plan
    if (profile.plan_type !== "scholar") {
      return new Response(
        JSON.stringify({ error: "This feature requires a Scholar plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check subscription expiry
    if (profile.credits_expiry_date) {
      const expiryDate = new Date(profile.credits_expiry_date);
      if (expiryDate < new Date()) {
        return new Response(
          JSON.stringify({ error: "Your subscription has expired" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check credits
    const totalCredits = profile.daily_credits + profile.paid_credits;
    if (totalCredits <= 0) {
      return new Response(
        JSON.stringify({ error: "No credits available" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert academic writing assistant. The user will give you a document and an instruction. 
Your job is to analyze the document and return specific text edits as structured suggestions.

IMPORTANT: Return suggestions using the provided tool. Each suggestion should:
1. Identify a specific piece of text that should be changed
2. Provide the exact replacement text
3. Explain why this change improves the document
4. Categorize the change type

Be thorough but focused on actionable improvements. Limit to the most impactful 5-10 suggestions.`;

    console.log("Calling Lovable AI with instruction:", instruction.substring(0, 100));

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Document content:\n\n${documentContent}\n\n---\n\nInstruction: ${instruction}` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_edits",
              description: "Return structured edit suggestions for the document",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original: { 
                          type: "string", 
                          description: "The exact text to find and replace (copy exactly from the document)" 
                        },
                        replacement: { 
                          type: "string", 
                          description: "The improved text to replace the original with" 
                        },
                        explanation: { 
                          type: "string", 
                          description: "Brief explanation of why this change improves the document" 
                        },
                        type: { 
                          type: "string", 
                          enum: ["grammar", "clarity", "style", "structure", "content"],
                          description: "Category of the edit"
                        }
                      },
                      required: ["original", "replacement", "explanation", "type"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suggestions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_edits" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Parse the tool call response
    let suggestions: DiffSuggestion[] = [];
    
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        suggestions = (args.suggestions || []).map((s: any, index: number) => ({
          id: `suggestion-${Date.now()}-${index}`,
          original: s.original || "",
          replacement: s.replacement || "",
          explanation: s.explanation || "",
          type: s.type || "content"
        }));
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits
    if (profile.daily_credits > 0) {
      await supabase
        .from("profiles")
        .update({ daily_credits: profile.daily_credits - 1 })
        .eq("id", user.id);
    } else {
      await supabase
        .from("profiles")
        .update({ paid_credits: profile.paid_credits - 1 })
        .eq("id", user.id);
    }

    console.log(`Returning ${suggestions.length} suggestions`);

    return new Response(
      JSON.stringify({ 
        suggestions,
        creditsRemaining: totalCredits - 1
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("document-ai-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
