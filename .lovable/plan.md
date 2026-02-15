
# Credit System Rework and Free User Monthly Credit Bug Fix

## Overview of Changes

### Current vs New Credit Costs

| Action | Current Cost | New Cost |
|--------|-------------|----------|
| Simple chat response | 1 | 1 |
| AI generation/suggestions (topics, etc.) | 2-6 | 2 |
| Generate Chapter 1 | 6 (full chapter) | 5 |
| Generate Chapter 2 | 6 (full chapter) | 10 |
| Generate Chapter 3 | 6 (full chapter) | 25 |
| Generate Chapter 4 | 6 (full chapter) | 50 |
| Generate Chapter 5 | 6 (full chapter) | 5 (same as Ch1, conclusion) |
| Paraphrasing | 1 | 2 |
| PowerPoint (no images) | 15 | 10 |
| PowerPoint (with images) | 20 | 15 |
| Data Analysis | unchanged | unchanged |
| Article Search | 1 | 1 (unchanged) |

### Bug Fix: Free User Monthly Credit Exhaustion

**Problem**: When a free user's monthly credits hit 0, the backend chat-ai function has a syntax bug (missing closing brace on the error message block at line 266). The article search code block falls through before the 402 return, causing a 500 error which translates to "Something went wrong on our side." Additionally, the frontend credit check uses `||` logic (`daily > 0 OR monthly > 0`), which incorrectly allows requests when daily > 0 but monthly = 0.

**Fix**:
- Fix the missing closing brace in chat-ai so the 402 error response is properly returned
- Update the frontend credit check in Chat.tsx so free users are blocked when monthly credits = 0 (regardless of daily credits)
- Ensure the 402 response is caught and redirects to pricing page with the correct message

---

## Files to Modify

### 1. `supabase/functions/chat-ai/index.ts`

**`determineCreditCost` function** (lines 78-117): Rewrite the detection logic:
- Chapter 1 / Introduction: 5 credits
- Chapter 2 / Literature Review: 10 credits
- Chapter 3 / Methodology: 25 credits
- Chapter 4 / Results / Data Analysis chapter: 50 credits
- Chapter 5 / Conclusion / Recommendations: 5 credits
- Topic generation, suggestions, proposal outlines, section requests: 2 credits
- Continue/expand: 2 credits
- Default simple chat: 1 credit

**Bug fix** (lines 258-266): Add the missing closing brace `}` after the error message assignment on line 265, and move the article search block + the `return` 402 response into the correct position so the insufficient credits error is properly returned.

### 2. `supabase/functions/paraphrase-ai/index.ts`

**Credit cost** (line ~125-145): Change credit deduction from 1 to 2 per paraphrase.

### 3. `supabase/functions/generate-ppt/index.ts`

**Credit constants** (lines 11-12): Change `BASE_CREDIT_COST` from 15 to 10, and `IMAGE_CREDIT_COST` from 5 to 5 (stays the same, total with images = 15).

### 4. `src/pages/Chat.tsx`

**Frontend credit check** (lines 318-327): Fix the logic so free users are blocked when `monthly_credits <= 0`, regardless of daily credits. The check should be:
- Free users: `monthly_credits > 0` (daily is derived from monthly)
- Paid users: `daily_credits > 0 || paid_credits > 0`

Also ensure a proper redirect to `/pricing` with a clear toast message.

### 5. `src/pages/Paraphraser.tsx`

No changes needed -- it calls the `paraphrase-ai` edge function which handles credit deduction. The credit cost change is backend-only.

---

## Technical Details

### Chapter Detection Logic (chat-ai)

```text
Chapter 4 patterns (50 credits):
  - "chapter 4", "chapter four", "results", "data presentation", "data analysis chapter"
  - NOT triggered by the standalone data analysis page

Chapter 3 patterns (25 credits):
  - "chapter 3", "chapter three", "methodology", "research methodology"

Chapter 2 patterns (10 credits):
  - "chapter 2", "chapter two", "literature review", "review of literature"

Chapter 1 patterns (5 credits):
  - "chapter 1", "chapter one", "introduction chapter"

Chapter 5 patterns (5 credits):
  - "chapter 5", "chapter five", "conclusion", "recommendations"

Generation/Suggestions (2 credits):
  - Topic generation, proposal outline, section requests,
    continue/expand, suggestions

Simple chat (1 credit):
  - Everything else
```

### Bug Fix Detail (chat-ai lines 258-266)

The current code:
```javascript
} else {
    errorMessage = `This action requires...`;
}                          // <-- missing closing brace for if block

// Handle article search requests   // <-- this runs BEFORE the return!
if (articleSearchCheck.isSearch) {
```

Fixed to:
```javascript
} else {
    errorMessage = `This action requires...`;
}

    console.log(`[CREDIT] Insufficient credits...`);
    return new Response(
      JSON.stringify({ error: errorMessage, ... }),
      { status: 402, ... }
    );
}                          // <-- properly closes the if(totalAvailable < creditCost) block

// Handle article search requests
if (articleSearchCheck.isSearch) {
```

### Frontend Credit Check Fix (Chat.tsx)

```text
Current (buggy):
  hasCredits = daily > 0 || (free && monthly > 0) || (paid && paid_credits > 0)
  -- This passes when daily=8, monthly=0 for free users

Fixed:
  if free user: hasCredits = monthly > 0
  if paid user: hasCredits = daily > 0 || paid_credits > 0
```
