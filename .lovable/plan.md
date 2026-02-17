

# Fix Scroll Buttons & Add Credit Costs Admin Tab

## 1. Fix Floating Scroll Buttons in Chat

**Problem**: The `ChevronUp` (scroll-to-top) button is currently rendered *inside* the scrollable `div` (line 615), so it scrolls away with the content and isn't visible when needed. The `ChevronDown` button is correctly placed outside the scrollable area using `absolute` positioning (line 722).

**Fix in `src/pages/Chat.tsx`**:
- Move the `showScrollUp` button from inside the scrollable div (line 615-624) to outside it, next to the `showScrollDown` button (around line 720)
- Position both buttons using `absolute` within the `relative` chat area container
- `ChevronUp`: positioned at `top-4 right-8` (just below the header)
- `ChevronDown`: keep at `bottom-40 right-8` (above input area)
- Both use `z-20 rounded-full shadow-lg` with opacity transition for visibility

## 2. Add "Credit Costs" Tab to Admin Panel

**New component: `src/components/Admin/CreditCostsSettings.tsx`**

A new admin tab that displays all operation credit costs in an editable table. Each row shows:
- Operation name (e.g., "Chapter 1 / Introduction")
- Current credit cost
- A number input + save button to update

The costs will be stored in the existing `app_settings` table using keys like `credit_cost_chapter_1`, `credit_cost_chapter_2`, etc.

**Operations to manage**:

| Key | Label | Default |
|-----|-------|---------|
| credit_cost_simple_chat | Simple Chat | 1 |
| credit_cost_article_search | Article Search | 1 |
| credit_cost_grammar_fix | Fix Grammar / Improve Clarity | 2 |
| credit_cost_suggestions | Suggestions (Academic Tone, Topics, Outlines) | 2 |
| credit_cost_paraphraser | Paraphraser | 2 |
| credit_cost_analysis | Summarize / Extract Key Points | 4 |
| credit_cost_chapter_1 | Chapter 1 (Introduction) | 5 |
| credit_cost_chapter_5 | Chapter 5 (Conclusion) | 5 |
| credit_cost_questionnaire_chat | Questionnaire Chat | 2 |
| credit_cost_questionnaire_build | Questionnaire Build | 5 |
| credit_cost_questionnaire_export | Questionnaire Export | 5 |
| credit_cost_chapter_2 | Chapter 2 (Literature Review) | 10 |
| credit_cost_ppt_base | PowerPoint Generator | 10 |
| credit_cost_ppt_images | PowerPoint + Images | 15 |
| credit_cost_chapter_5_alt | Chapter 5 (Advanced) | 15 |
| credit_cost_research_proposal | Research Proposal | 20 |
| credit_cost_journal_paper | Journal Paper | 20 |
| credit_cost_chapter_3 | Chapter 3 (Methodology) | 25 |
| credit_cost_data_analysis | Data Analysis | 30 |
| credit_cost_chapter_4 | Chapter 4 (Results) | 50 |
| credit_cost_full_wrap | Fully Wrap Project | 50 |

**Admin page changes (`src/pages/Admin.tsx`)**:
- Import the new `CreditCostsSettings` component
- Add a new tab trigger with a `Coins` icon labeled "Credit Costs"
- Restrict to super_admin only (like Users, Transactions, Roles)

**Edge function integration (future-ready)**:
- The edge functions (`chat-ai`, `document-ai-chat`, `questionnaire-ai`, etc.) already use `app_settings` for other configs. The AI classifier in `chat-ai` currently returns hardcoded costs. In a future iteration, these can be updated to fetch from `app_settings` using the keys above. For now, the admin tab provides visibility and the ability to set the values, and the display serves as a reference for what each operation costs.

## Summary of File Changes

| File | Change |
|------|--------|
| `src/pages/Chat.tsx` | Move scroll-up button outside scrollable div, fix positioning |
| `src/components/Admin/CreditCostsSettings.tsx` | New component: editable credit costs table |
| `src/pages/Admin.tsx` | Add "Credit Costs" tab (super_admin only) |
