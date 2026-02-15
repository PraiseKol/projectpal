
# Gate Questionnaire Builder with Credit Deduction

## Overview

Currently the Questionnaire Builder lets users build, preview, and export (PDF/DOCX) entirely for free -- only the AI Assistant chat costs credits. We need to charge **5 credits per export** so users can't just design and download without any cost. The AI Assistant will also be updated to cost **5 credits** per message (instead of 2).

## Approach

Since the Builder and Preview tabs are just local editing tools, the natural credit gate is at the **export step** (PDF/DOCX download). Users can freely build and preview, but downloading the final document costs 5 credits. This mirrors how other tools work (e.g., PPT Generator charges on generation, not on editing).

## Changes

### 1. New Edge Function: `supabase/functions/questionnaire-export/index.ts`

A lightweight edge function that:
- Authenticates the user
- Checks they have at least 5 credits available
- Deducts 5 credits from their profile (daily first, then paid)
- Returns success so the frontend can proceed with the client-side export

This keeps the actual PDF/DOCX generation client-side (no need to move heavy libraries to Deno) while still gating exports behind credits.

### 2. Update `src/pages/QuestionnaireBuilder.tsx`

Modify `handleExportPdf` and `handleExportDocx` to:
- Call the new `questionnaire-export` edge function first
- Only proceed with the actual export if the edge function returns success
- Show appropriate error messages for insufficient credits (with link to pricing)
- Show a loading state while the credit check is in progress

### 3. Update `supabase/functions/questionnaire-ai/index.ts`

- Change `CREDIT_COST = 2` to `CREDIT_COST = 5`

### 4. Update `src/components/Questionnaire/QuestionnaireChat.tsx`

- Change the info text from "Each message costs 2 credits" to "Each message costs 5 credits"

### 5. Update `supabase/config.toml`

- Add `verify_jwt = false` entry for the new `questionnaire-export` function (auth validated in code)

## Technical Details

### New Edge Function Structure

```
supabase/functions/questionnaire-export/index.ts
```

The function will:
1. Handle CORS preflight
2. Validate auth token
3. Fetch user profile (plan_type, daily_credits, monthly_credits, paid_credits, daily_reset_date, credits_expiry_date)
4. Fetch dynamic credit defaults from app_settings
5. Reset daily credits if needed (same pattern as other functions)
6. Check total available credits >= 5
7. Block free users with zero monthly credits (402)
8. Deduct 5 credits (daily first, then paid)
9. Update profile
10. Return success with remaining credit info

### Frontend Export Flow

```
User clicks "PDF" or "DOCX"
  -> Validate questionnaire (existing logic)
  -> Call questionnaire-export edge function
  -> If success: proceed with client-side export
  -> If 402: show "insufficient credits" toast with upgrade link
  -> If error: show generic error toast
```

### Credit Cost Display

Add a small note in the header or export buttons area indicating "Export costs 5 credits" so users know before clicking.

## Summary

| Change | File |
|--------|------|
| New edge function for export credit gate | `supabase/functions/questionnaire-export/index.ts` |
| Gate exports behind credit check | `src/pages/QuestionnaireBuilder.tsx` |
| AI Assistant cost: 2 -> 5 credits | `supabase/functions/questionnaire-ai/index.ts` |
| Update AI cost display text | `src/components/Questionnaire/QuestionnaireChat.tsx` |
| Register new function | `supabase/config.toml` |
