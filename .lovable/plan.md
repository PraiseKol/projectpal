
# Humanizer Prompt V3 -- Deeper Stealth Writer Alignment

## Problem Analysis from Screenshots

The AI checker flagged these specific patterns as AI-generated in our humanizer output:

| Flagged Pattern | Why It Fails | Fix |
|---|---|---|
| "has emerged as a robust security" | "robust" is on banned list but model ignores it | Move banned list to TOP of prompt with stronger enforcement |
| "Furthermore, traditional authentication..." | "Furthermore" is banned but used | Same -- priority elevation |
| "which are unique to the individual--with" | Em dashes banned but used | Add to banned list more visibly |
| "Passwords can be easily compromised through phishing, brute-force attacks, keylogging, and credential stuffing" | Clean comma-separated list is AI pattern | New rule: break up clean enumerations |
| "The general objective of this study is to design and implement..." | Too close to original verbatim | Stronger requirement to change EVERY sentence |
| Definition items kept word-for-word | Definitions are easy AI detection targets | New rule: rephrase definitions awkwardly |
| Smooth multi-clause sentences with semicolons | Too polished for human paraphrasing | Rule to break or simplify complex sentences |

## Key Insight

The model is treating the rules as suggestions, not hard constraints. The fix is threefold:

1. **Restructure prompt priority** -- Put the banned vocabulary list FIRST with aggressive enforcement language
2. **Add new rules for AI-pattern breaking** -- specifically targeting comma-separated lists, smooth definitions, and verbatim phrases
3. **Increase translation artifact frequency** -- from every 3-5 sentences to every 2-4 sentences
4. **Add mandatory word-change density** -- every sentence MUST have at least 2-3 word substitutions; no sentence should survive unchanged

## Implementation

### Single file change: `supabase/functions/humanize-text/index.ts`

Replace the `HUMANIZE_PROMPT` constant with V3 prompt. No other changes needed.

### V3 Prompt Design (in priority order)

**RULE 1: BANNED VOCABULARY (HIGHEST PRIORITY -- CHECK THIS FIRST AND LAST)**
- Expanded list with stronger language: "If ANY of these words appear in your output, your entire response is a failure."
- Add words that appeared in flagged output: "emerged", "seamless", "explosive"
- Add pattern bans: no em dashes, no semicolons joining independent clauses

**RULE 2: MANDATORY CHANGE DENSITY**
- Every single sentence MUST be changed from the original. No sentence may survive with fewer than 2 word substitutions.
- If a sentence is short (under 10 words), at least 1 word must change.
- This prevents the verbatim copying that got flagged in definitions and objectives.

**RULE 3: CLOSE SYNONYM SUBSTITUTION (primary technique)**
- Same as before but with MORE examples and stronger emphasis on changing every sentence.
- Add: "revolutionized" becomes "changed", "explosive growth" becomes "fast growth", "sophisticated" becomes "advanced" or "complex".

**RULE 4: BREAK UP CLEAN ENUMERATIONS**
- NEW RULE: When the original has a clean comma-separated list within a sentence (e.g., "through phishing, brute-force attacks, keylogging, and credential stuffing"), break it up:
  - Split into two shorter sentences, OR
  - Remove one item and add it in a follow-up sentence, OR
  - Use "and" earlier or restructure the list awkwardly
- Clean enumerations are a strong AI signal.

**RULE 5: TRANSLATION-ARTIFACT GRAMMAR (increased frequency)**
- Changed from every 3-5 sentences to every 2-3 sentences.
- More specific examples:
  - "The effectiveness of biometric authentication is dependent on the quality" becomes "How effective the biometric authentication is depends on what quality"
  - "provides a blueprint for integrating" becomes "gives a kind of guideline for how to integrate"
  - "A security system that requires more than one method" becomes "A security type of system which is needing more than a single method"
- Add rule: definitions and short descriptive items are prime targets for awkward constructions.

**RULE 6: REFERENCE HANDLING**
- Keep all citations, author names, dates, page numbers EXACTLY as given.
- But the title text within references CAN be slightly reworded (this was flagged green in Stealth Writer output).

**RULE 7: PRESERVE STRUCTURE**
- Keep numbered lists as numbered lists.
- Keep paragraph breaks and section headings.
- Keep sentence boundaries roughly the same.

**RULE 8: SENTENCE-LEVEL VOICE CHANGES**
- Same as before: occasional active/passive flips.

**RULE 9: MINOR IMPERFECTIONS**
- "in order to" where "to" suffices
- "is able to" instead of "can"
- "due to the fact that" instead of "because"
- Occasional dropped article: "is critical issue" instead of "is a critical issue"
- Occasional unnecessary "the": "the security of the online transactions"

**RULE 10: WHAT NOT TO DO**
- No contractions, no conversational markers, no rhetorical questions
- No em dashes (use commas or parentheses instead)
- No semicolons joining independent clauses (split into two sentences)
- No markdown formatting
- No new information added or existing content removed

**RULE 11: FINAL SELF-AUDIT**
- Scan entire output for ANY banned word from Rule 1. Replace if found.
- Verify every sentence differs from the original by at least 2 words.
- Verify translation artifacts appear at least once every 3 sentences.
- Do NOT fix the awkward constructions -- they are intentional.

### Model remains `google/gemini-2.5-flash`
### No frontend or credit logic changes needed

## Expected Improvement

The key improvements target exactly the pink-flagged areas:
- Banned words will be caught by top-priority placement and double-audit
- Definitions and objectives will be reworded with imperfections instead of kept verbatim
- Clean comma lists will be broken up
- More frequent translation artifacts will push human score higher
- Em dashes and semicolons (AI patterns) will be eliminated
