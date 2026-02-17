

# Improve AI Humanizer + Fix Chat UI Layout

## Part 1: Upgrade Humanizer to Actually Beat AI Detectors

**Problem**: The current humanizer prompt is too generic. AI detectors like GPTZero, Originality.ai, and Stealth Checker analyze specific patterns: uniform sentence length (low "burstiness"), predictable word choices (low "perplexity"), and formulaic transitions. The current prompt tells the AI to vary sentences and add hedging, but doesn't address the root patterns detectors flag.

**Solution**: Rewrite the system prompt in `supabase/functions/humanize-text/index.ts` with a multi-pass approach and detector-specific techniques:

### Key Techniques to Implement

1. **Bust uniform sentence length (burstiness)**: Explicitly instruct the model to never have 3+ consecutive sentences of similar length. Mix fragments, compound-complex sentences, and one-word emphasis.

2. **Increase vocabulary unpredictability (perplexity)**: Replace common AI-favored words ("utilize", "leverage", "crucial", "comprehensive", "facilitate", "delve", "moreover", "furthermore", "in conclusion") with varied, less predictable synonyms.

3. **Inject human imperfections**: Add occasional conversational asides, contractions ("it's", "don't", "can't"), rhetorical questions, and informal-but-academic phrasing.

4. **Break formulaic paragraph patterns**: AI tends to write Topic Sentence -> Supporting Detail -> Example -> Transition. Instruct the model to vary paragraph openings (start with evidence, a question, a counterpoint, or an anecdote).

5. **Add personal voice markers**: Phrases like "What's interesting here is...", "This is where things get tricky", "Admittedly,", "To put it simply,".

6. **Use a two-pass approach**: First pass rewrites for naturalness. Second pass specifically targets AI-detectable patterns (word list avoidance, sentence length variance check).

### Updated System Prompt Strategy

The new prompt will:
- Provide an explicit "banned words" list of AI-favored vocabulary
- Require sentence length variance (short/long/fragment mixing)
- Demand contractions and conversational markers
- Instruct varied paragraph structures
- Use `google/gemini-2.5-pro` instead of `gemini-3-flash-preview` for higher quality rewriting (the pro model produces more nuanced, less detectable output)
- Add a second AI call that reviews the first output specifically for remaining AI patterns

### File: `supabase/functions/humanize-text/index.ts`

Replace the system prompt and add a two-pass rewriting flow:
- Pass 1: Full humanization rewrite with the enhanced prompt
- Pass 2: A shorter "polish" call that scans for remaining AI-detectable patterns and fixes them
- Use `google/gemini-2.5-pro` for both passes (better reasoning = better humanization)

---

## Part 2: Chat UI Layout Fixes

### 2a. Fix Sidebar to be truly fixed (not affected by scroll)

**File: `src/pages/Chat.tsx`**

The sidebar already has `fixed` positioning on mobile and `relative` on desktop. The issue is that on desktop it uses `relative` inside a flex container. Change to:
- Desktop: Use `sticky top-0 h-screen` so it stays fixed while the main content scrolls
- The sidebar already uses `ScrollArea` internally for its own chat list, so that's fine

### 2b. Fix Input Area to bottom + Quick Actions above it

The current layout already has the input outside the scrollable area (from previous fix). Verify this is working correctly. The structure should be:
- Header (sticky top)
- Scrollable messages (flex-1 overflow-y-auto)
- Quick actions (shrink-0, above input)
- Input area (shrink-0, border-t, at bottom)

### 2c. Replace `Input` with `Textarea` + Shift+Enter behavior

**Current**: Uses `<Input>` with `onKeyPress` that sends on Enter.
**Fix**: 
- Replace `<Input>` with `<Textarea>` (auto-resizing, max 5 rows)
- `onKeyDown`: If Enter without Shift -> send message. If Shift+Enter -> allow newline (default textarea behavior).
- Style the textarea to look like the current rounded input with auto-resize

---

## Summary

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/humanize-text/index.ts` | Enhanced two-pass prompt + use gemini-2.5-pro model |
| 2 | `src/pages/Chat.tsx` | Sidebar sticky fix, replace Input with Textarea, Shift+Enter support |

### Technical Details

**Humanizer Prompt Changes:**
- Banned AI words list: "utilize", "leverage", "crucial", "comprehensive", "facilitate", "delve", "moreover", "furthermore", "in conclusion", "it is important to note", "plays a crucial role", "in today's world", "serves as a"
- Sentence length rule: No 3+ consecutive sentences within 5 words of each other's length
- Contraction requirement: Use contractions at least 30% of the time where grammatically appropriate
- Paragraph structure: Never start 2+ consecutive paragraphs the same way
- Two-pass flow: Pass 1 (humanize) -> Pass 2 (detect and fix remaining AI patterns)

**Chat Textarea Implementation:**
```
// Shift+Enter = newline (default), Enter alone = send
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}}
```

