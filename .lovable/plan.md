

# Rebuild Humanizer Prompt to Match Stealth Writer's Strategy

## Analysis Summary

After comparing three original texts, their Stealth Checker scores, and Stealth Writer's rewrites, the core insight is clear: **Stealth Writer does NOT try to write better or more creative English. It writes slightly worse English in specific ways that mimic a real human paraphrasing from memory.**

Our current prompt over-engineers the output with deep grammatical restructuring, list-to-prose merging, and unpredictable vocabulary mixing. This produces text that is *too clean and creative* — ironically making it more detectable as AI.

### What Stealth Writer Actually Does (the winning patterns)

| Pattern | Example | Why it works |
|---|---|---|
| Close synonym swaps | "prevents access" becomes "blocks access" | Stays near source like a real paraphraser |
| Translation-artifact grammar | "The hopefully of creating", "the designing" | Strong human fingerprint — AI never writes this badly |
| Unnecessary/missing articles | "The ransomware is a certain category" | Non-native English pattern AI models avoid |
| Keeps numbered lists intact | Research questions stay as 1. 2. 3. 4. | Lists aren't AI signals; over-polished prose is |
| Sentence-level word swaps, not restructuring | Same clause order, different words | Mirrors how real humans paraphrase |
| Occasional slight nonsense | "hw/ change kernel loading" | Human error patterns |
| Passive/active flips at word level | Simple voice changes within same structure | Natural variation without over-engineering |

### What Our Current Prompt Does Wrong

1. **Rule 1 (List Merging)** — Forces conversion of all lists to prose. Stealth Writer keeps them. This rule should be REMOVED.
2. **Rule 2 (Non-native register)** — Right idea but too polished. Needs to be more aggressively imperfect with actual grammatical mistakes.
3. **Rule 4 (Register mixing)** — Too creative. Should be simple synonym swaps instead.
4. **Rule 5 (Grammatical restructuring)** — Too deep. Should stay close to original structure.
5. **Missing: Article misuse** — A critical human signal not in our prompt at all.
6. **Missing: Translation artifacts** — Slightly awkward prepositional phrases that sound like back-translation.

---

## Implementation Plan

### Single file change: `supabase/functions/humanize-text/index.ts`

Replace the `HUMANIZE_PROMPT` constant with a new prompt that mirrors Stealth Writer's strategy. Everything else (credit logic, callAI function, etc.) stays the same.

### New Prompt Strategy (priority-ordered rules)

**1. CLOSE SYNONYM SUBSTITUTION (primary technique)**
- Replace individual words/phrases with near-synonyms while keeping the original sentence structure mostly intact.
- Do NOT deeply restructure sentences. Stay close to the source like someone paraphrasing from recent reading.
- Examples: "prevents" to "blocks", "specific type" to "certain category", "has emerged" to "has come up", "significantly" to "greatly".

**2. TRANSLATION-ARTIFACT GRAMMAR**
- Occasionally produce slightly awkward prepositional or noun phrases that sound like back-translation from another language.
- Add unnecessary articles ("The ransomware", "the designing of") or drop expected ones.
- Use slightly wrong prepositions occasionally: "bearing on finances" instead of "financial implications".
- Produce constructions like "the embracement of" instead of "the adoption of", "the hopefully of" instead of "the purpose of".
- These should appear naturally every 3-5 sentences, not in every sentence.

**3. PRESERVE STRUCTURE**
- Keep numbered lists as numbered lists. Do NOT convert them to prose.
- Keep the same paragraph and section structure as the original.
- Keep roughly the same sentence boundaries — do not aggressively merge or split sentences.
- Keep ALL citations, author names, dates, statistics, references EXACTLY as given.

**4. SENTENCE-LEVEL VOICE CHANGES**
- Occasionally flip active to passive or vice versa within a sentence, but keep the same clause order.
- Example: "Ransomware encrypts the files" becomes "The files are encrypted by ransomware" — simple, not creative.

**5. BANNED VOCABULARY**
- Keep the existing banned word list (utilize, leverage, crucial, comprehensive, facilitate, delve, moreover, furthermore, etc.).

**6. MINOR IMPERFECTIONS**
- Occasionally use a slightly redundant phrase: "in order to" where "to" suffices.
- Sometimes use "is able to" instead of "can", "due to the fact that" instead of "because".
- These wordy constructions are human signals.

**7. PERCENTAGE/NUMBER FORMATTING**
- Write percentages as words: "30 percent" not "30%".

**8. SELF-AUDIT**
- Before returning, check for any banned vocabulary and replace.
- Ensure no more than 2 consecutive sentences start with the same word.
- Do NOT over-polish — imperfections are intentional and must be preserved.

**9. WHAT NOT TO DO**
- Do NOT add contractions, conversational markers, rhetorical questions, or em dashes.
- Do NOT use markdown formatting.
- Do NOT add new information or remove existing content.
- Do NOT deeply restructure — stay close to the original.

### Model stays the same
- `google/gemini-2.5-flash` — single pass, no changes to architecture or credit logic.

### No other files change
- Frontend (`Humanizer.tsx`) remains unchanged.
- Credit system remains unchanged.
- Character limit (25,000) remains unchanged.

---

## Expected Impact

Based on the Stealth Writer results across all three test cases:
- Text A (88% human original) went to 99% human
- Text B (63% human original) went to 91% human  
- Text C (57% human original) went to 93% human

The key is that Stealth Writer's approach works regardless of how AI-heavy the original is, because it introduces genuine human-like imperfections rather than trying to write "better" text.
