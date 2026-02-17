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

// Regex fallback for credit cost detection
function determineCreditCostFallback(instruction: string): { cost: number; category: "edit" | "analysis" | "generation" } {
  const lower = instruction.toLowerCase();

  if (/fully wrap|wrap project|full project|wrap my project/i.test(lower)) {
    return { cost: 50, category: "generation" };
  }
  if (/journal paper|convert to journal|research proposal/i.test(lower)) {
    return { cost: 20, category: "generation" };
  }
  if (/chapter\s*5|chapter\s*five|conclusion|recommendations/i.test(lower)) {
    return { cost: 15, category: "generation" };
  }
  if (/chapter\s*2|chapter\s*two|literature review|review of literature/i.test(lower)) {
    return { cost: 10, category: "generation" };
  }
  if (/chapter\s*1|chapter\s*one|introduction chapter|write introduction|write abstract|abstract/i.test(lower)) {
    return { cost: 5, category: "generation" };
  }
  if (/summarize|summary|extract key|key points|outline|overview/i.test(lower)) {
    return { cost: 4, category: "analysis" };
  }
  if (/fix grammar|spelling|improve clarity|academic tone|proofread|correct|edit|revise|simplify|punctuation|typo/i.test(lower)) {
    return { cost: 2, category: "edit" };
  }
  return { cost: 2, category: "generation" };
}

// AI-based request classification to prevent credit loopholes
async function classifyRequestForDoc(instruction: string, apiKey: string): Promise<{ cost: number; category: "edit" | "analysis" | "generation" }> {
  try {
    const classificationPrompt = `You are a strict credit cost classifier for an academic document editor. Classify the user's instruction based on what they are ACTUALLY asking the AI to do with their document.

CLASSIFICATION RULES:

- "fully_wrap_project" (50 credits, generation): Wrapping an entire project, generating all preliminary/end pages
- "journal_paper" (20 credits, generation): Converting to journal paper, research proposal
- "chapter_5" (15 credits, generation): Writing Chapter 5, Conclusion, Recommendations
- "chapter_3_4" (25 credits, generation): Writing Chapter 3 Methodology or Chapter 4 Results
- "chapter_2" (10 credits, generation): Writing Chapter 2, Literature Review
- "chapter_1" (5 credits, generation): Writing Chapter 1, Introduction, Abstract
- "analysis" (4 credits, analysis): Summarize, extract key points, outline, overview
- "edit" (2 credits, edit): Fix grammar, spelling, improve clarity, academic tone, proofread, revise
- "generation_other" (2 credits, generation): Other content generation, expanding paragraphs

IMPORTANT: Look at the INTENT. "Write the introduction" is chapter_1 (5 credits). "Help me with methodology" where they want WRITING is chapter_3_4 (25 credits).

Return ONLY valid JSON: {"type": "category_name", "cost": number, "category": "edit|analysis|generation"}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: classificationPrompt },
          { role: 'user', content: instruction }
        ],
        max_tokens: 60,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[CLASSIFY] AI classification failed:', response.status);
      return determineCreditCostFallback(instruction);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    console.log(`[CLASSIFY] Raw AI response: ${raw}`);
    
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return determineCreditCostFallback(instruction);

    const parsed = JSON.parse(jsonMatch[0]);
    const validCategories = ["edit", "analysis", "generation"];
    
    if (parsed.cost && typeof parsed.cost === 'number' && parsed.cost > 0 && 
        parsed.category && validCategories.includes(parsed.category)) {
      console.log(`[CLASSIFY] AI classified as: ${parsed.type} (${parsed.cost} credits, ${parsed.category})`);
      return { cost: parsed.cost, category: parsed.category as "edit" | "analysis" | "generation" };
    }

    return determineCreditCostFallback(instruction);
  } catch (error) {
    console.error('[CLASSIFY] Classification error:', error);
    return determineCreditCostFallback(instruction);
  }
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

    // Determine request type and credit cost using AI classification
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let creditCost: number;
    let requestType: "edit" | "analysis" | "generation";
    
    if (lovableApiKey) {
      const classification = await classifyRequestForDoc(instruction, lovableApiKey);
      creditCost = classification.cost;
      requestType = classification.category;
    } else {
      const fallback = determineCreditCostFallback(instruction);
      creditCost = fallback.cost;
      requestType = fallback.category;
    }

    // Fetch dynamic credit cost from app_settings based on classification
    const costKeyMap: Record<string, string> = {
      edit: 'credit_cost_grammar_fix',
      analysis: 'credit_cost_analysis',
      generation: 'credit_cost_suggestions',
    };
    // Try to find more specific key based on cost value
    const specificKeys: Record<number, string> = {
      50: 'credit_cost_full_wrap',
      25: 'credit_cost_chapter_3',
      20: 'credit_cost_research_proposal',
      15: 'credit_cost_chapter_5_alt',
      10: 'credit_cost_chapter_2',
      5: 'credit_cost_chapter_1',
      4: 'credit_cost_analysis',
      2: requestType === 'edit' ? 'credit_cost_grammar_fix' : 'credit_cost_suggestions',
    };
    const settingKey = specificKeys[creditCost] || costKeyMap[requestType] || 'credit_cost_suggestions';
    
    const { data: docCostSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [settingKey]);
    
    const docCostSetting = docCostSettings?.find((s: any) => s.key === settingKey);
    if (docCostSetting) {
      const dynamicCost = parseInt(docCostSetting.value);
      if (!isNaN(dynamicCost) && dynamicCost > 0) {
        creditCost = dynamicCost;
        console.log(`[DOC-AI] Dynamic cost from app_settings: ${settingKey} = ${creditCost}`);
      }
    }

    // Check credits
    const totalCredits = profile.daily_credits + profile.paid_credits;
    if (totalCredits < creditCost) {
      return new Response(
        JSON.stringify({ error: `Insufficient credits. This action requires ${creditCost} credits.` }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI (reuse key if already fetched, otherwise get it)
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

## DEPARTMENT DETECTION:
IMPORTANT: Detect the student's department from the document content and their instruction. If the document or instruction contains law-related keywords (law, legal, LL.B, long essay, statute, case law, tort, contract law, criminal law, constitutional law, jurisprudence, Act, Bill, regulatory framework, NIALS, FCCPA, CFRN, Faculty of Law, College of Law), use the LAW structure. Otherwise use the DEFAULT structure.

YOUR CAPABILITIES:
1. **Content Generation**: Write new chapters, sections, abstracts, conclusions, introductions, literature reviews, methodology sections, results discussions, recommendations, etc.
2. **Document Analysis**: Summarize documents, extract key points, identify themes, outline structure, analyze arguments, find gaps
3. **Publishing Help**: Convert to journal paper format, write abstracts for submission, create research summaries, prepare manuscripts
4. **Academic Enhancement**: Expand sections, add depth to arguments, include citations placeholders, improve academic rigor

GUIDELINES:
- Write in formal academic English appropriate for scholarly work
- Maintain consistency with the document's existing style, terminology, and structure
- If generating new chapters/sections, follow the format and depth of existing content
- Structure content with clear headings, subheadings, and logical flow
- Be thorough and comprehensive - provide substantial, useful content
- For summaries/analysis, be concise but capture all key points

## FOR DEFAULT (Science/Social Science) PROJECTS:
- Include proper academic language, citation placeholders [Author, Year] where appropriate
- Use APA 7th Edition for references
- Follow standard Nigerian university project structure (Ch 1: Introduction, Ch 2: Literature Review, Ch 3: Methodology, Ch 4: Results, Ch 5: Discussion/Conclusion)

## FOR LAW LONG ESSAYS (LL.B):
- Use FOOTNOTES (superscript numbering) as the primary citation method, NOT in-text APA
- Use doctrinal/qualitative methodology ONLY (never quantitative, surveys, questionnaires, ANOVA, Cronbach's alpha)
- Follow law-specific chapter structure: Ch 1: General Introduction, Ch 2: Conceptual Framework & Literature Review, Ch 3: Legal & Regulatory Framework, Ch 4: Case Analysis, Ch 5: Summary, Conclusion & Recommendations
- Include Table of Cases, Table of Statutes, List of Abbreviations in preliminary pages
- Case citations format: *Case Name* (Year) Volume Report Page (e.g., *Abacha v Fawehinmi* (2000) 6 NWLR (Pt 660) 228)
- Statute citations format: Section X, Full Act Name Year (e.g., Section 17(2), Federal Competition and Consumer Protection Act 2018)
- Use NIALS citation style for footnotes and bibliography
- Latin maxims in italics: *caveat emptor*, *nemo dat quod non habet*, *res ipsa loquitur*
- Use legal writing conventions: "It is submitted that...", "The court held that...", "Per [Judge] in..."
- Bibliography organized into: Books, Journal Articles, Online Sources, Table of Cases, Table of Statutes

## MANDATORY REFERENCES RULE:
When generating ANY chapter content, you MUST include references at the END of the generated content.

**For Science/Social Science:**
- Include a "## References" section in APA 7th Edition
- Include at least 10-15 references for major chapters, 5-8 for Chapter 5
- Be REAL, verifiable academic sources from Google Scholar
- DO NOT fabricate references

**For Law Long Essays:**
- Include a "## Bibliography" section (NOT "References")
- Organize into: A. Books, B. Journal Articles, C. Online Sources, D. Table of Cases, E. Table of Statutes
- Use NIALS/Nigerian legal citation format
- All cases must be REAL decided cases with proper law report citations
- All statutes must be REAL enacted legislation with full titles and years
- DO NOT fabricate cases or statutes

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
If the user asks to "fully wrap" or "wrap project", you must generate ALL preliminary pages and end-matter for a complete academic project. Analyze the uploaded document and generate the following sections IN ORDER:

**For DEFAULT (Science/Social Science) projects:**
1. TITLE PAGE, DEDICATION, ACKNOWLEDGEMENT, ABSTRACT, TABLE OF CONTENTS, LIST OF TABLES, LIST OF FIGURES
2. After Chapter 5: REFERENCES (APA 7th), APPENDICES

**For LAW Long Essays:**
1. TITLE PAGE (with "Long Essay" label, College/Faculty of Law, LL.B Hons), DECLARATION PAGE, CERTIFICATION PAGE, DEDICATION, ACKNOWLEDGEMENTS, TABLE OF CONTENTS, TABLE OF CASES, TABLE OF STATUTES, TABLE OF INTERNATIONAL CONVENTIONS (if applicable), LIST OF ABBREVIATIONS, ABSTRACT
2. After Chapter 5: BIBLIOGRAPHY (organized into Books, Journal Articles, Online Sources, Table of Cases, Table of Statutes), APPENDICES

Use markdown formatting. Extract as much real information from the document as possible. Use [brackets] only for information that cannot be determined from the document content.

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
