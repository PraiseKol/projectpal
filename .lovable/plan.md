

# Retrain Humanizer Based on Stealth Checker Analysis

## Problem Analysis

Comparing the three outputs reveals exactly why ProjectPal's humanizer scores poorly:

| Technique | ProjectPal (48% human) | Stealth Checker (97% human) |
|---|---|---|
| Tone | Casual/conversational ("Here's the thing", "We're talking about") | Academic/formal throughout |
| Contractions | Heavy use ("it's", "isn't", "don't") | Almost none |
| Rhetorical questions | Added ("Why do some women...?") | None |
| Em dashes/asides | Frequent ("—often called—") | Rare |
| Paraphrasing depth | Surface-level word swaps | Deep restructuring of clauses and grammar |
| Vocabulary | Casual synonyms ("just keep climbing") | Academic synonyms ("typified by", "piqued the curiosity") |
| Sentence structure | Same structure, just more informal | Inverted clauses, changed subject-verb order, passive/active swaps |

The core insight: AI detectors don't just look for "robotic" text. They also flag text that tries too hard to sound human. Stealth Checker succeeds by **deeply restructuring sentences at the grammatical level** while keeping the original academic register.

## Solution: Rewrite Both Prompts

### File: `supabase/functions/humanize-text/index.ts`

Replace PASS1_PROMPT and PASS2_PROMPT entirely with prompts modeled on Stealth Checker's actual behavior:

**New PASS1_PROMPT strategy:**
- Deep structural paraphrasing: reorder clauses, invert sentence structure, change active to passive and vice versa
- Use academic synonym substitution (not casual), e.g. "characterized by" becomes "typified by", "transcends" becomes "cuts across"
- NO contractions, NO conversational markers, NO rhetorical questions, NO em dashes
- Change the grammatical subject of sentences (e.g., "Researchers have investigated" becomes "The topic of X has piqued the curiosity of researchers")
- Vary sentence openings by restructuring, not by adding filler phrases
- Preserve all citations, statistics, technical terms exactly
- Keep the same formal/academic register as the original

**New PASS2_PROMPT strategy:**
- Check for any sentences that remain too close to the original wording and rephrase them
- Ensure no two consecutive sentences start with the same grammatical pattern
- Verify all citations and facts are preserved
- Fix any remaining AI-detectable patterns (uniform length, predictable transitions)

**Key differences from current prompts:**
- REMOVE: contractions requirement, informal markers, rhetorical questions, em dashes, "human imperfections"
- ADD: clause reordering, passive/active voice swaps, academic synonym replacement, grammatical restructuring
- KEEP: banned AI words list, sentence length variance, paragraph structure variance

### No other files change -- only the prompts in the edge function.

## Technical Details

The new PASS1_PROMPT will include specific restructuring techniques observed in Stealth Checker's output:

```
RESTRUCTURING TECHNIQUES (use all of these):

1. CLAUSE REORDERING
   Original: "Domestic violence, also known as IPV, is a global crisis"
   Rewrite:  "Intimate Partner Violence, which is also referred to as domestic violence, is a worldwide epidemic"

2. VOCABULARY SUBSTITUTION (academic, not casual)
   "characterized by" -> "typified by"
   "transcends" -> "cuts across" 
   "manifesting as" -> "results in"
   "investigate" -> "piqued the curiosity of researchers"
   "profound" -> "quite intense"
   "remarkable" -> "notable"

3. GRAMMATICAL SUBJECT CHANGES
   "This disparity has led researchers to..." -> "This gap has piqued the curiosity of researchers in..."
   "Recent statistics suggest..." -> "According to the recent statistics..."

4. SENTENCE STRUCTURE INVERSION  
   Active -> Passive or vice versa where natural
   Front-load different clause than original
```

The banned AI words list stays. The model remains `google/gemini-2.5-pro`. The two-pass flow stays. Only the prompt content changes.
