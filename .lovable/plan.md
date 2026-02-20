
# Three UI Enhancements: Credit Actions Sidebar, Discount Pricing, Chapter Action Prompt

---

## 1. Credit Actions Panel in Chat Sidebar

Add a collapsible section below the chat sessions list in the left sidebar that shows all AI actions with their **live credit costs** fetched from `app_settings`.

### How it works
- On mount, fetch all `credit_cost_%` keys from `app_settings` (same query pattern used in `CreditCostsSettings.tsx`)
- Display a compact list grouped by category (Basic, Writing, Tools) showing action name and cost badge
- Costs update live — whenever the admin changes a cost, the next time a user opens the chat page they see the new value
- Uses the same `CREDIT_OPERATIONS` data structure from `CreditCostsSettings.tsx` for labels and defaults, but fetches live values

### UI Design
- Placed inside the sidebar's `ScrollArea`, below the chat sessions list and the "View All" button
- Collapsible section with header "Action Costs" and a small coins icon
- Each row: action label on left, credit cost badge on right
- Compact text (text-xs/text-sm) to not overwhelm the sidebar
- Falls back to default costs if no `app_settings` entry exists yet

### File changed
- `src/pages/Chat.tsx` — add state for credit costs, fetch on mount, render section in sidebar

---

## 2. Discount Banner on Pricing Page

Show a promotional banner indicating current prices are discounted, with original (higher) prices displayed with strikethrough next to each plan card.

### How it works
- Define "original" prices as a multiplier or fixed set above the current base prices (e.g., original Pro monthly base: 15000, 30000, 60000, 120000 vs current discounted: 10000, 20000, 40000, 80000)
- Display the original price with a `line-through` style next to the current price on every plan card
- Add a promotional banner at the top of the pricing section: "Limited Time Offer — Prices will be restored in 1-2 months!"
- The banner uses a gradient/highlight style to draw attention

### UI Design
- Top banner: colored alert-style with a tag/sparkles icon, text about limited-time discount
- Each plan card's `CardTitle` area: show original price with strikethrough in smaller muted text, then the current price in bold
- Example: ~~₦15,000~~ ₦10,000

### File changed
- `src/pages/Pricing.tsx` — add original price arrays, discount banner component, strikethrough prices on cards

---

## 3. Subtle Chapter Action Prompt on AI Responses

After a chapter is generated, show a small inline action bar below the AI message (not a full modal) with "Copy" and "Humanize" buttons.

### How it works
- Use the existing `isDocumentContent()` function to detect if an AI response is a chapter/document
- When the typing effect completes (or for already-rendered messages), if `isDocumentContent` returns true, show a subtle inline prompt bar below the message content
- The prompt bar contains:
  - A brief text: "Make this content undetectable by AI checkers"
  - **Copy** button (reuses existing copy logic)
  - **Humanize** button that navigates to `/humanizer`
- The bar is styled as a small, rounded, slightly highlighted strip — not a modal

### UI Design
- Appears inside the AI message card, below the content, above the existing copy/export buttons
- Subtle background (e.g., `bg-primary/5 border border-primary/10 rounded-lg p-2`)
- Compact: single row with text + two small buttons
- Only shows for document-type content (chapters, proposals, etc.)
- The Humanize button uses `navigate("/humanizer")` on click

### File changed
- `src/pages/Chat.tsx` — add inline chapter action bar inside AI message rendering

---

## Technical Summary

| Feature | File Changed | Complexity |
|---|---|---|
| Credit actions in sidebar | `src/pages/Chat.tsx` | Medium — new fetch + UI section |
| Discount pricing display | `src/pages/Pricing.tsx` | Simple — static markup + styling |
| Chapter action prompt | `src/pages/Chat.tsx` | Simple — conditional inline UI |

No database changes, no edge function changes, no new files needed.
