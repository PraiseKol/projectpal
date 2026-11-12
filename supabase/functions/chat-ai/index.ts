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

// Generate an intelligent chat title using AI
async function generateIntelligentTitle(userMessage: string, apiKey: string): Promise<string> {
  try {
    const response = await fetchGemini('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('GEMINI_LITE_MODEL') ?? 'gemini-3.5-flash-lite',
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

// Chapter cost map (default values; overridden by app_settings at runtime)
const CHAPTER_COSTS: Record<string, number> = {
  chapter_1: 5,
  chapter_2: 10,
  chapter_3: 25,
  chapter_4: 50,
  chapter_5: 5,
  references: 15,
};

// Detect all chapters explicitly requested in a single message
function detectRequestedChapters(message: string): string[] {
  const chapters: string[] = [];
  const msgLower = message.toLowerCase();

  // Range patterns: "chapters 1-3", "chapters 1 to 3", "chapters 1 through 3"
  const rangeMatch = msgLower.match(/chapters?\s+(\d+|one|two|three|four|five)\s*(?:to|through|-)\s*(\d+|one|two|three|four|five)/i);
  if (rangeMatch) {
    const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const start = parseInt(rangeMatch[1]) || wordToNum[rangeMatch[1].toLowerCase()] || 0;
    const end = parseInt(rangeMatch[2]) || wordToNum[rangeMatch[2].toLowerCase()] || 0;
    for (let i = start; i <= end && i >= 1 && i <= 5; i++) {
      chapters.push(`chapter_${i}`);
    }
    return chapters;
  }

  // List patterns: "chapter 1 and 2", "chapters 1, 2, and 3"
  const listMatch = msgLower.match(/chapters?\s+([\d,\s]+(?:and\s+)?[\d]+)/i);
  if (listMatch) {
    const nums = listMatch[1].match(/\d+/g);
    if (nums) {
      nums.forEach(n => {
        const num = parseInt(n);
        if (num >= 1 && num <= 5) chapters.push(`chapter_${num}`);
      });
      if (chapters.length >= 2) return chapters;
    }
  }

  return [];
}

// Regex fallback for credit cost detection
function determineCreditCostFallback(message: string): { cost: number; actionType: string; chapters?: string[] } {
  const msgLower = message.toLowerCase();

  // Multi-chapter detection first
  const requestedChapters = detectRequestedChapters(message);
  if (requestedChapters.length >= 2) {
    const totalCost = requestedChapters.reduce((sum, ch) => sum + (CHAPTER_COSTS[ch] || 5), 0);
    return { cost: totalCost, actionType: 'multi_chapter', chapters: requestedChapters };
  }

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
  if (/\b(references?|bibliography|works?\s+cited|reference\s+list|apa\s+references?|citation\s+list)\b/i.test(msgLower)) {
    return { cost: 15, actionType: 'references' };
  }
  if (/\b(suggest|generate|topic|proposal|outline|section|continue|expand|elaborate|extend|add\s+more)\b/i.test(msgLower)) {
    return { cost: 2, actionType: 'generation_suggestion' };
  }
  return { cost: 1, actionType: 'simple_chat' };
}

// AI-based request classification to prevent credit loopholes
async function classifyRequest(message: string, conversationContext: string, apiKey: string): Promise<{ cost: number; actionType: string; chapters?: string[] }> {
  try {
    // Multi-chapter regex check first (fast, no AI needed)
    const multiChapterCheck = detectRequestedChapters(message);
    if (multiChapterCheck.length >= 2) {
      const totalCost = multiChapterCheck.reduce((sum, ch) => sum + (CHAPTER_COSTS[ch] || 5), 0);
      console.log(`[CLASSIFY] Multi-chapter detected via regex: ${multiChapterCheck.join(', ')}, cost: ${totalCost}`);
      return { cost: totalCost, actionType: 'multi_chapter', chapters: multiChapterCheck };
    }

    const classificationPrompt = `You are a strict credit cost classifier for an academic writing assistant. Classify the user's request based on what they are ACTUALLY asking the AI to generate or do.

CLASSIFICATION RULES (be strict - if the user is asking for content generation of any kind that matches a chapter, classify it as that chapter):

- "chapter_1" (5 credits): GENERATING/WRITING Chapter 1, Introduction chapter content
- "chapter_2" (10 credits): GENERATING/WRITING Chapter 2, Literature Review content
- "chapter_3" (25 credits): GENERATING/WRITING Chapter 3, Methodology content
- "chapter_4" (50 credits): GENERATING/WRITING Chapter 4, Results and Discussion content
- "chapter_5" (5 credits): GENERATING/WRITING Chapter 5, Conclusion content
- "chapter_inquiry" (1 credit): ASKING QUESTIONS ABOUT a chapter WITHOUT requesting generation. E.g., "What should chapter 3 contain?", "How long should chapter 2 be?", "What goes in the methodology?", "Explain what the literature review covers". These are informational questions, NOT generation requests.
- "chapter_1_outline" (3 credits): Requesting an OUTLINE for Chapter 1 only
- "chapter_2_outline" (5 credits): Requesting an OUTLINE for Chapter 2 only
- "chapter_3_outline" (13 credits): Requesting an OUTLINE for Chapter 3 only
- "chapter_4_outline" (25 credits): Requesting an OUTLINE for Chapter 4 only
- "chapter_5_outline" (3 credits): Requesting an OUTLINE for Chapter 5 only
- "project_outline" (10 credits): Requesting an outline of the ENTIRE project, all chapters, or the full project structure
- "research_proposal" (20 credits): Writing a full research proposal, project proposal
- "fully_wrap_project" (50 credits): Wrapping an entire project, generating all preliminary/end pages
- "generation_suggestion" (2 credits): Generating topics, outlines for non-chapter items, suggestions, expanding a paragraph, editing a section, continuing writing, improving text
- "references" (15 credits): Generating references, bibliography, reference list, works cited, APA references, citation list, footnotes list for the project
- "article_search" (1 credit): Searching for articles, finding papers, looking up references on a search engine
- "simple_chat" (1 credit): Asking questions, seeking advice, clarification, greetings, or any non-generation request

IMPORTANT DISTINCTIONS:
1. "Write chapter 3" or "Help me write the methodology" = chapter_3 (GENERATION). "What should chapter 3 contain?" or "How do I structure my methodology?" = chapter_inquiry (INFORMATIONAL).
2. "Give me an outline for chapter 2" = chapter_2_outline. "Give me an outline for the whole project" = project_outline.
3. "Write section 1.1 of chapter 1" or "Just the background to the study" = partial chapter request, still classify as the parent chapter (chapter_1).
4. "Continue from where you stopped" after a chapter generation is the SAME chapter type.

Return ONLY valid JSON: {"actionType": "category_name", "cost": number}`;

    const response = await fetchGemini('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('GEMINI_LITE_MODEL') ?? 'gemini-3.5-flash-lite',
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
    const defaultTypes: Record<string, number> = {
      chapter_1: 5, chapter_2: 10, chapter_3: 25, chapter_4: 50, chapter_5: 5,
      chapter_inquiry: 1,
      chapter_1_outline: 3, chapter_2_outline: 5, chapter_3_outline: 13, chapter_4_outline: 25, chapter_5_outline: 3,
      project_outline: 10,
      references: 15,
      research_proposal: 20, fully_wrap_project: 50, generation_suggestion: 2,
      article_search: 1, simple_chat: 1,
    };

    if (parsed.actionType && defaultTypes[parsed.actionType] !== undefined) {
      console.log(`[CLASSIFY] AI classified as: ${parsed.actionType}`);
      return { cost: defaultTypes[parsed.actionType], actionType: parsed.actionType };
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

const SYSTEM_PROMPT = `You are ProjectPal, a concise and intelligent academic assistant. You help students with academic projects following Nigerian university standards. Respond directly to what users ask—be thorough for complex requests, brief for simple ones.

## DEPARTMENT DETECTION:
IMPORTANT: Before generating any project content, detect the student's department/discipline from their messages. Look for these indicators:

**LAW DEPARTMENT indicators:** law, legal, LL.B, long essay, statute, case law, tort, contract law, criminal law, constitutional law, jurisprudence, litigation, judicial, court, plaintiff, defendant, appellant, respondent, legislation, regulatory framework, NIALS, legal framework, Act, Bill, decree, ordinance, bye-law, common law, equity, precedent, obiter dictum, ratio decidendi, stare decisis, ultra vires, locus standi, mens rea, actus reus, habeas corpus, certiorari, mandamus, arbitration, ADR, FCCPA, CFRN, LFN, College of Law, Faculty of Law, law school

If ANY of these indicators are present, use the LAW DEPARTMENT structure below. Otherwise, use the DEFAULT (Science/Social Science) structure.

## RESPONSE STYLE:
- For simple questions (definitions, explanations, "what is X?"): Give focused answers (2-5 paragraphs).
- For document generation (chapters, outlines, references, bibliographies): Generate FULL, COMPREHENSIVE, SUBSTANTIVE content. Never summarize or abbreviate. Every subsection must be fleshed out with real academic depth, examples, citations, and thorough discussion.
- Avoid unnecessary introductions like "Certainly!" or "Of course!". Get straight to the content.
- When generating academic content, ALWAYS err on the side of MORE content, not less. Students need complete, submission-ready material.
- Do NOT truncate, summarize, or shorten generated chapters/sections under any circumstances.
- Each generated chapter must be long and comprehensive: Ch1 & Ch3: at least 15 pages (~4500 words), Ch2: at least 25 pages (~7500 words), Ch4: at least 20 pages (~6000 words), Ch5: at least 10 pages (~3000 words). Each page ≈ 300 words.

---

## DEFAULT DOCUMENT STRUCTURE (All Departments)
NOTE: This default structure works for ALL departments including Computer Science, Engineering, Business, Education, Social Sciences, Natural Sciences, Health Sciences, Arts, Humanities, and any other field. Only Law uses a different structure below.

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
2.3 Review of Empirical Studies (recent studies organized thematically — see EMPIRICAL REVIEW FORMAT below)
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

### DEFAULT REFERENCES:
- Use APA 7th Edition format
- Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, Volume(Issue), pages. DOI
- Include recent sources (preferably within last 10 years)

---

## LAW DEPARTMENT LONG ESSAY STRUCTURE (LL.B Hons)

IMPORTANT: This structure applies ONLY when the student is from a Law department/faculty. Law projects may be called "Long Essays", "Projects", or "Dissertations" depending on the institution — use whatever term the student uses. They follow doctrinal/qualitative methodology (NEVER quantitative, surveys, or questionnaires). They use footnotes for citations (NOT in-text APA). The writing style uses legal reasoning, case law analysis, and statutory interpretation.

### PRELIMINARY PAGES (Law-Specific):
- **Title Page**: Long Essay title, student name, matriculation number, "College of Law" / "Faculty of Law", institution name, "In Partial Fulfilment of the Requirements for the Award of Bachelor of Laws (LL.B Hons)", Month and Year
- **Declaration Page**: Student declares the work is original and has not been submitted elsewhere
- **Certification Page**: Supervisor certifies the work is adequate for the award
- **Dedication**
- **Acknowledgements**
- **Table of Contents**
- **Table of Cases**: List ALL cases cited in the essay in alphabetical order with full law report citations. Format: *Case Name* (Year) Volume Report Abbreviation Page. Examples:
  - *Abacha v Fawehinmi* (2000) 6 NWLR (Pt 660) 228
  - *Donoghue v Stevenson* [1932] AC 562
  - *Carlill v Carbolic Smoke Ball Co* [1893] 1 QB 256
- **Table of Statutes / List of Statutes**: List ALL statutes, Acts, decrees referenced. Format: Full title with year and cap number where applicable. Examples:
  - Constitution of the Federal Republic of Nigeria 1999 (as amended)
  - Federal Competition and Consumer Protection Act (FCCPA) 2018
  - Consumer Protection Council Act, Cap C25, LFN 2004
  - Companies and Allied Matters Act (CAMA) 2020
- **Table of International Conventions** (if comparative): List treaties, conventions, protocols referenced
- **List of Abbreviations**: Define all abbreviations used (e.g., FCCPA - Federal Competition and Consumer Protection Act, NAFDAC - National Agency for Food and Drug Administration and Control, ADR - Alternative Dispute Resolution, CFRN - Constitution of the Federal Republic of Nigeria)
- **Abstract**: 200-300 words summarizing the research problem, methodology (doctrinal), key findings, and recommendations. End with 4-6 keywords.

### CHAPTER ONE - GENERAL INTRODUCTION:
1.0 Introduction / Background to the Study (establish the legal context, historical development of the area of law, current state of affairs, why the topic is important)
1.1 Statement of the Problem (identify specific gaps, inadequacies, or conflicts in existing law, regulation, or enforcement)
1.2 Aim and Objectives of the Study (Aim: one overarching goal. Objectives: 4-6 specific objectives using legal research verbs like "examine", "analyse", "evaluate", "assess", "compare", "recommend")
1.3 Research Questions (aligned with objectives, framed as legal inquiry questions)
1.4 Research Methodology (ALWAYS doctrinal/qualitative. State: "This study adopts the doctrinal research methodology, also known as library-based research. It relies on primary sources of law including statutes, case law, and constitutional provisions, as well as secondary sources including textbooks, journal articles, law reports, and online materials.")
1.5 Significance of the Study (contribution to legal scholarship, policy reform, judicial practice, public awareness)
1.6 Scope and Limitations of the Study (geographic scope, subject-matter scope, time period, limitations of doctrinal method)
1.7 Structure/Outline of Chapters (brief description of what each chapter covers)
1.8 Definition of Terms (legal definitions with case law citations and statutory definitions. Define key legal concepts using authoritative sources. Example: "Consumer: Section 167 of the FCCPA 2018 defines a consumer as...")

### CHAPTER TWO - CONCEPTUAL/THEORETICAL FRAMEWORK AND LITERATURE REVIEW:
2.0 Introduction (brief overview of the chapter)
2.1 Conceptual Clarification / Conceptual Framework (define all key legal concepts with reference to case law, statutes, and scholarly opinions. For each concept, cite: statutory definition, judicial interpretation from cases, and academic commentary)
2.2 Theoretical/Conceptual Analysis (analyse key legal doctrines, principles, and theories relevant to the topic. E.g., doctrine of privity, caveat emptor, strict liability, negligence, vicarious liability. Trace historical development and current application)
2.3 Literature Review (organize thematically by legal scholars and their positions. Discuss what scholars have written about the topic, identify areas of agreement and disagreement, highlight gaps in existing literature that this essay addresses. Reference specific books, journal articles, and legal commentaries)

### CHAPTER THREE - LEGAL AND REGULATORY FRAMEWORK:
3.0 Introduction
3.1 Constitutional Provisions (analyse relevant sections of the CFRN 1999 that relate to the topic. Quote specific sections and provide judicial interpretations from case law)
3.2 Statutory Provisions (detailed section-by-section analysis of the primary Act(s) governing the subject matter. Quote relevant sections, discuss their scope, analyse judicial interpretations)
3.3 Subsidiary Legislation and Regulations (analyse relevant regulations, rules, and guidelines issued under the primary legislation)
3.4 Regulatory Bodies and Their Roles (examine the powers, functions, and effectiveness of relevant regulatory bodies. E.g., FCCPC, NAFDAC, SON, CBN, SEC)
3.5 Comparative Analysis with Other Jurisdictions (compare Nigerian legal framework with at least 2-3 other jurisdictions such as UK, USA, South Africa, EU, Ghana, Kenya. Identify best practices and lessons for Nigeria)
3.6 Common Law Principles and Case Law Analysis (analyse key judicial decisions that have shaped the law in this area. Discuss the ratio decidendi, obiter dicta, and their implications)
3.7 Challenges and Gaps in the Legal Framework (identify specific weaknesses, lacunae, conflicts, and enforcement challenges)

### CHAPTER FOUR - CASE ANALYSIS / APPLICATION OF LAW:
4.0 Introduction
4.1-4.X Analysis of Landmark Cases (select 5-10 landmark cases and analyse each in detail: facts, issues, arguments, court's decision, ratio decidendi, implications)
4.X+1 Breach/Liability Analysis (analyse how breaches of the relevant law are established, burden of proof, standard of proof)
4.X+2 Judicial Remedies and ADR Mechanisms (analyse available remedies: damages, injunctions, specific performance, restitution. Discuss effectiveness of ADR including arbitration, mediation, conciliation)
4.X+3 Ethical Implications (discuss ethical dimensions of the legal issues)
4.X+4 Institutional Roles and Enforcement (analyse the role of courts, tribunals, regulatory bodies in enforcement and adjudication)

### CHAPTER FIVE - SUMMARY, CONCLUSION AND RECOMMENDATIONS:
5.0/5.1 Summary of Findings (summarize key findings from each chapter, organized by research objectives)
5.2 Conclusion (synthesize the overall findings, state whether the aims and objectives were achieved, provide a definitive legal position on the research questions)
5.3 Recommendations (provide specific, actionable recommendations for: legislative reform, regulatory improvement, judicial practice, policy development, public awareness. Each recommendation should address a specific gap or challenge identified in the study)

### BIBLIOGRAPHY (Law-Specific):
Organize the bibliography into these categories:

**A. Books / Textbooks:**
- Format: Surname, Initials, *Title of Book* (Publisher, Edition, Year)
- Example: Sagay, IE, *Nigerian Law of Contract* (Spectrum Books, 2nd edn, 2000)
- Example: Oshio, PE, *Principles of Environmental Law* (University of Benin Press, 2010)

**B. Journal Articles:**
- Format: Surname, Initials, 'Title of Article' (Year) Volume(Issue) Journal Name, Pages
- Example: Aina, K, 'Consumer Protection in Nigeria: Challenges and the Way Forward' (2019) 10(2) Journal of Law and Criminal Justice, 45-62
- Example: Nwauche, ES, 'The Right to a Clean Environment in Nigeria' (2010) 8(1) African Journal of International and Comparative Law, 120-138

**C. Online Sources / Internet Materials:**
- Format: Author/Organization, 'Title' (Website, Date) <URL> accessed Date
- Example: World Health Organization, 'Consumer Safety Guidelines' (WHO, 2020) <https://www.who.int/consumer> accessed 15 March 2024

**D. Table of Cases** (repeat from preliminary pages)

**E. Table of Statutes** (repeat from preliminary pages)

### LAW CITATION STYLE:
- Use FOOTNOTES as the primary citation method within the text body. Number footnotes sequentially throughout each chapter.
- In-text: Use superscript numbers¹ ² ³ after the relevant statement
- Footnote format for cases: *Case Name* (Year) Volume Report Page. Example: ¹ *Abacha v Fawehinmi* (2000) 6 NWLR (Pt 660) 228
- Footnote format for statutes: Section X, Full Act Name Year. Example: ² Section 123, Federal Competition and Consumer Protection Act 2018
- Footnote format for books: Surname, *Title* (n X) page. Example: ³ Sagay, *Nigerian Law of Contract* (n 1) 45
- Footnote format for journal articles: Surname, 'Title' (n X) page. Example: ⁴ Aina, 'Consumer Protection in Nigeria' (n 3) 52
- Use "ibid" for immediately preceding source, "op cit" or "(n X)" for previously cited sources
- Latin maxims should be italicized: *nemo dat quod non habet*, *caveat emptor*, *res ipsa loquitur*, *volenti non fit injuria*

### LAW WRITING STYLE:
- Use formal, third-person legal writing throughout
- Use doctrinal analysis: examine and interpret primary legal sources (statutes, cases, constitutions) supported by secondary sources (textbooks, journal articles)
- NEVER include quantitative methodology, questionnaires, surveys, hypotheses, ANOVA, Cronbach's alpha, or statistical analysis for law projects
- Structure arguments using IRAC method where applicable: Issue, Rule, Application, Conclusion
- Use transitional phrases appropriate for legal writing: "It is submitted that...", "The court held that...", "It is pertinent to note that...", "The position of the law is...", "With due respect..."
- Reference specific sections of statutes (e.g., "By virtue of Section 17(2) of the FCCPA 2018...")
- Quote judicial pronouncements directly with attribution to the judge (e.g., "Per Onnoghen JSC in...")

---

## FORMATTING RULES:
- CRITICAL: Do NOT use markdown symbols in chapter content. Do NOT use # ## ### for headings. Do NOT use ** or *** for bold/italic. Instead, use plain numbered section headings (e.g., "1.1 Background to the Study") and write in natural flowing prose. The content should read cleanly without any special formatting characters.
- Use hierarchical numbering: 1.1, 1.1.1, 1.1.2, etc.
- Tables: "Table 1:", "Table 2:" with descriptive titles
- For Science/Social Science: Statistical reporting: M = X.XX, SD = X.XX, t(df) = X.XX, p < .05
- For Science/Social Science: Citations: (Author, Year) or Author (Year) stated that...
- For Law: Use footnote numbering (superscript) and NIALS/hybrid citation style
- Write in formal academic English, third person
- Each paragraph: topic sentence → supporting evidence → conclusion
- Ensure logical flow and proper transitions between sections

## CONTENT QUALITY:
- Background: broad context → specific focus → research gap
- Literature: synthesize sources, show relationships between studies/legal positions
- For Science: Methodology detailed enough to replicate the study
- For Law: Methodology is doctrinal/library-based (no replication needed)
- Results/Case Analysis: objective presentation with legal reasoning
- Discussion: interpret findings, compare with existing literature/case law
- Always maintain academic integrity

## EMPIRICAL REVIEW FORMAT (Section 2.3 — Review of Empirical Studies):
When generating empirical review content, follow these rules strictly:
- Each study MUST be presented as a FULL PARAGRAPH (minimum 4-6 sentences), NOT a bullet point, one-liner, or summary.
- Each paragraph must include ALL of: (a) Author(s) and year, (b) research objective/purpose, (c) methodology/model used (e.g., ARDL, EGARCH, ECM, OLS, survey design, panel data), (d) data period and scope, (e) key findings, (f) policy recommendations or implications.
- IMPORTANT — NATURAL VARIATION: Do NOT follow the same rigid order for every paragraph. Vary the structure naturally across different study paragraphs to make the writing sound human and organic. For example:
  * One paragraph might lead with the methodology: "Using an ARDL bounds testing approach, Author (Year) investigated..."
  * Another might lead with findings: "Findings from Author et al. (Year) revealed that... The study, which employed..."
  * Another might lead with context: "In the Nigerian banking sector, Author (Year) examined..."
  * Another might start with the research gap: "To address the gap in understanding X, Author (Year) conducted..."
  * The key is that ALL six elements appear in each paragraph, but the ORDER and sentence structure should vary naturally.
- Include a MINIMUM of 15-20 different studies for a full empirical review section.
- Group studies thematically by sub-topic, variable, or relationship being studied.
- NEVER list studies as bullet points or one-line summaries. Each must be a rich, detailed paragraph.
- CRITICAL CITATION VERIFIABILITY: ALL cited papers MUST be REAL, verifiable academic publications that can be found on Google Scholar, Semantic Scholar, ResearchGate, or institutional repositories. Do NOT fabricate or hallucinate any author names, paper titles, journals, years, or findings. If you are not certain a paper exists, do NOT cite it. Students WILL verify every citation on Google Scholar — any fabricated reference destroys credibility.
- For empirical studies specifically: cite the actual methodology, actual sample periods, and actual findings from the real paper.

## MANDATORY REFERENCES RULE:
When generating ANY chapter content (Chapter 1-5, Introduction, Literature Review, Methodology, Results, Conclusion, or any substantial academic section), you MUST include references at the END of the generated content.

**For Science/Social Science projects:**
- Include a "## References" section
- Be formatted in APA 7th Edition
- Include at least 10-15 references for major chapters (Ch 1-4), 5-8 for Chapter 5
- Be REAL, verifiable academic sources that actually exist and can be found on Google Scholar
- Include actual author names, real journal names, real publication years, and DOIs where available
- Use sources from well-known academic journals, conferences, and publishers
- DO NOT fabricate or hallucinate references. Only cite sources you are confident exist.
- If you cannot verify a reference, use "[Author] (Year)" format with a note to verify
- References should be relevant to the specific topic being discussed in the chapter

**For Law Long Essays:**
- Include a "## Bibliography" section (NOT "References")
- Organize into subsections: A. Books/Textbooks, B. Journal Articles, C. Online Sources, D. Table of Cases, E. Table of Statutes
- Use NIALS or standard Nigerian legal citation format (NOT APA)
- All case citations must include proper law report citations (e.g., NWLR, All ER, SC, QB, AC, WLR)
- All statute citations must include full title and year
- Be REAL, verifiable legal sources. Cases must be real decided cases. Statutes must be real enacted legislation.
- DO NOT fabricate cases or statutes. Only cite sources you are confident exist.
- Include at least 10-15 sources for major chapters (Ch 1-4), 5-8 for Chapter 5
- Include a mix of Nigerian and international legal sources where appropriate

## CRITICAL CHAPTER RULE — MANDATORY:
Generate ONLY the specific chapter(s) the user explicitly requests in their current message.
- If the user asks for "Chapter 2", generate ONLY Chapter 2. Do NOT generate Chapter 1 as an introduction to Chapter 2.
- If the user asks for "Chapter 3", generate ONLY Chapter 3. Do NOT include Chapter 1 or 2 before it.
- Do NOT generate any chapter the user did not explicitly request in their current message.
- Partial requests such as "continue" or "add more to chapter 2" apply only to that specific chapter.
- This rule overrides any other instruction that might cause you to include extra chapters.

## PARTIAL CHAPTER REQUESTS — REFUSAL RULE:
If a user asks for only a PART or SECTION of a chapter (e.g., "Write only section 1.1", "Just the background to the study", "Generate only the statement of the problem", "Write 3.1 to 3.4 only"), you MUST refuse and explain that you can only generate complete chapters, not partial sections. Say something like: "I can only generate complete chapters, not individual sections. Would you like me to generate the full Chapter X instead?" Do NOT generate partial chapter content.

## CHAPTER LENGTH REQUIREMENTS:
When generating full chapter content, produce substantive, comprehensive academic prose:
- Chapter 1 (Introduction): Minimum 15 pages (~4500 words)
- Chapter 2 (Literature Review): Minimum 25 pages (~7500 words)
- Chapter 3 (Methodology): Minimum 15 pages (~4500 words)
- Chapter 4 (Results & Discussion): Minimum 20 pages (~6000 words)
- Chapter 5 (Conclusion): Minimum 10 pages (~3000 words)
- Each "page" is approximately 300 words of academic prose.
- Be thorough and detailed in every section. Students need substantive, comprehensive content.
- Do NOT be brief or scanty when generating chapters. Fill out every subsection with real academic depth and analysis.
- Include detailed explanations, examples, and scholarly discussion throughout.

## CHAPTER INQUIRY vs GENERATION:
If the user is merely ASKING ABOUT a chapter (e.g., "What should chapter 3 contain?", "How long should chapter 2 be?", "What goes in the methodology?"), provide an informational explanation WITHOUT generating the actual chapter content. Keep the response concise and helpful. Do NOT treat informational questions as generation requests.`;

// ======================= Long-form chapter writing =======================
// A chapter is written as several long parts at the same time. All parts follow one study brief so
// they agree with each other, and a reference list is written from the finished text.

type PlanPart = { sections: string; guide: string; words: number };
const CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const LAW_PATTERN = /\b(law|legal|ll\.?b|long essay|statute|statutory|case law|tort|constitutional|jurisprudence|litigation|judicial|plaintiff|defendant|nials|legislation|doctrinal|college of law|faculty of law)\b/i;

const CHAPTER_HEADINGS: Record<string, string> = {
  chapter_1: 'CHAPTER ONE\nINTRODUCTION',
  chapter_2: 'CHAPTER TWO\nLITERATURE REVIEW',
  chapter_3: 'CHAPTER THREE\nRESEARCH METHODOLOGY',
  chapter_4: 'CHAPTER FOUR\nDATA PRESENTATION, ANALYSIS AND DISCUSSION OF FINDINGS',
  chapter_5: 'CHAPTER FIVE\nSUMMARY, CONCLUSION AND RECOMMENDATIONS',
};
const LAW_CHAPTER_HEADINGS: Record<string, string> = {
  chapter_1: 'CHAPTER ONE\nGENERAL INTRODUCTION',
  chapter_2: 'CHAPTER TWO\nCONCEPTUAL FRAMEWORK AND LITERATURE REVIEW',
  chapter_3: 'CHAPTER THREE\nLEGAL AND REGULATORY FRAMEWORK',
  chapter_4: 'CHAPTER FOUR\nCASE ANALYSIS AND APPLICATION OF THE LAW',
  chapter_5: 'CHAPTER FIVE\nSUMMARY, CONCLUSION AND RECOMMENDATIONS',
};

const CHAPTER_PLANS: Record<string, PlanPart[]> = {
  chapter_1: [
    { sections: '1.0 Introduction (a short chapter overview) and 1.1 Background to the Study', guide: 'Move from the broad global context, to the African and Nigerian context, to the specific focus of the study. Use real, verifiable sources cited in APA style (Author, Year).', words: 1300 },
    { sections: '1.2 Statement of the Problem, 1.3 Research Questions and 1.4 Objectives of the Study', guide: 'The problem statement must show a clear gap. Give the general objective and the specific objectives (numbered), and one research question for each specific objective, exactly as set out in the study brief.', words: 1100 },
    { sections: '1.5 Research Hypotheses and 1.6 Significance of the Study', guide: 'State each null hypothesis (H01, H02, ...) exactly as in the study brief, then explain the significance for each stakeholder group in its own paragraph.', words: 1100 },
    { sections: '1.7 Scope and Delimitations of the Study, 1.8 Limitations of the Study, 1.9 Operational Definition of Terms and 1.10 Organisation of the Study', guide: 'Define every key term in the context of this study. Finish with a paragraph on how the five chapters are organised.', words: 1200 },
  ],
  chapter_2: [
    { sections: '2.0 Introduction and 2.1 Conceptual Review (the first half of the key concepts in the study brief)', guide: 'Define and discuss each concept in depth with sources, its dimensions, measurement and relevance to the study.', words: 1400 },
    { sections: '2.1 Conceptual Review (continued: the remaining key concepts and the relationships between the concepts)', guide: 'Continue the conceptual review with the remaining concepts, then discuss how the concepts relate to one another. Do not write a heading for 2.1 again; continue directly.', words: 1400 },
    { sections: '2.2 Theoretical Framework', guide: 'Explain each of the theories named in the study brief in depth: origin, main propositions, strengths and criticisms, and exactly how it applies to this study.', words: 1500 },
    { sections: '2.3 Review of Empirical Studies, first group: the main relationship being studied and the main variables (studies from the last ten years, international and Nigerian)', guide: 'Write at least eight studies, each as a full paragraph of 5 to 7 sentences covering author and year, objective, methodology or model, sample or data period, key findings and recommendations. Vary how the paragraphs begin. Use only real, verifiable studies.', words: 1500 },
    { sections: '2.3 Review of Empirical Studies, second group: moderating or mediating factors, methodological differences and contradictory findings', guide: 'Write at least eight different studies, each as a full paragraph with the same six elements. Do not repeat studies that belong to the other groups. Use only real, verifiable studies. Do not write a heading for 2.3 again; continue directly.', words: 1500 },
    { sections: '2.3 Review of Empirical Studies, third group: Nigerian and wider African studies on the topic', guide: 'Write at least seven studies with a Nigerian or African focus, each as a full paragraph with the same six elements. Use only real, verifiable studies. Do not write a heading for 2.3 again; continue directly.', words: 1400 },
    { sections: '2.4 Conceptual Framework, 2.5 Summary of the Literature Review and 2.6 Research Gap', guide: 'Describe the conceptual framework in words (variables and the hypothesised relationships, as if explaining a diagram). Then synthesise the literature and state the gap this study fills.', words: 1200 },
  ],
  chapter_3: [
    { sections: '3.0 Introduction and 3.1 Research Design', guide: 'Name the design from the study brief and justify it against the alternatives, with sources.', words: 1100 },
    { sections: '3.2 Study Area and Population of the Study, 3.3 Sample Size Determination and 3.4 Sampling Technique', guide: 'Describe the study area and population in detail. Show the sample size formula (for example Taro Yamane) and work through the calculation with the figures in the study brief. Explain every stage of the sampling technique.', words: 1300 },
    { sections: '3.5 Data Collection Technique and 3.6 Research Instrument', guide: 'Describe the instrument section by section (demographics, each variable, the scale used) and say how the items were developed.', words: 1200 },
    { sections: '3.7 Validity and Reliability of the Instrument and 3.8 Procedure for Data Collection', guide: 'Explain face and content validity, the pilot test, and the reliability method from the study brief (for example Cronbach alpha with the acceptable threshold). Then describe the data collection procedure step by step.', words: 1200 },
    { sections: '3.9 Method of Data Analysis and 3.10 Ethical Considerations', guide: 'Explain each statistical tool in the study brief, why it was chosen and how it will be used to answer each research question and test each hypothesis, including the decision rule at the 0.05 level. Then cover the ethical considerations in full.', words: 1300 },
  ],
  chapter_4: [
    { sections: '4.1 Introduction, 4.2 Data Screening and Response Rate and 4.3 Socio-Demographic Characteristics of Respondents', guide: 'Describe how each table should be laid out and write the full explanatory prose around the placeholders.', words: 1300 },
    { sections: '4.4 Analysis of Research Questions (one subsection for each research question in the study brief)', guide: 'For each research question describe the table of descriptive statistics, explain how to read it, and write the interpretation around the placeholders.', words: 1500 },
    { sections: '4.5 Test of Hypotheses (one subsection for each hypothesis in the study brief)', guide: 'For each hypothesis state the hypothesis, the test used and why, the assumptions, the layout of the output table, the decision rule at the 0.05 level, and write the interpretation for both the significant and the not significant outcome.', words: 1500 },
    { sections: '4.6 Discussion of Findings, first half (the findings for the first objectives and hypotheses)', guide: 'Discuss what each finding would mean, tie it to the theories in the study brief, and say how it agrees or disagrees with the kinds of findings reported in the literature, without naming specific authors or years.', words: 1300 },
    { sections: '4.6 Discussion of Findings (continued: the remaining objectives and hypotheses) and 4.7 Summary of Findings', guide: 'Continue the discussion for the remaining findings without repeating the heading, then summarise the chapter.', words: 1300 },
  ],
  chapter_5: [
    { sections: '5.1 Introduction, 5.2 Summary of the Study and 5.3 Summary of Findings', guide: 'Recap the problem, objectives, methodology and main findings, one finding per objective.', words: 1200 },
    { sections: '5.4 Conclusion and 5.5 Contributions to Knowledge', guide: 'Draw a definitive conclusion for each objective and explain the theoretical, practical and methodological contributions.', words: 1100 },
    { sections: '5.6 Recommendations', guide: 'Give specific, actionable recommendations for each stakeholder, each in its own paragraph, with the reason it follows from the findings.', words: 1200 },
    { sections: '5.7 Limitations of the Study and 5.8 Suggestions for Further Research', guide: 'Be honest about the limitations and propose concrete, well-explained directions for further research.', words: 1000 },
  ],
};

const LAW_CHAPTER_PLANS: Record<string, PlanPart[]> = {
  chapter_1: [
    { sections: '1.0 Introduction and Background to the Study and 1.1 Statement of the Problem', guide: 'Establish the legal context, the historical development of the area of law, the present position and the gaps. Cite real statutes and cases, using footnote-style numbering.', words: 1300 },
    { sections: '1.2 Aim and Objectives of the Study, 1.3 Research Questions, 1.4 Research Methodology and 1.5 Significance of the Study', guide: 'The methodology is always doctrinal (library-based). State the aim and four to six objectives with legal research verbs, and the matching research questions.', words: 1200 },
    { sections: '1.6 Scope and Limitations of the Study, 1.7 Structure of the Chapters and 1.8 Definition of Terms', guide: 'Define each key legal term with its statutory definition and judicial interpretation, citing real authorities.', words: 1200 },
  ],
  chapter_2: [
    { sections: '2.0 Introduction and 2.1 Conceptual Clarification (first half of the key legal concepts)', guide: 'For each concept give the statutory definition, the judicial interpretation with real cases, and scholarly commentary.', words: 1400 },
    { sections: '2.1 Conceptual Clarification (continued: the remaining key legal concepts)', guide: 'Continue directly with the remaining concepts without repeating the heading.', words: 1400 },
    { sections: '2.2 Theoretical and Doctrinal Analysis (first half of the relevant doctrines)', guide: 'Trace the historical development and present application of each doctrine, with real cases.', words: 1400 },
    { sections: '2.2 Theoretical and Doctrinal Analysis (continued: the remaining doctrines)', guide: 'Continue directly with the remaining doctrines without repeating the heading.', words: 1400 },
    { sections: '2.3 Literature Review', guide: 'Organise thematically by scholars and their positions, the areas of agreement and disagreement, and the gap this study fills. Cite only real books and articles.', words: 1500 },
  ],
  chapter_3: [
    { sections: '3.0 Introduction and 3.1 Constitutional Provisions', guide: 'Analyse the relevant sections of the Constitution of the Federal Republic of Nigeria 1999 (as amended) with judicial interpretations from real cases.', words: 1300 },
    { sections: '3.2 Statutory Provisions and 3.3 Subsidiary Legislation and Regulations', guide: 'Give a section-by-section analysis of the principal Acts governing the subject matter, then the regulations made under them.', words: 1400 },
    { sections: '3.4 Regulatory Bodies and Their Roles', guide: 'Examine the powers, functions and effectiveness of each relevant regulatory body.', words: 1100 },
    { sections: '3.5 Comparative Analysis with Other Jurisdictions, first half (the United Kingdom and the United States)', guide: 'Compare the position with Nigeria and identify the best practice and lessons.', words: 1300 },
    { sections: '3.5 Comparative Analysis with Other Jurisdictions (continued: South Africa, Ghana, Kenya or the European Union)', guide: 'Continue directly with the remaining jurisdictions without repeating the heading.', words: 1300 },
    { sections: '3.6 Common Law Principles and Case Law Analysis', guide: 'Analyse the key decisions, with the ratio decidendi and obiter dicta of each, citing real cases correctly.', words: 1400 },
    { sections: '3.7 Challenges and Gaps in the Legal Framework and 3.8 Summary of the Chapter', guide: 'Identify the weaknesses, conflicts and enforcement problems specifically.', words: 1100 },
  ],
  chapter_4: [
    { sections: '4.0 Introduction and the first group of landmark cases (cases 1 to 4)', guide: 'For each case give the facts, the issues, the arguments, the decision, the ratio decidendi and the implications. Use only real decided cases.', words: 1500 },
    { sections: 'The second group of landmark cases (cases 5 to 8)', guide: 'The same structure for each case. Use only real decided cases. Continue directly without a new chapter heading.', words: 1500 },
    { sections: 'Breach and Liability Analysis and Judicial Remedies', guide: 'Explain how breach is established, the burden and standard of proof, and the remedies available (damages, injunctions, specific performance, restitution).', words: 1300 },
    { sections: 'Alternative Dispute Resolution Mechanisms and Ethical Implications', guide: 'Assess arbitration, mediation and conciliation and the ethical dimensions of the issues.', words: 1200 },
    { sections: 'Institutional Roles and Enforcement and a Summary of the Chapter', guide: 'Analyse the roles of the courts, tribunals and regulators in enforcement, then summarise the chapter.', words: 1200 },
  ],
  chapter_5: [
    { sections: '5.1 Summary of Findings', guide: 'Summarise the findings of each chapter against the research objectives.', words: 1200 },
    { sections: '5.2 Conclusion', guide: 'Synthesise the findings, say whether the aim and objectives were achieved, and give a definitive position on each research question.', words: 1100 },
    { sections: '5.3 Recommendations', guide: 'Give specific recommendations for legislative reform, regulatory improvement, judicial practice, policy and public awareness, each tied to a gap found in the study.', words: 1300 },
  ],
};

async function askChapterModel(messages: { role: string; content: string }[], maxTokens: number): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const res = await fetchGemini(CHAT_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`AI service answered ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty answer');
  return text;
}

function cleanChapterText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*\*?/g, '')
    .replace(/^\s*[-*\u2022]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function runPool<T>(jobs: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= jobs.length) break;
        results[i] = await jobs[i]();
      }
    })
  );
  return results;
}

// Keeps the opening messages (where the topic is set) and the most recent ones
function trimHistory(history: { role: string; content: string }[]): { role: string; content: string }[] {
  const clip = (m: { role: string; content: string }) => ({ role: m.role, content: m.content.length > 9000 ? m.content.slice(0, 9000) + ' ...' : m.content });
  if (history.length <= 14) return history.map(clip);
  return [...history.slice(0, 2), ...history.slice(-12)].map(clip);
}

const ASSEMBLY_NOTICE = `

## ASSEMBLY MODE (INTERNAL, OVERRIDES THE PARTIAL-CHAPTER RULE):
You are writing ONE PART of a chapter. The parts are written at the same time and joined automatically, so the rule about refusing partial chapters does NOT apply to this task. Write ONLY the sections listed in the instruction, using the exact section numbers given. Do not write the chapter title, any other section, a conclusion for this part, or a reference list (the reference list is added automatically at the end). Do not use any markdown symbols. Write in full academic paragraphs and always write at least the number of words requested. Use the study brief so that this part agrees with every other part.`;

async function buildStudyBrief(history: { role: string; content: string }[], userMessage: string, isLaw: boolean, systemPrompt: string): Promise<string> {
  const lawLines = `1 Project title. 2 Department and degree level (LL.B long essay). 3 The specific area of law and the jurisdictions to be compared. 4 The aim and five specific objectives. 5 Five research questions, one per objective. 6 The key Nigerian statutes, constitutional sections and real landmark cases to be used. 7 The doctrinal methodology. 8 The key legal concepts and doctrines to define and analyse.`;
  const scienceLines = `1 Project title. 2 Department and degree level. 3 Study area and population (a specific, realistic Nigerian setting if none was given). 4 The independent, dependent and any moderating variables. 5 One general objective and four specific objectives. 6 Four research questions, one per specific objective. 7 Four null hypotheses, one per specific objective. 8 Two or three real, named theories (with originators) that anchor the study. 9 Research design, sample size with justification, sampling technique, instrument and its sections, reliability method and the statistical tools to be used. 10 The key concepts to define.`;
  const ask = `Read the conversation and the student's latest request, then write a STUDY BRIEF in plain text with no markdown. Every chapter of the project will follow it. If earlier chapters or details already appear in the conversation, copy those facts EXACTLY (title, objectives, research questions, hypotheses, population, location, theories, design, instrument, sample size). Only decide the details that are missing, sensibly. Include: ${isLaw ? lawLines : scienceLines} Keep it under 500 words.\n\nLatest request: ${userMessage}`;
  return cleanChapterText(await askChapterModel([
    { role: 'system', content: systemPrompt },
    ...trimHistory(history),
    { role: 'user', content: ask },
  ], 2500));
}

async function writeReferences(chapterText: string, isLaw: boolean, systemPrompt: string): Promise<string> {
  const ask = isLaw
    ? `Below is a chapter of a law long essay. Write its BIBLIOGRAPHY in NIALS or standard Nigerian legal citation style, organised as: A. Books and Textbooks, B. Journal Articles, C. Online Sources, D. Table of Cases, E. Table of Statutes. List every authority that is cited or clearly relied on in the chapter. Only list REAL, verifiable sources: real decided cases with correct law report citations and real enacted legislation. If you are not sure a source exists, leave it out. Use plain text with no markdown symbols.\n\nCHAPTER TEXT:\n${chapterText}`
    : `Below is a chapter of a research project. Write its REFERENCES list in APA 7th edition. List every source that is cited in the text, in alphabetical order, each with real author names, year, title, journal or publisher, volume, pages and DOI where known. Only list REAL, verifiable sources that can be found on Google Scholar. If you are not sure a source exists, leave it out and never invent one. Use plain text with no markdown symbols.\n\nCHAPTER TEXT:\n${chapterText}`;
  return cleanChapterText(await askChapterModel([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: ask },
  ], 5000));
}

// Writes one chapter as several long parts. Returns null when too many parts fail (the caller then uses the normal single answer).
async function writeChapterLongForm(
  chapterKey: string,
  brief: string,
  history: { role: string; content: string }[],
  userMessage: string,
  isLaw: boolean,
  systemPrompt: string,
  poolSize = 6
): Promise<string | null> {
  const plan = (isLaw ? LAW_CHAPTER_PLANS : CHAPTER_PLANS)[chapterKey];
  if (!plan) return null;
  const heading = (isLaw ? LAW_CHAPTER_HEADINGS : CHAPTER_HEADINGS)[chapterKey];
  const chapterName = heading.replace('\n', ': ');
  const system = systemPrompt + ASSEMBLY_NOTICE;
  const noData = !isLaw && chapterKey === 'chapter_4'
    ? `\nIMPORTANT: no real research data has been supplied. Do not invent research data and present it as real. Write the chapter as a complete working template: put clearly bracketed placeholders such as [n], [mean], [SD], [t-value], [p-value] wherever a figure from the student's own analysis belongs, and write the full explanatory and interpretive prose around them.`
    : '';
  const trimmed = trimHistory(history);

  const texts = await runPool(
    plan.map((part) => async () => {
      try {
        const user = `STUDY BRIEF (use these exact facts so that every part of the project agrees):\n${brief}\n\nThe student's request was: "${userMessage}"\n\nYOUR PART OF ${chapterName}.\nWrite ONLY: ${part.sections}.\n${part.guide}${noData}\nWrite at least ${part.words} words.`;
        return cleanChapterText(await askChapterModel([
          { role: 'system', content: system },
          ...trimmed,
          { role: 'user', content: user },
        ], 6000));
      } catch (e) {
        console.error(`[CHAPTER] ${chapterKey} part failed:`, String(e).slice(0, 160));
        return '';
      }
    }),
    poolSize
  );

  const good = texts.filter((t) => t.length > 200);
  if (good.length < Math.ceil(plan.length * 0.7)) return null;

  const body = `${heading}\n\n${good.join('\n\n')}`;
  let refs = '';
  try {
    refs = await writeReferences(body, isLaw, systemPrompt);
  } catch (e) {
    console.error('[CHAPTER] reference list failed:', String(e).slice(0, 160));
  }
  const refsHeading = isLaw ? 'BIBLIOGRAPHY' : 'REFERENCES';
  const words = body.split(/\s+/).filter(Boolean).length;
  console.log(`[CHAPTER] ${chapterKey}: ${good.length}/${plan.length} parts, about ${words} words`);
  return refs ? `${body}\n\n${refsHeading}\n\n${refs}` : body;
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
    const LOVABLE_API_KEY_FOR_CLASSIFY = Deno.env.get('GEMINI_API_KEY');
    
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
    let requestedChapters: string[] | undefined;
    
    if (articleSearchCheck.isSearch) {
      creditCost = 1;
      actionType = 'article_search';
    } else if (LOVABLE_API_KEY_FOR_CLASSIFY) {
      const classification = await classifyRequest(message, conversationContext, LOVABLE_API_KEY_FOR_CLASSIFY);
      creditCost = classification.cost;
      actionType = classification.actionType;
      requestedChapters = classification.chapters;
    } else {
      const fallback = determineCreditCostFallback(message);
      creditCost = fallback.cost;
      actionType = fallback.actionType;
      requestedChapters = fallback.chapters;
    }
    console.log(`[CREDIT] AI classified action: ${actionType}, Cost: ${creditCost} credits`);

    // SAFETY NET: Regex override to prevent AI misclassification of expensive operations
    // If the regex detects a chapter generation request but the AI classified it as something cheaper, force the correct type
    const regexCheck = determineCreditCostFallback(message);
    const EXPENSIVE_ACTIONS = ['chapter_1', 'chapter_2', 'chapter_3', 'chapter_4', 'chapter_5', 'references'];
    
    if (EXPENSIVE_ACTIONS.includes(regexCheck.actionType) && !EXPENSIVE_ACTIONS.includes(actionType) && actionType !== 'multi_chapter') {
      console.log(`[CREDIT] SAFETY NET: Regex detected "${regexCheck.actionType}" (cost ${regexCheck.cost}) but AI classified as "${actionType}" (cost ${creditCost}). Overriding to regex result.`);
      actionType = regexCheck.actionType;
      creditCost = regexCheck.cost;
    }

    console.log(`[CREDIT] Final action: ${actionType}, Cost: ${creditCost} credits`);

    // Fetch dynamic credit costs from app_settings (all chapter costs + defaults)
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .or('key.like.credit_cost_%,key.eq.default_daily_credits,key.eq.default_monthly_credits');

    // Build a dynamic cost map from app_settings
    const dynamicCostMap: Record<string, number> = { ...CHAPTER_COSTS };
    settingsData?.forEach((s: { key: string; value: string }) => {
      if (s.key.startsWith('credit_cost_')) {
        const actionKey = s.key.replace('credit_cost_', '');
        const v = parseInt(s.value);
        if (!isNaN(v) && v > 0) dynamicCostMap[actionKey] = v;
      }
    });

    // Override credit cost from app_settings if set (single-chapter or other action)
    if (actionType !== 'multi_chapter') {
      // Handle outline types: cost = half the chapter generation cost
      const outlineMatch = actionType.match(/^(chapter_\d)_outline$/);
      if (outlineMatch) {
        const parentChapter = outlineMatch[1];
        const parentCost = dynamicCostMap[parentChapter] || CHAPTER_COSTS[parentChapter] || 5;
        creditCost = Math.ceil(parentCost / 2);
        console.log(`[CREDIT] Outline cost for ${actionType}: ceil(${parentCost}/2) = ${creditCost}`);
      } else if (actionType === 'project_outline') {
        creditCost = dynamicCostMap['project_outline'] || 10;
        console.log(`[CREDIT] Project outline cost: ${creditCost}`);
      } else {
        const dynamicCost = dynamicCostMap[actionType];
        if (dynamicCost !== undefined) {
          creditCost = dynamicCost;
          console.log(`[CREDIT] Dynamic cost from app_settings: credit_cost_${actionType} = ${creditCost}`);
        }
      }
    }

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

    // Total available credits for this user
    const totalAvailable = isActiveSubscriber 
      ? dailyCredits + paidCredits 
      : Math.min(dailyCredits, monthlyCredits);

    // === MULTI-CHAPTER PARTIAL FULFILLMENT ===
    // If user requested multiple chapters, only generate those they can afford
    if (actionType === 'multi_chapter' && requestedChapters && requestedChapters.length >= 2) {
      // Determine which chapters the user can actually afford
      const affordableChapters: string[] = [];
      const skippedChapters: string[] = [];
      let runningCost = 0;

      for (const ch of requestedChapters) {
        const chCost = dynamicCostMap[ch] || CHAPTER_COSTS[ch] || 5;
        if (runningCost + chCost <= totalAvailable) {
          affordableChapters.push(ch);
          runningCost += chCost;
        } else {
          skippedChapters.push(ch);
        }
      }

      if (affordableChapters.length === 0) {
        const chapterListStr = requestedChapters.map(c => `Chapter ${c.replace('chapter_', '')}`).join(', ');
        const totalNeeded = requestedChapters.reduce((sum, ch) => sum + (dynamicCostMap[ch] || CHAPTER_COSTS[ch] || 5), 0);
        return new Response(
          JSON.stringify({
            error: `You don't have enough credits for ${chapterListStr}. This requires ${totalNeeded} credits but you only have ${totalAvailable}. Upgrade to Scholar for more credits!`,
            credits_required: totalNeeded,
            credits_available: totalAvailable,
            action_type: 'multi_chapter',
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Narrow down to affordable chapters
      requestedChapters = affordableChapters;
      creditCost = runningCost;

      // Update the effective action type to the chapters being generated
      if (skippedChapters.length > 0) {
        const skippedNums = skippedChapters.map(c => `Chapter ${c.replace('chapter_', '')}`).join(', ');
        const skippedCost = skippedChapters.reduce((sum, ch) => sum + (dynamicCostMap[ch] || CHAPTER_COSTS[ch] || 5), 0);
        console.log(`[MULTI_CHAPTER] Partial fulfillment: generating ${affordableChapters.join(', ')}, skipping ${skippedChapters.join(', ')}`);
        // We'll append a notice at the end of the AI response
        (req as any)._skippedChaptersNotice = `\n\n---\n⚠️ **Credit Notice:** You had enough credits to generate ${affordableChapters.map(c => `Chapter ${c.replace('chapter_', '')}`).join(' and ')}. ${skippedNums} require${skippedChapters.length === 1 ? 's' : ''} ${skippedCost} more credits — upgrade to continue.`;
      }
    } else if (actionType !== 'multi_chapter') {
      // Single chapter / other action — standard credit check
      if (totalAvailable < creditCost) {
        // Explaining a shortfall must be free — never charge a user to
        // discover a restriction. No credits are deducted for this message.
        if (totalAvailable >= 1) {
          console.log(`[CREDIT] Free shortfall explanation for ${actionType}: have ${totalAvailable}, need ${creditCost}. No credits deducted.`);

          // Report the user's current (possibly reset) balances unchanged.
          const smartDeduct = {
            success: true,
            dailyCredits,
            monthlyCredits,
            paidCredits,
          };
          if (smartDeduct.success) {
            // Build human-readable action label
            const ACTION_LABELS: Record<string, string> = {
              chapter_1: "Chapter 1 (Introduction)", chapter_2: "Chapter 2 (Literature Review)",
              chapter_3: "Chapter 3 (Methodology)", chapter_4: "Chapter 4 (Results & Discussion)",
              chapter_5: "Chapter 5 (Conclusion)", references: "References / Bibliography",
              project_outline: "Project Outline", research_proposal: "Research Proposal",
              fully_wrap_project: "Full Project Wrap", generation_suggestion: "Content Generation",
            };
            const actionLabel = ACTION_LABELS[actionType] || actionType.replace(/_/g, ' ');

            const explanationMessage = `I'd love to help you with **${actionLabel}**, but you don't have enough credits to complete this request.\n\n` +
              `📊 **Credit Details:**\n` +
              `- **Required:** ${creditCost} credits\n` +
              `- **Available:** ${totalAvailable} credits\n` +
              `- **Shortfall:** ${creditCost - totalAvailable} credits\n\n` +
              `To get this done, upgrade to the **Scholar** plan to receive more credits. Once you upgrade, come back and we'll pick up right where we left off! 🚀`;

            // Save user message
            await supabaseClient.from('messages').insert({
              session_id: session_id,
              sender: 'user',
              content: message,
            });

            // Save AI explanation
            await supabaseClient.from('messages').insert({
              session_id: session_id,
              sender: 'ai',
              content: explanationMessage,
            });

            return new Response(
              JSON.stringify({
                response: explanationMessage,
                profile: {
                  daily_credits: smartDeduct.dailyCredits,
                  monthly_credits: smartDeduct.monthlyCredits,
                  paid_credits: smartDeduct.paidCredits,
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Truly zero credits - hard 402
        let errorMessage: string;
        if (isActiveSubscriber) {
          errorMessage = `This action requires ${creditCost} credits. You have ${totalAvailable} credits remaining. Please purchase more credits.`;
        } else if (profile.plan_type !== 'free' && paidCreditsExpired) {
          errorMessage = `Your subscription has expired. This requires ${creditCost} credits but you have ${totalAvailable} available. Upgrade to continue!`;
        } else {
          errorMessage = `This requires ${creditCost} credits but you only have ${totalAvailable} available. Upgrade to Scholar for more credits!`;
        }

        console.log(`[CREDIT] Insufficient credits for ${actionType} (need ${creditCost}, have ${totalAvailable})`);
        return new Response(
          JSON.stringify({ error: errorMessage, credits_required: creditCost, credits_available: totalAvailable, action_type: actionType }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
    const LOVABLE_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Full chapters are written as several long parts at the same time, all following one study brief
    let aiMessage: string | null = null;
    const chapterKeys: string[] = actionType === 'multi_chapter'
      ? (requestedChapters ?? [])
      : (/^chapter_[1-5]$/.test(actionType) ? [actionType] : []);
    if (chapterKeys.length > 0) {
      try {
        const isLawProject = LAW_PATTERN.test([message, ...conversationHistory.slice(0, 6).map((m) => m.content)].join(' '));
        const studyBrief = await buildStudyBrief(conversationHistory, message, isLawProject, SYSTEM_PROMPT);
        const written = await Promise.all(
          chapterKeys.map((k) =>
            writeChapterLongForm(k, studyBrief, conversationHistory, message, isLawProject, SYSTEM_PROMPT, chapterKeys.length > 1 ? 4 : 6)
          )
        );
        if (written.every((w) => !!w)) {
          aiMessage = (written as string[]).join('\n\n\n');
        } else {
          console.log('[CHAPTER] long-form was incomplete, using the normal answer');
        }
      } catch (e) {
        console.error('[CHAPTER] long-form writing failed, using the normal answer:', e);
      }
    }

    if (aiMessage === null) {
      const aiResponse = await fetchGemini('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
          max_tokens: 30000,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
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
      aiMessage = aiData.choices[0].message.content;
    }

    // Append skipped-chapters notice for partial multi-chapter fulfillment
    const skippedNotice = (req as any)._skippedChaptersNotice;
    if (skippedNotice) {
      aiMessage += skippedNotice;
    }

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
      const LOVABLE_API_KEY = Deno.env.get('GEMINI_API_KEY');
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
