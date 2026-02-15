
# Restrict AI Assistant Tab to Scholar Plan Only

## Overview

The AI Assistant tab in the Questionnaire Builder will be gated so only Scholar plan users can access it. Pro users will still see the tab but it will show a locked/upgrade prompt. The Builder and Preview tabs remain accessible to both Pro and Scholar users (no change).

## Changes

### File: `src/pages/QuestionnaireBuilder.tsx`

1. **Store `planType` in state** during the existing `checkAccess` flow (line 52-56 already fetches `plan_type`). Save it to a new `planType` state variable.

2. **Conditionally render the AI Assistant tab content**: When a Pro user clicks the "AI Assistant" tab, instead of showing the chat, show a card explaining the feature is Scholar-only with an upgrade button linking to `/pricing`.

3. **Visual indicator on the tab trigger**: Add a small "Scholar" badge or lock icon next to the AI Assistant tab label for non-Scholar users.

## Technical Details

### State addition
- Add `const [planType, setPlanType] = useState<string>("")` 
- In `checkAccess`, set `setPlanType(profile.plan_type)` after fetching the profile

### AI Assistant TabsContent (line 214-223)
Replace with a conditional:
- If `planType === 'scholar'`: render `<QuestionnaireChat>` as before
- Otherwise: render a centered card with a lock icon, "Scholar Only" heading, description text, and an "Upgrade to Scholar" button linking to `/pricing`

### Tab trigger styling (line 203-205)
- For non-Scholar users, append a small `Badge` with "Scholar" text next to the tab label

### No backend changes needed
The edge function already has its own credit/auth checks, so even if someone bypasses the UI, the backend will still validate properly.
