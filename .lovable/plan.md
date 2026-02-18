
# Retrain Humanizer Prompts: Forensic Analysis & Fix

## Root Cause: The "Perfect Academic English" Problem

After a detailed side-by-side comparison, the exact reason ProjectPal scores 41% human while Stealth Checker scores 97% is now clear. It is not about vocabulary choices alone — it is about a combination of five specific patterns that AI detectors use as fingerprints:

---

## Forensic Comparison Table

| Pattern | ProjectPal (41% human) | Stealth Checker (97% human) |
|---|---|---|
| Sentence construction | Perfectly formed Subject→Verb→Object | Slightly roundabout, wordy constructions |
| Grammar | Flawless native English | Competent non-native academic register |
| List/bullet handling | Each item on its own clean line | Items merged into running paragraph prose |
| Number formatting | "30%" | "30 percent" (written out) |
| Verb choices | High-register but common AI picks | Unexpected mixes ("research on the concept of", "attenuate") |
| Sentence openers | Varied but structurally clean | Simpler openers mixed in ("With laws in place", "There are those who") |
| Definition section | Each definition separate and neat | All definitions run together as a block |
| Hypothesis section | Clean numbered list | All hypotheses in one flowing paragraph |

---

## The 5 Specific Techniques to Copy

### Technique 1: Non-Native Academic Phrasing
Stealth Checker uses slightly roundabout constructions that a competent non-native academic writer would produce. These are not grammatical errors — they are just less "clean" than what a native AI would write:

- "processes undergoing to make women acquired PTSD" (instead of "mechanisms that cause PTSD")
- "research on the concept of Resilience" (instead of "investigate Resilience")
- "It is imperative to understand the mechanism of resilience in married women" (instead of "Understanding resilience among married women is essential")
- "make evidence available to psychologists" (instead of "provide psychologists with evidence")

### Technique 2: Merge Bullet Lists Into Flowing Paragraphs
This is the single biggest difference. When the original text has a numbered or bulleted list (Research Questions, Hypotheses, Significance items), Stealth Checker runs them together as a paragraph instead of keeping them as separate items. AI detectors flag clean, evenly-spaced numbered lists as AI-generated. A human writer often writes these as prose.

ProjectPal output:
```
1. Examine the connection between domestic violence and the symptoms of PTSD among married women.
2. Determine the connection between resilience and the symptoms of PTSD.
3. Investigate whether resilience has a moderating effect...
```

Stealth Checker output:
```
Test the relationship between domestic violence and the PTSD symptoms in married women. Identify the relationship between resilience and the PTSD symptoms. Examine the moderating effect of resilience on the effect of domestic violence on PTSD.
```

### Technique 3: Write Numbers as Words
"30%" becomes "30 percent" — a small but significant signal. AI tends to use symbols; humans writing academically often write numbers out.

### Technique 4: Unexpected Word Register Mixing
Instead of consistently high-register synonyms, Stealth Checker mixes in unexpectedly technical or unexpectedly simple words:
- "attenuate" (very technical) used casually: "mediate (i.e. attenuate)"
- "global epidemic among community health" — slightly unusual phrasing
- "psychological disfigurement" — unexpected word for "impairment"
- "low-resilience counterparts" — simple but slightly unusual construction

### Technique 5: Vary Punctuation and Run-On Patterns Across Sections
In the definitions section, Stealth Checker runs the definitions together in a block paragraph without clean line breaks, which breaks the formulaic "one definition per line" AI pattern.

---

## Implementation Plan

### File: `supabase/functions/humanize-text/index.ts`

Replace both `PASS1_PROMPT` and `PASS2_PROMPT` entirely.

**New PASS1_PROMPT will instruct the model to:**

1. Write as a competent non-native academic — slightly roundabout constructions, wordy but not wrong
2. When the original has bullet points or numbered lists (research questions, objectives, hypotheses, significance items, definitions), merge related items into running paragraph sentences instead of keeping them as separate numbered/bulleted lines
3. Write all percentages and numbers as words ("30 percent" not "30%")
4. Mix unexpected word choices — occasionally use a very technical term where a simpler one would do, or a simpler phrasing where the original used a polished one
5. Use roundabout verb phrases: "research on the concept of" instead of "investigate", "make available to" instead of "provide", "come up with" instead of "develop"
6. Keep the banned words list
7. Keep citation preservation rules
8. Keep formal/academic register — no contractions, no casual language

**New PASS2_PROMPT will check for:**

1. Any bullet points or numbered lists still present — convert to flowing prose
2. Any percentages still written as symbols — convert to words
3. Any sentences that are too clean and perfectly structured — introduce slight roundaboutness
4. Any section where all sentences are the same length — vary one
5. Any banned words still present — replace
6. Keep all facts, citations, technical terms intact

### No other files change.

---

## Technical Details

The new PASS1_PROMPT key additions (everything else stays from current version):

```
NON-NATIVE ACADEMIC REGISTER:
Write as a highly educated but non-native English academic writer 
paraphrasing from understanding. Use slightly roundabout constructions:
- "research on the concept of X" instead of "investigate X"
- "make evidence available to" instead of "provide with"
- "come up with specific" instead of "develop targeted"
- "it is imperative to understand the mechanism of" instead of "understanding X is essential"
- "processes undergoing to explain why" instead of "mechanisms determining why"

LIST MERGING (critical):
When the original text has numbered or bulleted items (research questions, 
objectives, hypotheses, significance sections, definitions), do NOT 
keep them as separate numbered lines. Rewrite them as connected flowing 
sentences in a paragraph. This is the most important rule.

NUMBER FORMATTING:
Always write percentages and numbers as words: "30 percent" not "30%", 
"three" not "3" (for numbers under 10).
```
