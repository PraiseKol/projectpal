

# Fix Chapter Formatting + Build Humanizer Feature

## Part 1: Fix Markdown Symbols in Generated Chapters

**Problem**: When users generate chapters, the AI output contains raw markdown symbols like `###`, `**`, `***` which appear as literal text instead of formatted content. This happens because the system prompt instructs the AI to use markdown headings, but when users copy or view the content, they see the raw symbols.

**Solution**: Add an explicit instruction to the system prompt in both `chat-ai` and `document-ai-chat` telling the AI to NOT use markdown heading symbols (`#`, `##`, `###`) or bold/italic markers (`**`, `***`) in chapter content. Instead, use plain numbered headings (e.g., "1.1 Background to the Study") and write naturally without markdown formatting marks.

### Files to Update

**1. `supabase/functions/chat-ai/index.ts`** -- Add to the FORMATTING RULES section:
```
- CRITICAL: Do NOT use markdown symbols in chapter content. 
  Do NOT use # ## ### for headings. Do NOT use ** or *** for bold/italic.
  Instead, use plain numbered section headings (e.g., "1.1 Background to the Study")
  and write in natural flowing prose. The content should read cleanly 
  without any special formatting characters.
```

**2. `supabase/functions/document-ai-chat/index.ts`** -- Add the same formatting instruction to its system prompt.

---

## Part 2: Build Humanizer Feature

### Overview
A new "Humanizer" card on the Dashboard that opens a dedicated page (`/humanizer`). Users paste text, click "Humanize", and the AI rewrites it to sound more natural and human-written while preserving the original meaning. Costs 5 credits per use.

### New Files

**1. `supabase/functions/humanize-text/index.ts`** -- New edge function
- Authenticates user, checks credits (fetches `credit_cost_humanizer` from `app_settings`, default 5)
- Sends text to Lovable AI with a specialized prompt that:
  - Varies sentence length and structure
  - Adds natural transitions and conversational connectors
  - Replaces overly formal/robotic phrasing with academic but human-sounding alternatives
  - Introduces minor stylistic variations (sentence starters, paragraph flow)
  - Preserves the original meaning, facts, and academic rigor
- Deducts credits after success
- Returns humanized text

**2. `src/pages/Humanizer.tsx`** -- New page
- Header with back button, title "AI Humanizer", credit cost badge (5 credits)
- Large textarea for pasting input text (with word count display)
- "Humanize" button
- Output section showing the humanized result
- Copy button and word count for the output
- Loading state with spinner

### Existing Files to Update

**3. `src/pages/Dashboard.tsx`**
- Add a new card in the Quick Actions grid:
  - Icon: `Sparkles` or a pen icon
  - Title: "AI Humanizer"
  - Description: "Make AI-generated text sound more natural and human-written"
  - Badge: "5 Credits"
  - Available to all users (free included, costs credits)
  - Navigates to `/humanizer`

**4. `src/App.tsx`**
- Import the new `Humanizer` page
- Add route: `/humanizer` (protected, with FeatureGate)

**5. `supabase/config.toml`**
- Add `[functions.humanize-text]` with `verify_jwt = false`

**6. `src/components/Admin/CreditCostsSettings.tsx`**
- Add `{ key: "credit_cost_humanizer", label: "AI Humanizer", defaultCost: 5, category: "Tools" }` to the operations list

### Edge Function Logic (humanize-text)

The system prompt will instruct the AI to:
- Vary sentence lengths (mix short and long sentences)
- Use natural transitions ("However," "That said," "Interestingly,")
- Avoid repetitive sentence starters
- Replace overly structured/formulaic phrasing
- Add subtle hedging language ("tends to," "appears to," "it seems")
- Maintain the same factual content and academic quality
- Keep the same approximate word count
- NOT change citations, references, or technical terms

### Summary

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/chat-ai/index.ts` | Add no-markdown formatting rule |
| 2 | `supabase/functions/document-ai-chat/index.ts` | Same no-markdown rule |
| 3 | `supabase/functions/humanize-text/index.ts` | New edge function |
| 4 | `src/pages/Humanizer.tsx` | New page |
| 5 | `src/pages/Dashboard.tsx` | Add Humanizer card |
| 6 | `src/App.tsx` | Add route |
| 7 | `supabase/config.toml` | Register function |
| 8 | `src/components/Admin/CreditCostsSettings.tsx` | Add humanizer cost entry |

