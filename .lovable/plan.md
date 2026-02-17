
# Make Admin Credit Costs Take Effect App-Wide + Fix Chat UI Layout

## Part 1: Dynamic Credit Costs from app_settings

Currently, every edge function has **hardcoded** credit costs. The admin can update values in `app_settings`, but no edge function reads them. This plan updates **all 7 edge functions** to fetch their cost from `app_settings` at runtime, falling back to defaults if no setting exists.

### Helper Pattern (added to each function)

Each function will fetch its relevant `credit_cost_*` keys from `app_settings` before the credit check. Example:

```
const { data: costSettings } = await supabaseClient
  .from('app_settings')
  .select('key, value')
  .in('key', ['credit_cost_paraphraser']);

const paraphraseCost = costSettings?.find(s => s.key === 'credit_cost_paraphraser')?.value 
  ? parseInt(costSettings.find(s => s.key === 'credit_cost_paraphraser').value) 
  : 2;
```

### Files to Update

**1. `supabase/functions/chat-ai/index.ts`**
- After classification determines `actionType`, fetch the matching `credit_cost_{actionType}` from `app_settings`
- Replace the hardcoded `validTypes` map with dynamically fetched values
- Fallback to current defaults if no setting found

**2. `supabase/functions/document-ai-chat/index.ts`**
- Same approach: after classification, fetch cost from `app_settings`
- Map classifier categories to the appropriate `credit_cost_*` keys

**3. `supabase/functions/paraphrase-ai/index.ts`**
- Replace `const paraphraseCost = 2` with a fetch of `credit_cost_paraphraser` from `app_settings`
- Fallback to 2

**4. `supabase/functions/questionnaire-ai/index.ts`**
- Replace `const CREDIT_COST = mode === 'build' ? 5 : 2` with fetches of `credit_cost_questionnaire_build` and `credit_cost_questionnaire_chat`
- Fallback to 5 and 2 respectively

**5. `supabase/functions/questionnaire-export/index.ts`**
- Replace `const EXPORT_COST = 5` with fetch of `credit_cost_questionnaire_export`
- Fallback to 5

**6. `supabase/functions/search-articles/index.ts`**
- Replace `const CREDIT_COST = 1` with fetch of `credit_cost_article_search`
- Fallback to 1

**7. `supabase/functions/generate-ppt/index.ts`**
- Replace `const BASE_CREDIT_COST = 10` and `const IMAGE_CREDIT_COST = 5` with fetches of `credit_cost_ppt_base` and `credit_cost_ppt_images`
- Fallback to 10 and 5

**8. `src/components/Admin/CreditCostsSettings.tsx`**
- Update the description text to remove the "reference only" caveat since costs will now be enforced dynamically

---

## Part 2: Chat UI Layout Fix

**Problem**: The sidebar (chat list), input area, and quick action suggestions all scroll with the messages. The user wants only the messages to scroll.

**Fix in `src/pages/Chat.tsx`**:

The main chat area (line 611) currently uses `overflow-hidden flex flex-col` with everything inside. The fix restructures it so:

1. **Sidebar** (left panel) -- already uses `flex flex-col` with `ScrollArea` inside, so only the chat list scrolls. No change needed.

2. **Main chat area** -- restructure the flex column:
   - Header: already `sticky top-0` -- keep as is
   - Messages area: `flex-1 overflow-y-auto` -- this is the ONLY scrollable section
   - Quick actions bar: move OUTSIDE the scrollable area, position it just above the input
   - Input area: move OUTSIDE the scrollable area, fixed at the bottom

The layout becomes:
```
<div className="flex-1 flex flex-col min-w-0">
  <header>...</header>                          <!-- fixed at top -->
  <div className="flex-1 overflow-y-auto relative">  <!-- only this scrolls -->
    {/* scroll buttons */}
    {/* messages */}
  </div>
  <div className="quick-actions px-4">...</div>  <!-- fixed above input -->
  <div className="input-area px-4 pb-4 border-t">...</div>  <!-- fixed at bottom -->
</div>
```

This ensures:
- The sidebar chat names section stays fixed (already works)
- The quick action suggestions and input area stick to the bottom
- Only the actual chat messages scroll

---

## Summary

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/chat-ai/index.ts` | Fetch credit costs from `app_settings` dynamically |
| 2 | `supabase/functions/document-ai-chat/index.ts` | Same |
| 3 | `supabase/functions/paraphrase-ai/index.ts` | Same |
| 4 | `supabase/functions/questionnaire-ai/index.ts` | Same |
| 5 | `supabase/functions/questionnaire-export/index.ts` | Same |
| 6 | `supabase/functions/search-articles/index.ts` | Same |
| 7 | `supabase/functions/generate-ppt/index.ts` | Same |
| 8 | `src/components/Admin/CreditCostsSettings.tsx` | Update description text |
| 9 | `src/pages/Chat.tsx` | Fix layout so only messages scroll |
