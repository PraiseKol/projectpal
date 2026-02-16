import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate an intelligent chat title using AI
async function generateIntelligentTitle(userMessage: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'Generate a 3-5 word title that summarizes the user\'s request. Be concise and descriptive. No quotes, no punctuation at the end. Examples: "Research Topic Ideas", "Chapter 2 Literature Review", "APA Citation Help", "Methodology Guidance"'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('Title generation failed');
    }

    const data = await response.json();
    const title = data.choices[0]?.message?.content?.trim() || '';
    
    if (!title || title.length > 50) {
      return userMessage.substring(0, 35).trim() + (userMessage.length > 35 ? '...' : '');
    }
    
    return title;
  } catch (error) {
    console.error('Title generation error:', error);
    return userMessage.substring(0, 35).trim() + (userMessage.length > 35 ? '...' : '');
  }
}

// Detect if user wants to search for articles
function isArticleSearchRequest(message: string): { isSearch: boolean; query: string } {
  const msgLower = message.toLowerCase();
  
  const searchPatterns = [
    /\b(?:find|search|look\s+for|get|show\s+me|give\s+me|list)\b.*?\b(?:articles?|papers?|research|publications?|studies|journals?)\b.*?\b(?:about|on|related\s+to|regarding|for)\b\s*(.+)/i,
    /\b(?:articles?|papers?|research|publications?|studies|journals?)\b.*?\b(?:about|on|related\s+to|regarding|for)\b\s*(.+)/i,
    /\bsearch\s+(?:for\s+)?(?:academic\s+)?(?:articles?|papers?)\s+(?:about|on)\s*(.+)/i,
  ];
  
  for (const pattern of searchPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the query
      let query = match[1].trim().replace(/[?.!]+$/, '').trim();
      if (query.length >= 3) {
        return { isSearch: true, query };
      }
    }
  }
  
  return { isSearch: false, query: '' };
}

// Regex fallback for credit cost detection
function determineCreditCostFallback(message: string): { cost: number; actionType: string } {
  const msgLower = message.toLowerCase();
  
  if (/\b(chapter\s*(4|four)|results\s+(and\s+)?discussion|data\s+presentation|data\s+analysis\s+chapter)\b/i.test(msgLower)) {
    return { cost: 50, actionType: 'chapter_4' };
  }
  if (/\b(chapter\s*(3|three)|methodology|research\s+methodology|research\s+design)\b/i.test(msgLower)) {
    return { cost: 25, actionType: 'chapter_3' };
  }
  if (/\b(chapter\s*(2|two)|literature\s+review|review\s+of\s+(related\s+)?literature)\b/i.test(msgLower)) {
    return { cost: 10, actionType: 'chapter_2' };
  }
  if (/\b(chapter\s*(1|one)|introduction\s+chapter)\b/i.test(msgLower)) {
    return { cost: 5, actionType: 'chapter_1' };
  }
  if (/\b(chapter\s*(5|five)|conclusion|recommendations)\b/i.test(msgLower)) {
    return { cost: 5, actionType: 'chapter_5' };
  }
  if (/\b(suggest|generate|topic|proposal|outline|section|continue|expand|elaborate|extend|add\s+more)\b/i.test(msgLower)) {
    return { cost: 2, actionType: 'generation_suggestion' };
  }
  return { cost: 1, actionType: 'simple_chat' };
}

// AI-based request classification to prevent credit loopholes
async function classifyRequest(message: string, conversationContext: string, apiKey: string): Promise<{ cost: number; actionType: string }> {
  try {
    const classificationPrompt = `You are a strict credit cost classifier for an academic writing assistant. Classify the user's request based on what they are ACTUALLY asking the AI to generate or do.

CLASSIFICATION RULES (be strict - if the user is asking for content generation of any kind that matches a chapter, classify it as that chapter):

- "chapter_1" (5 credits): Writing Chapter 1, Introduction chapter, Background to the Study, Statement of the Problem, Research Objectives, writing an introduction for a project/thesis/dissertation
- "chapter_2" (10 credits): Writing Chapter 2, Literature Review, Review of Related Literature, Theoretical Framework, Conceptual Framework, reviewing literature for a topic
- "chapter_3" (25 credits): Writing Chapter 3, Methodology, Research Design, Research Methods, Data Collection methods, writing methodology for a project
- "chapter_4" (50 credits): Writing Chapter 4, Results and Discussion, Data Analysis chapter, Data Presentation, presenting findings
- "chapter_5" (5 credits): Writing Chapter 5, Conclusion, Recommendations, Summary of Findings, writing conclusions for a project
- "research_proposal" (20 credits): Writing a full research proposal, project proposal
- "fully_wrap_project" (50 credits): Wrapping an entire project, generating all preliminary/end pages
- "generation_suggestion" (2 credits): Generating topics, outlines, suggestions, expanding a paragraph, editing a section, continuing writing, improving text
- "article_search" (1 credit): Searching for articles, finding papers, looking up references
- "simple_chat" (1 credit): Asking questions, seeking advice, clarification, greetings, or any non-generation request

IMPORTANT: Look at the INTENT, not just keywords. "Write the introduction for my project on climate change" is chapter_1 (5 credits), NOT simple_chat. "Help me with my methodology section" where they want you to WRITE it is chapter_3 (25 credits). "Continue from where you stopped" after a chapter generation is the SAME chapter type.

Return ONLY valid JSON: {"actionType": "category_name", "cost": number}`;

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
          { role: 'user', content: `RECENT CONVERSATION CONTEXT:\n${conversationContext}\n\nCURRENT USER MESSAGE:\n${message}` }
        ],
        max_tokens: 60,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[CLASSIFY] AI classification failed, status:', response.status);
      return determineCreditCostFallback(message);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    console.log(`[CLASSIFY] Raw AI response: ${raw}`);
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error('[CLASSIFY] No JSON found in response');
      return determineCreditCostFallback(message);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validTypes: Record<string, number> = {
      chapter_1: 5, chapter_2: 10, chapter_3: 25, chapter_4: 50, chapter_5: 5,
      research_proposal: 20, fully_wrap_project: 50, generation_suggestion: 2,
      article_search: 1, simple_chat: 1,
    };

    if (parsed.actionType && validTypes[parsed.actionType] !== undefined) {
      const cost = validTypes[parsed.actionType];
      console.log(`[CLASSIFY] AI classified as: ${parsed.actionType} (${cost} credits)`);
      return { cost, actionType: parsed.actionType };
    }

    console.error('[CLASSIFY] Invalid actionType from AI:', parsed.actionType);
    return determineCreditCostFallback(message);
  } catch (error) {
    console.error('[CLASSIFY] Classification error:', error);
    return determineCreditCostFallback(message);
  }
}

// Deduct credits with multi-credit support
function deductCredits(
  creditCost: number,
  dailyCredits: number,
  monthlyCredits: number,
  paidCredits: number,
  isActiveSubscriber: boolean
): { success: boolean; dailyCredits: number; monthlyCredits: number; paidCredits: number; creditSource: string } {
  let remaining = creditCost;
  let source = '';

  if (isActiveSubscriber) {
    // Active subscribers: daily credits → paid credits (no monthly cap)
    if (dailyCredits >= remaining) {
      dailyCredits -= remaining;
      return { success: true, dailyCredits, monthlyCredits, paidCredits, creditSource: 'daily' };
    } else if (dailyCredits > 0) {
      remaining -= dailyCredits;
      source = 'daily+paid';
      dailyCredits = 0;
    }
    
    if (paidCredits >= remaining) {
      paidCredits -= remaining;
      return { success: true, dailyCredits, monthlyCredits, paidCredits, creditSource: source || 'paid' };
    }
    
    return { success: false, dailyCredits, monthlyCredits, paidCredits, creditSource: '' };
  } else {
    // Free users OR expired subscribers: use daily credits (from monthly pool)
    if (dailyCredits >= remaining && monthlyCredits >= remaining) {
      dailyCredits -= remaining;
      monthlyCredits -= remaining;
      return { success: true, dailyCredits, monthlyCredits, paidCredits, creditSource: 'daily (from monthly pool)' };
    }
    
    return { success: false, dailyCredits, monthlyCredits, paidCredits, creditSource: '' };
  }
}

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

    // Check if this is an article search request
    const articleSearchCheck = isArticleSearchRequest(message);
    
    // Determine credit cost based on message using AI classification
    const LOVABLE_API_KEY_FOR_CLASSIFY = Deno.env.get('LOVABLE_API_KEY');
    
    // Build conversation context from last 3 messages for classification
    const { data: recentMsgs } = await supabaseClient
      .from('messages')
      .select('sender, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .limit(3);
    
    const conversationContext = (recentMsgs || []).reverse()
      .map(m => `${m.sender === 'ai' ? 'Assistant' : 'User'}: ${m.content.substring(0, 200)}`)
      .join('\n');

    let creditCost: number;
    let actionType: string;
    
    if (articleSearchCheck.isSearch) {
      creditCost = 1;
      actionType = 'article_search';
    } else if (LOVABLE_API_KEY_FOR_CLASSIFY) {
      const classification = await classifyRequest(message, conversationContext, LOVABLE_API_KEY_FOR_CLASSIFY);
      creditCost = classification.cost;
      actionType = classification.actionType;
    } else {
      const fallback = determineCreditCostFallback(message);
      creditCost = fallback.cost;
      actionType = fallback.actionType;
    }
    console.log(`[CREDIT] Action detected: ${actionType}, Cost: ${creditCost} credits`);

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

    // Check credits and handle resets
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;

    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits || 0;
    const creditsExpiryDate = profile.credits_expiry_date;

    // Check if paid credits have expired (subscription expired)
    const paidCreditsExpired = creditsExpiryDate ? new Date(creditsExpiryDate) < new Date() : true;
    
    // Determine if user has an active subscription
    // Active subscriber = non-free plan AND subscription not expired
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;

    // Enhanced logging - before state
    console.log(`[CREDIT] User: ${user.id}, Plan: ${profile.plan_type}`);
    console.log(`[CREDIT] Before - Daily: ${profile.daily_credits}, Monthly: ${profile.monthly_credits}, Paid: ${profile.paid_credits}`);
    console.log(`[CREDIT] Daily Reset Date: ${profile.daily_reset_date}, Today: ${today}, Needs Reset: ${needsDailyReset}`);
    console.log(`[CREDIT] Expiry: ${creditsExpiryDate}, Expired: ${paidCreditsExpired}, Active Subscriber: ${isActiveSubscriber}`);

    // Handle daily and monthly resets based on user type
    if (needsDailyReset) {
      if (isActiveSubscriber) {
        // Active subscribers get fresh daily credits every day (no monthly cap)
        dailyCredits = DEFAULT_DAILY;
        console.log(`[CREDIT] Active subscriber - Daily credits reset to ${DEFAULT_DAILY} (no monthly cap)`);
      } else {
        // Free users OR expired subscribers: daily credits with 40/month cap
        const lastResetMonth = profile.daily_reset_date ? new Date(profile.daily_reset_date).getMonth() : -1;
        const currentMonth = new Date().getMonth();
        
        if (lastResetMonth !== currentMonth) {
          // New month - reset monthly credits
          monthlyCredits = DEFAULT_MONTHLY;
          console.log(`[CREDIT] New month - Monthly credits reset to ${DEFAULT_MONTHLY}`);
        }
        
        // Only reset daily credits if we still have monthly credits remaining
        if (monthlyCredits > 0) {
          // Daily credits are limited by remaining monthly credits
          dailyCredits = Math.min(DEFAULT_DAILY, monthlyCredits);
          console.log(`[CREDIT] Free/Expired user - Daily credits set to ${dailyCredits} (monthly remaining: ${monthlyCredits})`);
        } else {
          dailyCredits = 0;
          console.log(`[CREDIT] Free/Expired user - No monthly credits remaining, daily credits: 0`);
        }
      }
    }

    // Check if user has enough credits BEFORE calling AI
    const totalAvailable = isActiveSubscriber 
      ? dailyCredits + paidCredits 
      : Math.min(dailyCredits, monthlyCredits);
    
    if (totalAvailable < creditCost) {
      let errorMessage: string;
      if (isActiveSubscriber) {
        errorMessage = `This action requires ${creditCost} credits. You have ${totalAvailable} credits remaining. Please purchase more credits.`;
      } else if (profile.plan_type !== 'free' && paidCreditsExpired) {
        errorMessage = `Your subscription has expired. This action requires ${creditCost} credits. Upgrade to continue!`;
      } else {
        errorMessage = `You've run out of credits for this month. Upgrade to Pro or Scholar for more credits!`;
      }

      console.log(`[CREDIT] Insufficient credits for ${actionType} (need ${creditCost}, have ${totalAvailable})`);
      return new Response(
        JSON.stringify({ error: errorMessage, credits_required: creditCost, credits_available: totalAvailable }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle article search requests
    if (articleSearchCheck.isSearch) {
      console.log(`[ARTICLE_SEARCH] Detected article search for: "${articleSearchCheck.query}"`);
      
      try {
        // Call Semantic Scholar API directly
        const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(articleSearchCheck.query)}&limit=10&fields=paperId,title,abstract,year,citationCount,authors,externalIds,url`;
        
        const searchResponse = await fetch(searchUrl, {
          headers: { 'Accept': 'application/json' },
        });

        if (!searchResponse.ok) {
          if (searchResponse.status === 429) {
            throw new Error('Article search rate limit reached. Please try again in a moment.');
          }
          throw new Error('Failed to search for articles');
        }

        const searchData = await searchResponse.json();
        const papers = searchData.data || [];

        // Format results as a nice markdown message
        let aiMessage = '';
        if (papers.length === 0) {
          aiMessage = `I couldn't find any academic articles matching "${articleSearchCheck.query}". Try using different keywords or a broader topic.`;
        } else {
          aiMessage = `## Academic Articles on "${articleSearchCheck.query}"\n\nI found ${papers.length} relevant articles from Semantic Scholar:\n\n`;
          
          papers.forEach((paper: any, index: number) => {
            const authors = paper.authors?.map((a: any) => a.name).join(', ') || 'Unknown';
            const year = paper.year || 'n.d.';
            const citations = paper.citationCount || 0;
            const doi = paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : null;
            
            aiMessage += `### ${index + 1}. ${paper.title}\n`;
            aiMessage += `**Authors:** ${authors}\n`;
            aiMessage += `**Year:** ${year} | **Citations:** ${citations}\n`;
            
            if (paper.abstract) {
              const truncatedAbstract = paper.abstract.length > 300 
                ? paper.abstract.substring(0, 300) + '...' 
                : paper.abstract;
              aiMessage += `**Abstract:** ${truncatedAbstract}\n`;
            }
            
            if (doi) {
              aiMessage += `**DOI:** [${doi}](${doi})\n`;
            }
            
            // APA Reference
            let authorStr = '';
            const authorNames = paper.authors?.map((a: any) => a.name) || [];
            if (authorNames.length === 1) {
              authorStr = authorNames[0];
            } else if (authorNames.length === 2) {
              authorStr = `${authorNames[0]} & ${authorNames[1]}`;
            } else if (authorNames.length > 2) {
              authorStr = `${authorNames[0]} et al.`;
            } else {
              authorStr = 'Unknown Author';
            }
            aiMessage += `**APA Reference:** ${authorStr} (${year}). ${paper.title}.${doi ? ` ${doi}` : ''}\n\n`;
          });
          
          aiMessage += `---\n*These are real academic articles from Semantic Scholar. Click the DOI links to access the full papers.*`;
        }

        // Save AI message to database
        await supabaseClient.from('messages').insert({
          session_id,
          sender: 'ai',
          content: aiMessage,
        });

        // Deduct credits
        const deductResult = deductCredits(creditCost, dailyCredits, monthlyCredits, paidCredits, isActiveSubscriber);
        dailyCredits = deductResult.dailyCredits;
        monthlyCredits = deductResult.monthlyCredits;
        paidCredits = deductResult.paidCredits;

        // Update user profile
        await supabaseClient
          .from('profiles')
          .update({
            daily_credits: dailyCredits,
            monthly_credits: monthlyCredits,
            paid_credits: paidCredits,
            daily_reset_date: today,
          })
          .eq('id', user.id);

        return new Response(
          JSON.stringify({
            response: aiMessage,
            credits_used: creditCost,
            action_type: 'article_search',
            profile: {
              daily_credits: dailyCredits,
              monthly_credits: monthlyCredits,
              paid_credits: paidCredits,
              credits_expiry_date: creditsExpiryDate,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (searchError) {
        console.error('Article search error:', searchError);
        // Fall through to regular AI response if search fails
      }
    }

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
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are ProjectPal, a concise and intelligent academic assistant. You help students with academic projects following Nigerian university standards. Respond directly to what users ask—be thorough for complex requests, brief for simple ones.

## RESPONSE STYLE:
- Be concise and direct. Match response length to request complexity.
- For simple questions: Give brief, focused answers (1-3 paragraphs max).
- For document generation (chapters, sections): Provide full structured content with proper formatting.
- Avoid unnecessary introductions like "Certainly!" or "Of course!". Get straight to the point.
- Only include what the user specifically asks for. Don't over-explain unless requested.
- When unsure about scope, ask clarifying questions rather than assuming the user wants extensive output.

## DOCUMENT STRUCTURE GUIDELINES

### PRELIMINARY PAGES (when requested):
- Title Page: Project title, student name, matriculation number, department, faculty, institution, degree type, submission date
- Certification/Approval Page
- Dedication (brief, 2-3 sentences)
- Acknowledgements (structured: God, supervisor, lecturers, family, friends)
- Abstract (Background, Method, Results, Conclusion, Keywords - 200-300 words)
- Table of Contents with page numbers
- List of Tables/Figures

### CHAPTER ONE - INTRODUCTION:
1.1 Background to the Study (2-3 pages, establish context with citations, flow from broad to specific)
1.2 Statement of the Problem (identify research gap clearly)
1.3 Research Questions (numbered list, aligned with objectives)
1.4 Objectives of the Study (General objective + Specific objectives numbered)
1.5 Hypotheses (null format: "There would be no significant relationship/difference...")
1.6 Significance of the Study (numbered benefits to different stakeholders)
1.7 Scope/Delimitations of the Study
1.8 Limitations of the Study
1.9 Definition of Terms (operational definitions in context of the study)

### CHAPTER TWO - LITERATURE REVIEW:
2.0 Introduction (brief chapter overview)
2.1 Conceptualization (define all major variables with citations)
2.2 Theoretical Framework (2-3 relevant theories with full explanation and application to study)
2.3 Review of Empirical Studies (recent studies organized thematically, synthesize don't just summarize)
2.4 Conceptual Framework (visual model description showing variable relationships)
2.5 Operational Definition of Concepts

### CHAPTER THREE - METHODOLOGY:
3.0 Introduction
3.1 Research Design (e.g., cross-sectional survey, experimental, quasi-experimental)
3.2 Study Area/Population of the Study
3.3 Sample Size Determination (include formula, e.g., Taro Yamane: n = N/(1+N(e)²))
3.4 Sampling Technique (probability/non-probability methods)
3.5 Data Collection Technique
3.6 Research Instruments (questionnaires, scales - include reliability Cronbach's alpha, validity info)
3.7 Procedure for Data Collection
3.8 Method of Data Analysis (statistical tools: descriptive stats, t-test, ANOVA, regression, correlation)
3.9 Ethical Considerations

### CHAPTER FOUR - RESULTS/DATA ANALYSIS:
4.1 Socio-demographic Characteristics of Respondents (table format with frequencies and percentages)
4.2 Descriptive Statistics (means, standard deviations, frequencies in tables)
4.3 Test of Relationships (correlation matrices where applicable)
4.4 Test of Hypotheses (organized by hypothesis number, include statistical values, df, p-values)
- Use format: Table X: Summary of [statistical test] showing [variables]
- Include decision column: "Rejected" or "Not Rejected" based on p < 0.05

### CHAPTER FIVE - DISCUSSION, CONCLUSION & RECOMMENDATIONS:
5.1 Discussion of Findings (organized by research questions/hypotheses, relate to literature)
5.2 Summary of Findings (bullet points of key results)
5.3 Conclusion (synthesis of major findings)
5.4 Recommendations (practical, actionable suggestions)
5.5 Suggestions for Further Research
5.6 Limitations of the Study

### REFERENCES:
- Use APA 7th Edition format
- Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, Volume(Issue), pages. DOI
- Include recent sources (preferably within last 10 years)

## FORMATTING RULES:
- Use hierarchical numbering: 1.1, 1.1.1, 1.1.2, etc.
- Tables: "Table 1:", "Table 2:" with descriptive titles
- Statistical reporting: M = X.XX, SD = X.XX, t(df) = X.XX, p < .05
- Citations: (Author, Year) or Author (Year) stated that...
- Write in formal academic English, third person
- Each paragraph: topic sentence → supporting evidence → conclusion
- Ensure logical flow and proper transitions between sections

## CONTENT QUALITY:
- Background: broad context → specific focus → research gap
- Literature: synthesize sources, show relationships between studies
- Methodology: detailed enough to replicate the study
- Results: objective presentation without interpretation
- Discussion: interpret findings, compare with existing literature
- Always maintain academic integrity

## MANDATORY REFERENCES RULE:
When generating ANY chapter content (Chapter 1-5, Introduction, Literature Review, Methodology, Results, Conclusion, or any substantial academic section), you MUST include a "## References" section at the END of the generated content. The references must:
- Be formatted in APA 7th Edition
- Include at least 10-15 references for major chapters (Ch 1-4), 5-8 for Chapter 5
- Be REAL, verifiable academic sources that actually exist and can be found on Google Scholar
- Include actual author names, real journal names, real publication years, and DOIs where available
- Use sources from well-known academic journals, conferences, and publishers
- DO NOT fabricate or hallucinate references. Only cite sources you are confident exist.
- If you cannot verify a reference, use "[Author] (Year)" format with a note to verify
- References should be relevant to the specific topic being discussed in the chapter`,
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

    // Deduct credits after successful AI response
    const deductResult = deductCredits(creditCost, dailyCredits, monthlyCredits, paidCredits, isActiveSubscriber);
    dailyCredits = deductResult.dailyCredits;
    monthlyCredits = deductResult.monthlyCredits;
    paidCredits = deductResult.paidCredits;

    console.log(`[CREDIT] Deducted ${creditCost} credits from: ${deductResult.creditSource}. After - Daily: ${dailyCredits}, Monthly: ${monthlyCredits}, Paid: ${paidCredits}`);

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

    // Generate intelligent title for first message
    const isFirstMessage = (previousMessages?.length || 0) === 0;
    let generatedTitle: string | null = null;
    
    if (isFirstMessage) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        generatedTitle = await generateIntelligentTitle(message, LOVABLE_API_KEY);
        console.log(`[TITLE] Generated title for first message: "${generatedTitle}"`);
      }
    }

    // Return response
    return new Response(
      JSON.stringify({
        response: aiMessage,
        credits_used: creditCost,
        action_type: actionType,
        generated_title: generatedTitle,
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
