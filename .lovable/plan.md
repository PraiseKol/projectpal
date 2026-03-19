

# Plan: Fix Title Slide Overlap + Thank You Slide Color Issues

## Problem Analysis

**Issue 1 — Title slide text overlap:** The title "Development of a Smart Predictive Machine Learning Model for Detecting Skin Diseases (Acne, Melanoma, Mycosis)" is long and wraps, but the author/subtitle is placed at a fixed offset (`titleY + 1.3`), causing overlap. Additionally, the AI sometimes misreads author names from documents (e.g., "Kolawole Praise" → "Kol Awole Pr Aise K Ayode").

**Issue 2 — Purple text on Thank You slide:** The "Warm Gradient" theme uses `accent: "7C3AED"` (purple), which is used for "Questions & Discussion" and institution text on the thank you slide. Purple clashes badly with the brown/amber theme. This affects multiple themes where accent colors don't complement the primary background.

## Changes — `supabase/functions/generate-ppt/index.ts`

### 1. Fix title slide spacing (buildTitleSlide, ~line 906-937)

- Increase title text box height from `1.2` to `1.8` to give long titles room
- Push subtitle (author) down from `titleY + 1.3` to `titleY + 2.0`
- Push institution down from `titleY + 2.0` to `titleY + 2.6`
- This prevents overlap even with 4-5 line titles

### 2. Fix accent colors on Thank You slide (buildThankYouSlide, ~line 1442-1465)

- Replace `theme.accent` with `theme.secondary` for "Questions & Discussion" text (line 1445) — `secondary` is always designed to complement `primary`
- Replace `theme.accent` with `theme.secondary` for institution text (line 1462) — same reason
- This ensures all text on the thank you slide uses colors from the same palette family

### 3. Fix clashing accent colors in theme definitions (~line 314-334)

- Change "Warm Gradient" accent from `"7C3AED"` (purple) to `"D97706"` (amber) — matches the warm palette
- Audit other themes and fix any where accent clashes with primary

### 4. Improve author name extraction in AI prompt (~line 1726)

- Add explicit instruction: "Extract the author's full name EXACTLY as written in the document. Do not split or rearrange name parts. Look for the name on the title page or cover page."

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/generate-ppt/index.ts` | Fix title slide spacing, thank you slide colors, accent color definitions, author extraction prompt |

