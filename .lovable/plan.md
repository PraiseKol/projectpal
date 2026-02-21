

# Three Fixes: Credit Costs Display, Humanizer Limit, and Humanizer Optimization

---

## 1. Fix Credit Costs Not Displaying Live Values

**Root Cause:** The code at line 622 uses `creditCosts[op.key] ?? op.defaultCost`. The `??` operator only catches `null`/`undefined` but NOT `NaN`. If `parseInt()` returns `NaN` for any reason, `NaN ?? 5` still shows `NaN` on screen. Additionally, only 1 out of 21 keys (`credit_cost_humanizer`) currently exists in the database -- all others correctly fall back to defaults. The real fix is replacing `??` with `||` so that `NaN` and `0` also trigger the fallback.

**Fix:**
- Line 132: Add `NaN` guard: `const val = parseInt(s.value, 10); if (!isNaN(val)) map[s.key] = val;`
- Line 622: Change `creditCosts[op.key] ?? op.defaultCost` to `creditCosts[op.key] || op.defaultCost`

**File:** `src/pages/Chat.tsx` (2-line change)

---

## 2. Reduce Humanizer Input Limit for Better Accuracy

**Current limit:** 40,000 characters (~7,000 words)

**New limit:** 15,000 characters (~2,500 words)

**Why this helps:**
- Shorter inputs give the AI model more focused context, producing higher-quality rewrites
- Eliminates the need for chunking (which splits paragraphs and loses cross-section coherence)
- Faster processing = fewer timeouts = more reliable results
- Academic chapters are typically 2,000-3,000 words per section -- users should paste one section at a time for best results
- The UI already tells users "Try pasting one section at a time" on timeout, so this aligns with that guidance

**File:** `supabase/functions/humanize-text/index.ts` (update limit from 40,000 to 15,000 and error message)

---

## 3. Rebuild Humanizer for Better Results with Less AI Credits

**Current approach (expensive):**
- Pass 1: `gemini-2.5-pro` (deep rewrite) -- expensive, slow
- Pass 2: `gemini-2.5-flash` (audit) -- cheaper but still a second call
- Total: 2 AI calls per humanization

**New approach (single-pass, optimized):**

Switch to a **single-pass architecture** using `google/gemini-2.5-flash` with a significantly improved, merged prompt that combines the best of both passes into one instruction set. This works because:

1. The reduced input limit (15,000 chars) means the model gets focused, manageable context
2. `gemini-2.5-flash` is highly capable for text transformation tasks -- the quality gap vs Pro for this specific task (paraphrasing, not reasoning) is minimal
3. A single well-crafted prompt eliminates the coordination overhead between two passes

**The new single prompt will:**
- Merge the Pass 1 deep-rewrite rules (non-native register, list merging, grammatical restructuring, banned vocab) with Pass 2 audit rules (check for remaining patterns, fix rhythm) into ONE comprehensive instruction
- Add a self-audit step at the end of the prompt: "Before returning, scan your output for any remaining numbered lists, banned words, or 3+ consecutive similar-length sentences and fix them"
- Keep ALL the Stealth Checker-specific techniques that achieved the 97% result:
  - Non-native academic register with intentional "roundabout" phrasing
  - List-to-prose conversion
  - Numbers/percentages written as words
  - Unpredictable vocabulary mixing
  - Sentence length variance
  - Banned AI-vocabulary list

**Cost savings:** From 2 calls (1 Pro + 1 Flash) down to 1 call (Flash only) = approximately **70-75% reduction** in AI credit usage per humanization.

**Files changed:**
- `supabase/functions/humanize-text/index.ts` -- replace two-pass logic with single-pass, update prompt, update character limit, remove chunking logic

---

## Technical Summary

| Change | File | Impact |
|---|---|---|
| Fix NaN display in credit costs | `src/pages/Chat.tsx` | 2-line fix |
| Reduce char limit to 15,000 | `supabase/functions/humanize-text/index.ts` | Better accuracy, no chunking needed |
| Single-pass Flash architecture | `supabase/functions/humanize-text/index.ts` | ~75% less AI credit usage |

No database changes needed. Edge function will be redeployed automatically.

