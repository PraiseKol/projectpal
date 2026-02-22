
# Four Changes: Email Campaigns Fix, Live Settings Display, Smart Chat Classification, and Credit Error Messages

---

## 1. Fix Email Campaigns (Test Send and Actual Send)

**Problems identified:**

A. **Test email doesn't use campaign content.** The frontend sends `{ type, testEmail }` but NOT `campaignId`. The edge function's `sendTestEmail()` generates generic template content instead of using the campaign's actual subject and body. Fix: pass `campaignId` from the frontend and use the campaign content in the test function.

B. **CORS headers are incomplete.** The `send-newsletter` edge function uses a minimal CORS header set missing `x-client-info` and other Supabase client headers, which can cause the browser to reject the preflight response silently.

C. **Resend import uses an old CDN format.** Currently `https://esm.sh/resend@2.0.0` -- should use `npm:resend@4.0.0` for Deno compatibility.

**Changes:**

**File: `src/components/Admin/EmailCampaigns.tsx`**
- In `sendTestEmail()`, also send `campaignId: selectedCampaign.id` in the request body so the edge function can look up and use the actual campaign content.

**File: `supabase/functions/send-newsletter/index.ts`**
- Update CORS headers to include the full set (`authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`).
- Update Resend import to `npm:resend@4.0.0`.
- Modify `sendTestEmail()` to accept an optional `campaignId`, look up the campaign content from the database using the service role client, and use it for the test email instead of generating generic content.

---

## 2. General Settings Page Shows Live Credit Values

**Current state:** The `AppSettings` component already fetches from `app_settings` and displays current daily/monthly credit values. The description says "Default credit allocations for new users" but does not show the currently active values pulled from live data.

**Change:**

**File: `src/components/Admin/AppSettings.tsx`**
- Below each credit input, add a small info line showing the current live value from the database (e.g., "Current live value: 8"). This is already loaded from `app_settings` via `loadSettings()`, so no new fetching is needed -- just display `settings.default_daily_credits` and `settings.default_monthly_credits` with a label like "Currently active: X credits".

---

## 3. Smart Chat AI Classification Updates

Three sub-changes to the `chat-ai` edge function:

### 3a. Distinguish "asking about a chapter" from "requesting chapter generation"

Update the AI classification prompt to add two new categories:
- `"chapter_inquiry"` (1 credit): When user is asking questions ABOUT a chapter (e.g., "What should chapter 3 contain?", "How long should chapter 2 be?", "What goes in the methodology?") -- informational questions that don't require generating the actual chapter content.
- Keep existing chapter categories for actual generation requests.

The system prompt will also be updated so that for `chapter_inquiry` responses, the AI provides an explanation without generating full chapter content.

### 3b. Block partial chapter generation

Add to the AI system prompt a rule: "If a user asks for only a part/section of a chapter (e.g., 'Write only section 1.1' or 'Just the background to the study'), respond by explaining that you can only generate complete chapters, not partial sections. Do not generate partial chapter content."

### 3c. Outline costs at half chapter price, full project outline at 10 credits

Add new classification categories:
- `"chapter_outline"` -- when user asks for an outline of a specific chapter. Cost = half the chapter's generation cost (looked up dynamically from app_settings, divided by 2, rounded up).
- `"project_outline"` (10 credits) -- when user asks for an outline of the entire project or all chapters.

Update the classification prompt and the cost resolution logic to handle these new types.

**File: `supabase/functions/chat-ai/index.ts`**
- Update the `classifyRequest()` AI prompt to include `chapter_inquiry`, `chapter_X_outline`, and `project_outline` categories.
- Add cost calculation logic: for `chapter_X_outline`, cost = `Math.ceil(dynamicCostMap[chapter_X] / 2)`.
- Add `project_outline` with a fixed cost of 10 credits.
- Update system prompt to instruct the AI to refuse partial chapter generation and to only provide informational answers for inquiry-type questions.

---

## 4. Show Required Credits in Insufficient Credits Error

**Current state:** The 402 error from the edge function already includes `credits_required` and `credits_available` in the JSON response. The frontend toast shows the `errorBody.error` message which includes the cost in some cases but not all.

**Changes:**

**File: `supabase/functions/chat-ai/index.ts`**
- Ensure ALL insufficient credit error messages consistently include: "This requires X credits but you have Y available."

**File: `src/pages/Chat.tsx`**
- Update the 402 error handler to construct a more informative message using `errorBody.credits_required` and `errorBody.credits_available` if available: "You need X credits for this action but only have Y. Upgrade your plan for more credits!"

---

## Technical Summary

| Change | Files | Complexity |
|---|---|---|
| Fix email campaigns (test + send) | `EmailCampaigns.tsx`, `send-newsletter/index.ts` | Medium |
| Live credit display in settings | `AppSettings.tsx` | Simple (display only) |
| Smart chat classification (inquiry/outline/partial block) | `chat-ai/index.ts` | Medium-High |
| Credits needed in error messages | `chat-ai/index.ts`, `Chat.tsx` | Simple |
