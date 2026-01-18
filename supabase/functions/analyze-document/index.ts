import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisResult {
  overallScore: number;
  summary: string;
  categories: {
    grammar: {
      score: number;
      issues: Array<{ original: string; suggested: string; explanation: string }>;
    };
    structure: {
      score: number;
      suggestions: string[];
    };
    academic_style: {
      score: number;
      issues: Array<{ original: string; suggested: string; explanation: string }>;
    };
    citations: {
      score: number;
      issues: string[];
    };
  };
  improvedText: string;
}

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

    // Check credits
    const today = new Date().toISOString().split("T")[0];
    const resetDate = profile.daily_reset_date;
    let dailyCredits = profile.daily_credits;

    if (resetDate !== today) {
      dailyCredits = 8;
      await supabase
        .from("profiles")
        .update({ daily_credits: 8, daily_reset_date: today })
        .eq("id", user.id);
    }

    const hasCredits = dailyCredits > 0 || profile.paid_credits > 0;
    if (!hasCredits) {
      return new Response(
        JSON.stringify({ error: "No credits available" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { documentContent, documentId } = await req.json();

    if (!documentContent || !documentId) {
      return new Response(
        JSON.stringify({ error: "Document content and ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing document ${documentId} for user ${user.id}`);

    // Call Lovable AI for analysis
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const analysisPrompt = `You are an expert academic writing reviewer. Analyze the following document and provide comprehensive feedback.

DOCUMENT CONTENT:
${documentContent}

Provide a detailed academic review with:
1. Overall quality score (0-100)
2. Brief summary of the document quality
3. Grammar & spelling issues with corrections
4. Structure and organization suggestions
5. Academic writing style improvements
6. Citation format issues (if any)
7. A fully improved version of the text

Be thorough but constructive. Focus on helping the author improve their academic writing.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert academic writing reviewer. Always respond with valid JSON." },
          { role: "user", content: analysisPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_analysis",
              description: "Provide structured analysis of the academic document",
              parameters: {
                type: "object",
                properties: {
                  overallScore: {
                    type: "number",
                    description: "Overall quality score from 0-100"
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary of document quality (2-3 sentences)"
                  },
                  grammar: {
                    type: "object",
                    properties: {
                      score: { type: "number" },
                      issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            original: { type: "string" },
                            suggested: { type: "string" },
                            explanation: { type: "string" }
                          },
                          required: ["original", "suggested", "explanation"]
                        }
                      }
                    },
                    required: ["score", "issues"]
                  },
                  structure: {
                    type: "object",
                    properties: {
                      score: { type: "number" },
                      suggestions: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["score", "suggestions"]
                  },
                  academic_style: {
                    type: "object",
                    properties: {
                      score: { type: "number" },
                      issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            original: { type: "string" },
                            suggested: { type: "string" },
                            explanation: { type: "string" }
                          },
                          required: ["original", "suggested", "explanation"]
                        }
                      }
                    },
                    required: ["score", "issues"]
                  },
                  citations: {
                    type: "object",
                    properties: {
                      score: { type: "number" },
                      issues: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["score", "issues"]
                  },
                  improvedText: {
                    type: "string",
                    description: "The fully improved version of the document"
                  }
                },
                required: ["overallScore", "summary", "grammar", "structure", "academic_style", "citations", "improvedText"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_analysis" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    let analysis: AnalysisResult;

    // Parse the tool call response
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
      analysis = {
        overallScore: args.overallScore,
        summary: args.summary,
        categories: {
          grammar: args.grammar,
          structure: args.structure,
          academic_style: args.academic_style,
          citations: args.citations,
        },
        improvedText: args.improvedText,
      };
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

    // Save analysis to document
    await supabase
      .from("documents")
      .update({ 
        ai_analysis: analysis,
        last_edited_at: new Date().toISOString()
      })
      .eq("id", documentId)
      .eq("user_id", user.id);

    console.log("Analysis completed and saved");

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Error in analyze-document:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});