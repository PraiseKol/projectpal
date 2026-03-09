

# Plan: Improve Credit Error Messages, Increase Chapter Length, Fix Department/Naming Issues

## 1. Improve 402 Error Toast Messages (Frontend)

**File: `src/pages/Chat.tsx` (lines 438-456)**

The backend already returns `credits_required`, `credits_available`, and `error` in the 402 response. Update the frontend error handler to show a more specific, actionable toast:

- Replace the generic message with: **"This operation requires {X} credits, but you only have {Y}. Subscribe to a plan with more credits to unlock this feature!"**
- Include the operation name when possible (map `actionType` from error body to a human-readable label like "Chapter 3 (Methodology)")
- Add the `action_type` field to the 402 error responses in the edge function so the frontend can display it

**File: `supabase/functions/chat-ai/index.ts` (lines 497-538)**

- Add `action_type` to all 402 JSON responses so the frontend can show "Chapter 3 requires 25 credits" instead of just "This action requires 25 credits"
- Update error messages to be clearer: "Generating **{action label}** requires **{cost}** credits, but you only have **{available}**. Subscribe to unlock this!"

## 2. Increase Chapter Content Length

**File: `supabase/functions/chat-ai/index.ts` (lines 677-941, system prompt)**

Add explicit page-length guidance to the system prompt after the `## CONTENT QUALITY` section:

```
## CHAPTER LENGTH REQUIREMENTS:
- Chapter 1 (Introduction): Minimum 8-10 pages of content
- Chapter 2 (Literature Review): Minimum 12-15 pages of content  
- Chapter 3 (Methodology): Minimum 8-10 pages of content
- Chapter 4 (Results & Discussion): Minimum 12-15 pages of content
- Chapter 5 (Conclusion): Minimum 5-7 pages of content
- Each "page" is approximately 300 words of academic prose
- Be thorough and detailed in every section. Students need substantive, comprehensive content.
- Do NOT be brief or scan when generating chapters. Fill out every subsection with real academic depth.
```

Also add `max_tokens: 16000` to the AI call (line 677) to allow longer outputs.

## 3. Remove "Long Essay" Label Restriction for Law

**File: `supabase/functions/chat-ai/index.ts` (line 774)**

Change: `Law projects are called "Long Essays" (NOT "project" or "thesis")`  
To: `Law projects may be called "Long Essays", "Projects", or "Dissertations" depending on the institution.`

Remove the forced "Long Essay" terminology throughout. The AI should use whatever term the student uses.

## 4. Make Department Structure Generic (Not Just Social Science / Law)

**File: `supabase/functions/chat-ai/index.ts` (lines 691-707)**

- Change `## DEFAULT DOCUMENT STRUCTURE (Science / Social Science / Other Departments)` to `## DEFAULT DOCUMENT STRUCTURE (All Departments)`
- Update the department detection intro to clarify: "The DEFAULT structure works for ALL departments (Computer Science, Engineering, Business, Education, Social Sciences, Natural Sciences, etc.). Only Law uses a different structure."
- Remove any implication that the tool is limited to Social Science or Law

## Summary of Files to Modify

| File | Changes |
|---|---|
| `supabase/functions/chat-ai/index.ts` | Add `action_type` to 402 responses, add chapter length requirements to system prompt, increase `max_tokens`, fix Law/department naming |
| `src/pages/Chat.tsx` | Improve 402 error toast to show specific credit cost and operation name |

