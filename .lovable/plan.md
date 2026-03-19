

# Plan: Improve Humanizer to Pass GPTZero (Flash + 2-Pass)

## Approach
Keep `gemini-2.5-flash` for both passes (~2x current cost). Add GPTZero-specific rules targeting **burstiness** (sentence length variation) and **perplexity** (unexpected word choices).

## Changes — Single file: `supabase/functions/humanize-text/index.ts`

### 1. Add burstiness and perplexity rules to HUMANIZE_PROMPT

Insert 3 new rules before the existing Rule 16 (self-audit), renumbering as needed:

**RULE 17: SENTENCE LENGTH BURSTINESS** — After every 2 long sentences (20+ words), insert one SHORT sentence (4-9 words). Examples: "This matters.", "The data confirms it.", "Results varied widely." Occasionally write one very long sentence (35+ words). No 3 consecutive sentences should be within 5 words of each other in length.

**RULE 18: RAISE PERPLEXITY** — Replace predictable AI adjective-noun pairs with less common but valid alternatives ("significant impact" → "measurable footprint"). Use concrete specifics ("many researchers" → "over forty studies"). Insert occasional hedging ("or so it seems", "at least on paper"). Vary register within paragraphs (one sentence slightly informal, next more technical).

**RULE 19: STRUCTURAL REWRITING** — For at least 30% of sentences, restructure clause order (not just swap synonyms). Occasionally merge two short sentences with unexpected conjunctions ("and yet", "but then again"). Occasionally fragment a long sentence into a short declarative + continuation.

### 2. Strengthen Rule 13 (Avoid Uniform Simplification)

Increase retained complex vocabulary from 15-20% to 20-30%.

### 3. Update Rule 16 (Self-Audit) with new checks

Add: count sentence lengths (fix any 3 consecutive within 5 words of each other), verify at least 3 unexpected word pairings per paragraph.

### 4. Add second-pass burstiness audit

Create a `BURSTINESS_AUDIT_PROMPT` — a focused prompt that:
- Counts sentence lengths in the input
- Breaks up any stretches of 3+ sentences with similar length
- Adds 2-3 short punchy sentences where needed
- Replaces any remaining predictable AI word pairings
- Preserves all citations and references exactly

### 5. Update the processing flow (lines 332-337)

Replace single-pass with two-pass:
```
// Pass 1: Deep humanization with enhanced rules
const pass1Result = await callAI(LOVABLE_API_KEY, HUMANIZE_PROMPT, text);

// Pass 2: Burstiness enforcement
const humanizedText = await callAI(LOVABLE_API_KEY, BURSTINESS_AUDIT_PROMPT, pass1Result);
```

### Cost Impact
- **Current**: 1 Flash call per humanization
- **After**: 2 Flash calls per humanization (~2x cost)
- No model tier upgrade, no frontend or database changes needed

