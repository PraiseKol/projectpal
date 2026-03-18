

# Plan: Enforce Comprehensive, Non-Summarized Output Across All AI Edge Functions

## Problem
The AI tends to produce short/summarized outputs because:
1. **`chat-ai`**: System prompt says "Be concise and direct" and "brief for simple ones" — this bleeds into chapter generation
2. **`document-ai-chat`**: No `max_tokens` set (defaults to model's low default), no chapter length requirements in the prompt
3. **`questionnaire-ai`**: May produce minimal questionnaires
4. **`rewrite-section`**: "expand" mode doesn't enforce substantive output

## Changes

### 1. `supabase/functions/chat-ai/index.ts` — Strengthen response style (lines 769-775)

Replace the "concise and direct" response style with clearer differentiation:

```
## RESPONSE STYLE:
- For simple questions (definitions, explanations, "what is X?"): Give focused answers (2-5 paragraphs).
- For document generation (chapters, outlines, references, bibliographies): Generate FULL, COMPREHENSIVE, SUBSTANTIVE content. Never summarize or abbreviate. Every subsection must be fleshed out with real academic depth, examples, citations, and thorough discussion.
- Avoid unnecessary introductions like "Certainly!" or "Of course!". Get straight to the content.
- When generating academic content, ALWAYS err on the side of MORE content, not less. Students need complete, submission-ready material.
- Do NOT truncate, summarize, or shorten generated chapters/sections under any circumstances.
```

### 2. `supabase/functions/document-ai-chat/index.ts` — Add max_tokens + length requirements

**Line 400-408** — Add `max_tokens: 16000` to the request body.

**Lines 314-397** — Add chapter length requirements to the generation system prompt (after the FORMATTING RULES section):

```
## CHAPTER LENGTH REQUIREMENTS:
- Chapter 1 (Introduction): Minimum 8-10 pages (~2400-3000 words)
- Chapter 2 (Literature Review): Minimum 12-15 pages (~3600-4500 words)
- Chapter 3 (Methodology): Minimum 8-10 pages (~2400-3000 words)
- Chapter 4 (Results & Discussion): Minimum 12-15 pages (~3600-4500 words)
- Chapter 5 (Conclusion): Minimum 5-7 pages (~1500-2100 words)
- Each "page" is approximately 300 words.
- NEVER produce abbreviated or summarized chapters. Every subsection must have thorough academic content.
- For analysis tasks (summaries, key points): Be comprehensive — capture ALL key points, not just a few.
- For content expansion: At least double the original content length with meaningful additions.
```

Also strengthen the GUIDELINES section (line 331) to replace "Be thorough and comprehensive" with stronger language about never summarizing.

### 3. `supabase/functions/rewrite-section/index.ts` — Strengthen expand prompt

Update the `expand` prompt (line ~121) to be more aggressive about producing substantial content:

```
expand: `Expand the following text significantly with much more detail, explanation, and depth. At minimum, TRIPLE the length of the original text. Add relevant examples, scholarly discussion, supporting evidence, elaboration on each point, and additional context. Do not just add a sentence or two — produce a substantially longer, richer version.`
```

### 4. `supabase/functions/questionnaire-ai/index.ts` — Check and strengthen build prompt

Add instructions to the build mode prompt to generate comprehensive questionnaires with sufficient questions per section (minimum 8-10 questions per section, detailed instructions, proper Likert scales, etc.).

## Summary

| File | Change |
|---|---|
| `chat-ai/index.ts` | Replace "concise" response style with generation-first language |
| `document-ai-chat/index.ts` | Add `max_tokens: 16000`, add chapter length requirements |
| `rewrite-section/index.ts` | Strengthen "expand" prompt to triple content |
| `questionnaire-ai/index.ts` | Strengthen build mode for comprehensive output |

