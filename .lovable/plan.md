
# Four Issues — Analysis & Fix Plan

## Issue 1: AI Humanizer Feature Flag Not Wired to Route

### Root Cause
In `src/App.tsx` line 82, the `/humanizer` route is:
```
<Route path="/humanizer" element={<ProtectedRoute><Humanizer /></ProtectedRoute>} />
```
Every other feature uses `<FeatureGate feature="...">` but the humanizer is missing it. The admin toggle in `AppSettings.tsx` correctly saves `feature_humanizer_enabled` to the database, but nothing reads it on the route level — so the toggle has zero effect.

### Fix
Wrap the Humanizer route in `FeatureGate` in `src/App.tsx`:
```tsx
<Route path="/humanizer" element={
  <ProtectedRoute>
    <FeatureGate feature="humanizer">
      <Humanizer />
    </FeatureGate>
  </ProtectedRoute>
} />
```
**File changed:** `src/App.tsx` (1-line change)

---

## Issue 2: Edge Function Error on Chapter 2 (Timeout)

### Root Cause
Chapter 2 (Literature Review) is significantly longer than Chapter 1. The current humanizer runs two sequential calls to `google/gemini-2.5-pro` — the slowest, most expensive model. For a typical Chapter 2 (~3,000–5,000 words), two sequential Pro calls can take 120–180+ seconds, exceeding Supabase's edge function execution limit (~150s). The user sees a generic "failed" or "unable to deploy" toast error because the connection drops mid-execution.

Additionally, the current 50,000-character limit allows very large inputs that guarantee timeouts on long chapters.

### Fix (in `supabase/functions/humanize-text/index.ts`)
1. **Switch PASS2 to `google/gemini-2.5-flash`** — The audit/fix pass does not need the most powerful model. Using Flash for Pass 2 cuts the second call's time by ~60-70%.
2. **Add a per-chunk approach for very long texts** — If the input exceeds ~8,000 words (~48,000 chars), split it into two halves, process each half through Pass 1, then run a single Pass 2 across the combined result on Flash. This prevents any single AI call from timing out.
3. **Reduce maximum character limit from 50,000 to 40,000** as a safety buffer.
4. **Add a timeout wrapper** around each AI call (90-second abort signal) so that if a call is taking too long, the function returns a meaningful error ("Text is too long for a single request — try pasting one section at a time") instead of a generic function crash.

---

## Issue 3: Reduce AI Usage Per Call Without Sacrificing Quality

### Root Cause
Both Pass 1 and Pass 2 currently use `google/gemini-2.5-pro`. This is expensive and slow. The quality difference between Pro and Flash for the PASS2 audit task (which is just pattern-checking and small fixes) is negligible.

### Fix (in `supabase/functions/humanize-text/index.ts`)
- **PASS1:** Keep `google/gemini-2.5-pro` — this is where the deep rewriting happens and quality matters most.
- **PASS2:** Switch to `google/gemini-2.5-flash` — the audit pass only checks for remaining list formatting, banned words, number symbols, and rhythm issues. Flash handles this excellently at a fraction of the cost and time.

This change alone reduces AI usage per humanization call by approximately 50-60%.

---

## Issue 4: Chapter Credit Enforcement in Chat

### Root Cause
The current `chat-ai` edge function classifies ONE action per message and charges for it. But:
- If a user asks "write chapters 1, 2, and 3," the AI classifies it as `chapter_1` (or sometimes just the first detected chapter) and generates all three.
- If a user asks for "chapter 2," the AI assistant's prompt may include chapter 1 content because the system prompt tells it to write full projects — meaning the AI sometimes generates extra chapters the user didn't ask for.

The classification system only handles single-chapter requests; it has no multi-chapter detection or credit-gating logic.

### Fix (in `supabase/functions/chat-ai/index.ts`)

**Part A: Multi-chapter detection in classifier**

Add a new action type `multi_chapter` that fires when the message contains requests for 2+ chapters in one message. The classifier already returns `actionType` and `cost`; extend it to also return a `chapters` array.

Update `classifyRequest()` to detect multi-chapter requests and return the individual chapters ordered, e.g.:
```json
{"actionType": "multi_chapter", "chapters": ["chapter_1", "chapter_2", "chapter_3"], "cost": 40}
```

Also update `determineCreditCostFallback()` to detect patterns like "chapters 1-3", "chapters 1 to 3", "chapter 1 and 2" and return the multi-chapter type.

**Part B: Partial credit enforcement**

After classification, if `multi_chapter` is detected:
1. Calculate the total cost of all requested chapters.
2. Compare against user's available credits.
3. If user can afford ALL chapters → generate all, charge full cost.
4. If user can afford SOME chapters (e.g., can afford Ch1 + Ch2 but not Ch3) → generate only those chapters, charge only for those, and add a message: "You had enough credits for Chapter 1 and Chapter 2. Chapter 3 requires 25 more credits — upgrade to continue."
5. If user cannot afford ANY chapter → return the normal insufficient credits error.

**Part C: Prevent extra chapter generation**

Update the system prompt to include a strict instruction:
```
CRITICAL CHAPTER RULE: Generate ONLY the specific chapter(s) the user explicitly requests. 
If the user asks for "Chapter 2", generate ONLY Chapter 2. 
Do NOT generate Chapter 1 as an introduction to Chapter 2. 
Do NOT generate any chapter the user did not explicitly request.
```

This is a system prompt change within the existing edge function — no new files needed.

**Files changed:**
- `supabase/functions/chat-ai/index.ts` — multi-chapter detection, partial credit enforcement, system prompt update
- `supabase/functions/humanize-text/index.ts` — PASS2 model switch, timeout handling, character limit adjustment
- `src/App.tsx` — FeatureGate wrapper for humanizer route

---

## Technical Summary

| Issue | Root Cause | File(s) Changed | Complexity |
|---|---|---|---|
| 1. Feature flag | Missing FeatureGate in App.tsx route | `src/App.tsx` | Trivial (1 line) |
| 2. Timeout on Ch.2 | Two sequential Pro calls exceed ~150s time limit | `supabase/functions/humanize-text/index.ts` | Medium |
| 3. AI usage | Both passes use gemini-2.5-pro unnecessarily | `supabase/functions/humanize-text/index.ts` | Simple |
| 4. Chat credit enforcement | No multi-chapter detection or partial generation | `supabase/functions/chat-ai/index.ts` | Medium |

All changes are backend-only or single-line frontend changes. No new pages, no new edge functions, no database migrations needed.
