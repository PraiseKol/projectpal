
# Fix Credit Loopholes, Add References, and Improve Chat UI

## Problem Summary

1. **Credit loophole**: The `determineCreditCost()` function in `chat-ai` uses regex on the user's message to detect chapter requests. Users can bypass this by phrasing requests vaguely (e.g., "write the introduction for my project" instead of "Chapter 1") and get charged only 1-2 credits instead of the correct 5-25.
2. **Missing references**: Chapter generations don't consistently include academic references.
3. **References accuracy**: Generated references need to be real, verifiable sources.
4. **Back button visibility**: Users want the header (with Back button) to always be visible regardless of scroll.
5. **Scroll navigation**: Need scroll-to-top and scroll-to-bottom arrow buttons.

---

## 1. Fix Credit Loophole with AI-Based Classification

**Current approach (broken)**: Regex pattern matching on user message keywords.

**New approach**: Replace the regex `determineCreditCost()` with a lightweight AI classification call using a fast, cheap model (`gemini-2.5-flash-lite`). This classifier receives the user's message PLUS the last 3 messages of conversation context and returns a JSON classification of the request type and appropriate credit cost.

### File: `supabase/functions/chat-ai/index.ts`

- Replace the `determineCreditCost()` function with an async `classifyRequest()` function
- The classifier calls `gemini-2.5-flash-lite` with a system prompt that says: "Classify this academic assistant request. Return JSON with `actionType` and `cost`. Categories: chapter_1 (5), chapter_2 (10), chapter_3 (25), chapter_4 (50), chapter_5 (5), research_proposal (20), article_search (1), generation_suggestion (2), simple_chat (1)." It also receives the last few conversation messages for context (so "continue writing" after a chapter 1 discussion is classified correctly)
- Use `max_tokens: 50` and `temperature: 0` for fast, deterministic classification
- Fallback to the existing regex function if the classification call fails
- Call this classifier BEFORE the credit check, so the correct cost is enforced before generation

### File: `supabase/functions/document-ai-chat/index.ts`

- Apply the same AI classification approach to the `determineCreditCost()` function here
- This prevents users from using the Document Editor's AI to generate chapters at reduced cost

---

## 2. Always Include References with Chapter Generations

### File: `supabase/functions/chat-ai/index.ts`

Update the system prompt (lines 430-518) to add a new explicit rule:

```
## MANDATORY REFERENCES RULE:
When generating ANY chapter content (Chapter 1-5, Introduction, Literature Review,
Methodology, Results, Conclusion), you MUST include a "References" section at the
end of the generated content. The references must:
- Be formatted in APA 7th Edition
- Include at least 10-15 references for major chapters (Ch 1-4), 5-8 for Chapter 5
- Be REAL, verifiable academic sources that exist and can be found on Google Scholar
- Include actual author names, real journal names, real publication years, and DOIs where available
- Use sources from Semantic Scholar, Google Scholar, and well-known academic databases
- DO NOT fabricate or hallucinate references. Only cite sources you are confident exist.
- If you cannot verify a reference, use "[Author] (Year)" format with a note to verify
```

### File: `supabase/functions/document-ai-chat/index.ts`

Add the same references instruction to the generation/analysis system prompt so Document Editor chapter generations also include references.

---

## 3. Sticky Header with Back Button

### File: `src/pages/Chat.tsx`

The current layout uses a flex column where the header is at the top and messages scroll inside a nested div. The header should already be non-scrolling, but to make it bulletproof:

- Add `sticky top-0 z-30 bg-background` to the header element (line 565)
- This ensures the Back button, credits display, and theme toggle are always visible regardless of scroll position

---

## 4. Scroll-to-Top and Scroll-to-Bottom Buttons

### File: `src/pages/Chat.tsx`

Add floating arrow buttons that appear conditionally based on scroll position:

- Add a `ref` to the scrollable messages container (line 596)
- Track scroll position with `onScroll` handler to detect:
  - `showScrollUp`: true when scrolled down more than 200px from top
  - `showScrollDown`: true when not scrolled to bottom (more content below)
- Render two floating buttons positioned at the right edge of the chat area:
  - **Arrow Up** (top-right of chat area): Scrolls to the very top of messages
  - **Arrow Down** (bottom-right of chat area, above input): Scrolls to the latest message
- Buttons appear/disappear with a fade animation
- Use `ChevronUp` and `ChevronDown` icons from lucide-react

```text
+----------------------------------+
| Back  ProjectPal Chat   Credits  |  <-- always visible (sticky)
+----------------------------------+
|                            [^]   |  <-- scroll-to-top (when scrolled down)
|  ... messages ...                |
|                                  |
|                            [v]   |  <-- scroll-to-bottom (when scrolled up)
+----------------------------------+
| [input field]           [send]   |
+----------------------------------+
```

---

## Summary of All Changes

| # | Change | File |
|---|--------|------|
| 1 | AI-based request classification (replace regex) | `supabase/functions/chat-ai/index.ts` |
| 1 | Same classification fix for Document Editor | `supabase/functions/document-ai-chat/index.ts` |
| 2 | Mandatory references rule in system prompt | `supabase/functions/chat-ai/index.ts` |
| 2 | Same references rule for Document Editor | `supabase/functions/document-ai-chat/index.ts` |
| 3 | Sticky header with Back button | `src/pages/Chat.tsx` |
| 4 | Scroll-to-top and scroll-to-bottom buttons | `src/pages/Chat.tsx` |
