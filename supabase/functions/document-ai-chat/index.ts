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

// Granular credit cost detection based on instruction keywords
function determineCreditCost(instruction: string): { cost: number; category: "edit" | "analysis" | "generation" } {
  const lower = instruction.toLowerCase();

  // Fully Wrap Project - 50 credits
  if (/fully wrap|wrap project|full project|wrap my project/i.test(lower)) {
    return { cost: 50, category: "generation" };
  }

  // Journal Paper / Research Proposal - 20 credits
  if (/journal paper|convert to journal|research proposal/i.test(lower)) {
    return { cost: 20, category: "generation" };
  }

  // Chapter 5 / Conclusion - 15 credits
  if (/chapter\s*5|chapter\s*five|conclusion|recommendations/i.test(lower)) {
    return { cost: 15, category: "generation" };
  }

  // Chapter 2 / Literature Review - 10 credits
  if (/chapter\s*2|chapter\s*two|literature review|review of literature/i.test(lower)) {
    return { cost: 10, category: "generation" };
  }

  // Chapter 1 / Introduction / Abstract - 5 credits
  if (/chapter\s*1|chapter\s*one|introduction chapter|write introduction|write abstract|abstract/i.test(lower)) {
    return { cost: 5, category: "generation" };
  }

  // Summarize / Extract Key Points - 4 credits
  if (/summarize|summary|extract key|key points|outline|overview/i.test(lower)) {
    return { cost: 4, category: "analysis" };
  }

  // Edit tasks (grammar, clarity, tone) - 2 credits
  if (/fix grammar|spelling|improve clarity|academic tone|proofread|correct|edit|revise|simplify|punctuation|typo/i.test(lower)) {
    return { cost: 2, category: "edit" };
  }

  // Default - 2 credits
  return { cost: 2, category: "generation" };
}

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
    const { cost: creditCost, category: requestType } = determineCreditCost(instruction);

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

    console.log(`Processing ${requestType.toUpperCase()} request (${creditCost}cr): ${instruction.substring(0, 80)}`);

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

SPECIAL INSTRUCTION - "FULLY WRAP PROJECT":
If the user asks to "fully wrap" or "wrap project", you must generate ALL preliminary pages and end-matter for a complete Nigerian university academic project. Analyze the uploaded document (which should contain Chapters 1-5) and generate the following sections IN ORDER:

**BEFORE CHAPTER 1 (Preliminary Pages):**
1. **TITLE PAGE** - Include: Project title (extract from document), [Student Name], [Matric Number], Department of [Department Name] (extract from document if possible), Faculty of [Faculty Name], [University Name], [Month, Year]. Format centered.
2. **DEDICATION** - A short, heartfelt dedication paragraph. Use placeholder: "This project is dedicated to [dedication recipient, e.g., my parents, God Almighty, etc.]."
3. **ACKNOWLEDGEMENT** - A comprehensive acknowledgement section expressing gratitude to: God Almighty, the project supervisor, Head of Department, lecturers, family members, friends, and colleagues. Use appropriate placeholders for names.
4. **ABSTRACT** - Generate a 200-300 word abstract summarizing the entire project based on the document content. Include the research problem, objectives, methodology, key findings, and conclusions. End with 4-6 keywords.
5. **TABLE OF CONTENTS** - Generate a formatted table of contents listing all preliminary pages and chapters with "[Page Number]" placeholders. Include all chapter titles and major subsections found in the document.
6. **LIST OF TABLES** - List any tables referenced in the document with "[Page Number]" placeholders. If none found, include template entries.
7. **LIST OF FIGURES** - List any figures referenced in the document with "[Page Number]" placeholders. If none found, include template entries.

**AFTER CHAPTER 5 (End Matter):**
8. **REFERENCES** - Compile and format all citations found throughout the document in APA 7th Edition style. Organize alphabetically by author surname. If specific references are cited in-text, format them properly. Add placeholder entries for any incomplete citations.
9. **APPENDICES** - Create an appendices section template with: "APPENDIX A: [Research Instrument/Questionnaire]", "APPENDIX B: [Raw Data/Additional Tables]", "APPENDIX C: [Letters of Introduction/Consent Forms]".

Use markdown formatting. Extract as much real information (title, department, methodology, findings) from the document as possible. Use [brackets] only for information that cannot be determined from the document content.

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
