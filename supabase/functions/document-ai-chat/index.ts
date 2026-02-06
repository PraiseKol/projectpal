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

// Detect request type based on instruction
function categorizeRequest(instruction: string): "edit" | "generation" | "analysis" {
  const lowerInstruction = instruction.toLowerCase();
  
  // Edit suggestions - specific text improvements
  const editKeywords = [
    "fix grammar", "spelling error", "improve clarity", "academic tone", "simplify",
    "correct", "proofread", "edit", "revise word", "fix punctuation", "typo"
  ];
  
  // Analysis - understanding document without generating new content
  const analysisKeywords = [
    "summarize", "summary", "analyze", "explain", "what is", "what are",
    "list the", "identify", "extract key", "outline", "overview", "critique"
  ];
  
  if (editKeywords.some(kw => lowerInstruction.includes(kw))) {
    return "edit";
  }
  
  if (analysisKeywords.some(kw => lowerInstruction.includes(kw))) {
    return "analysis";
  }
  
  // Default to generation for everything else (chapters, papers, content, etc.)
  return "generation";
}

// Credit costs based on task complexity
const EDIT_CREDIT_COST = 1;
const ANALYSIS_CREDIT_COST = 2;
const GENERATION_CREDIT_COST = 3;

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

    // Determine request type and credit cost
    const requestType = categorizeRequest(instruction);
    const creditCost = requestType === "edit" 
      ? EDIT_CREDIT_COST 
      : requestType === "analysis" 
        ? ANALYSIS_CREDIT_COST 
        : GENERATION_CREDIT_COST;

    // Check credits
    const totalCredits = profile.daily_credits + profile.paid_credits;
    if (totalCredits < creditCost) {
      return new Response(
        JSON.stringify({ error: `Insufficient credits. This action requires ${creditCost} credits.` }),
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

    console.log(`Processing ${requestType.toUpperCase()} request: ${instruction.substring(0, 80)}`);

    // Build request based on type
    let systemPrompt: string;
    let tools: any[] | undefined;
    let toolChoice: any | undefined;

    if (requestType === "edit") {
      // Edit suggestions mode - use tool calling for structured suggestions
      systemPrompt = `You are an expert academic writing assistant. The user will give you a document and an instruction. 
Your job is to analyze the document and return specific text edits as structured suggestions.

IMPORTANT: Return suggestions using the provided tool. Each suggestion should:
1. Identify a specific piece of text that should be changed
2. Provide the exact replacement text
3. Explain why this change improves the document
4. Categorize the change type

Be thorough but focused on actionable improvements. Limit to the most impactful 5-10 suggestions.`;

      tools = [
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
      ];
      toolChoice = { type: "function", function: { name: "suggest_edits" } };
    } else {
      // Generation and Analysis mode - comprehensive AI assistant
      systemPrompt = `You are ProjectPal, an expert academic document assistant. You help users with their academic documents by performing whatever task they request.

YOUR CAPABILITIES:
1. **Content Generation**: Write new chapters, sections, abstracts, conclusions, introductions, literature reviews, methodology sections, results discussions, recommendations, etc.
2. **Document Analysis**: Summarize documents, extract key points, identify themes, outline structure, analyze arguments, find gaps
3. **Publishing Help**: Convert to journal paper format, write abstracts for submission, create research summaries, prepare manuscripts
4. **Academic Enhancement**: Expand sections, add depth to arguments, include citations placeholders, improve academic rigor

GUIDELINES:
- Write in formal, academic English appropriate for scholarly work
- Maintain consistency with the document's existing style, terminology, and structure
- If generating new chapters/sections, follow the format and depth of existing content
- Include proper academic language, citation placeholders [Author, Year] where appropriate
- Structure content with clear headings, subheadings, and logical flow
- Be thorough and comprehensive - provide substantial, useful content
- For summaries/analysis, be concise but capture all key points

When generating chapters like "Chapter 5" or conclusions:
- Reference findings and discussions from earlier parts of the document
- Include subsections: Summary of Findings, Conclusions, Recommendations, Suggestions for Future Research (as applicable)
- Draw specific conclusions from the data/research presented
- Make actionable recommendations based on the findings

When creating publishing papers:
- Follow standard journal article structure (Abstract, Introduction, Methods, Results, Discussion, Conclusion)
- Condense and restructure the content for journal format
- Include placeholder for references section

OUTPUT:
Return ONLY the requested content as clean, well-formatted text. Use markdown formatting for structure (# for headings, ## for subheadings, - for bullet points). Do not include meta-commentary about what you're doing unless specifically asked.`;
    }

    const requestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `DOCUMENT CONTENT:\n\n${documentContent}\n\n---\n\nUSER REQUEST: ${instruction}` 
        }
      ],
    };

    if (tools) {
      requestBody.tools = tools;
      requestBody.tool_choice = toolChoice;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
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
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Parse response based on request type
    let responseData: { suggestions?: DiffSuggestion[], generatedContent?: string };
    
    if (requestType === "edit") {
      // Parse the tool call response for suggestions
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
      
      responseData = { suggestions };
      console.log(`Returning ${suggestions.length} suggestions`);
    } else {
      // Extract generated content from message (both generation and analysis)
      const content = aiData.choices?.[0]?.message?.content || "";
      responseData = { generatedContent: content };
      console.log(`Generated content: ${content.length} characters`);
    }

    // Deduct credits
    if (profile.daily_credits >= creditCost) {
      await supabase
        .from("profiles")
        .update({ daily_credits: profile.daily_credits - creditCost })
        .eq("id", user.id);
    } else {
      // Split between daily and paid
      const fromDaily = profile.daily_credits;
      const fromPaid = creditCost - fromDaily;
      await supabase
        .from("profiles")
        .update({ 
          daily_credits: 0,
          paid_credits: profile.paid_credits - fromPaid 
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({ 
        ...responseData,
        requestType: requestType === "edit" ? "edit" : "generation",
        creditsUsed: creditCost,
        creditsRemaining: totalCredits - creditCost
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
