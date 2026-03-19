

# Plan: Slide Count Selector + Fix Text Overlap in PPT Generator

## 1. Frontend — Slide Count Selector (`src/pages/Documents.tsx`)

Add a new section between the upload success and the theme selector. Four radio-style card options using existing UI components:

- **7–9 slides** | **10–12 slides** | **13–15 slides** | **16–21 slides**
- Default: `"10-12"`
- New state: `slideCountRange`
- Pass `slide_count_range` in the `generate-ppt` request body
- Styled as clickable cards in a 2x2 or 4-column grid, matching the existing theme selector aesthetic

## 2. Edge Function — Enforce Slide Count (`supabase/functions/generate-ppt/index.ts`)

**a) Accept new parameter** (line 1466): extract `slide_count_range` from request body, parse to min/max numbers.

**b) Update AI system prompt** (line 1724-1725): replace the fixed "Create 12-25 slides" guideline with:
```
You MUST generate between {min} and {max} slides total (including title, conclusion, references, thankyou).
If content exceeds {max} slides, merge related points and prioritize key findings.
If content is sparse, expand important sections across multiple slides.
```

**c) Post-AI enforcement** (line 1777): after parsing slides, trim array to max if over, keeping title/conclusion/references/thankyou and trimming content slides from the middle.

## 3. Fix Text Overlap in Slide Rendering (`supabase/functions/generate-ppt/index.ts`)

**a) `buildContentSlide` (line 1075-1093) — Bullet overlap fix:**
- Increase bullet text box height from `0.6` to `0.8`
- Increase `lineHeight` from `0.65-0.7` to `0.85`
- Cap bullets at 4 per slide (currently 5)
- Add `shrinkText: true` and `valign: 'top'` to prevent overflow
- Truncate individual bullets longer than 120 characters with "..."

**b) `toBullets` function (line 85-97):**
- Add max character limit per bullet (cap at 120 chars)

**c) `buildConclusionSlide` (line 1311-1320):**
- Increase spacing from `0.7` to `0.85` per bullet
- Cap at 4 bullets

**d) `buildReferencesSlide` (line 1371-1380):**
- Reduce max refs from 10 to 8 per slide
- Increase spacing from `0.55` to `0.6`

**e) AI prompt bullet length rule** (line 1726): add instruction:
```
Each bullet point must be one concise sentence, maximum 18 words. Never write multi-sentence bullets.
```

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Documents.tsx` | Add slide count selector UI, pass to API |
| `supabase/functions/generate-ppt/index.ts` | Accept slide count, update prompt, fix overlap in all slide builders |

