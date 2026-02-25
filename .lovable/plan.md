

# Implementation Plan: Admin Messages Tab, Dynamic Credit Labels, Email Campaign Improvements

## Task 1: Admin Messages Tab (Super Admin Only)

### What it does
Adds a new "Messages" tab to the Admin page that lets super admins view, edit, and delete chat messages stored in the `messages` table.

### Technical approach
1. **New component: `src/components/Admin/MessagesManagement.tsx`**
   - Fetches messages via the `admin-operations` edge function (new action `getAllMessages`) since RLS restricts messages to session owners
   - Displays messages in a searchable, paginated table with columns: Date, User (email from emailMap), Session ID, Sender (user/ai), Content (truncated), Actions
   - Edit: Dialog to modify message content, calls `admin-operations` with `updateMessage` action
   - Delete: Confirmation dialog, calls `admin-operations` with `deleteMessage` action
   - Pagination (50 per page) since messages table can be large

2. **Update `supabase/functions/admin-operations/index.ts`**
   - Add three new actions: `getAllMessages`, `updateMessage`, `deleteMessage`
   - Uses service role key to bypass RLS
   - `getAllMessages`: paginated fetch with optional search, returns messages with session info
   - `updateMessage`: updates message content by ID
   - `deleteMessage`: deletes message by ID

3. **Update `src/pages/Admin.tsx`**
   - Add `MessageSquare` icon import and new tab trigger (super admin only)
   - Add `TabsContent` for messages tab rendering `MessagesManagement`

## Task 2: Dynamic Credit Labels on Dashboard

### What it does
The PPT Generator card currently shows a hardcoded "6 Credits" badge and the AI Humanizer shows a hardcoded "5 Credits" badge. These should reflect the live values from `app_settings`.

### Technical approach
1. **Update `src/pages/Dashboard.tsx`**
   - Expand the existing `app_settings` query (lines 113-121) to also fetch `credit_cost_ppt_base` and `credit_cost_humanizer` keys
   - Add two new state variables: `pptCreditCost` (default 10) and `humanizerCreditCost` (default 5)
   - Replace the hardcoded "6 Credits" badge on the PPT Generator card (line 673) with the dynamic `pptCreditCost` value
   - Replace the hardcoded "5 Credits" badge on the AI Humanizer card (line 758) with the dynamic `humanizerCreditCost` value

## Task 3: Email Campaign Delete & Resend

### What it does
Currently, delete and send buttons only appear for "draft" campaigns. This adds:
- Delete button for ALL campaigns (draft, sent, etc.)
- A "Copy & Resend" button for already-sent campaigns that duplicates the campaign as a new draft and opens the send dialog

### Technical approach
1. **Update `src/components/Admin/EmailCampaigns.tsx`**
   - Move the delete button outside the `campaign.status === "draft"` conditional so it appears for all campaigns
   - Add a confirmation dialog before deleting (especially for sent campaigns)
   - Add a "Copy & Resend" button (Copy icon) for sent campaigns that:
     - Creates a new campaign with the same subject, content, and type but with " (Copy)" appended to the name
     - Sets status to "draft"
     - Opens the send dialog for the new campaign
   - Add `AlertDialog` for delete confirmation

### Email sending assessment
The `send-newsletter` edge function already correctly:
- Accepts `userIds` array to send to specific selected users
- Fetches all auth users with pagination (handles >1000 users)
- Sends in batches of 10 with 300ms delay to avoid Resend rate limits
- Logs success/failure per recipient
- When `userIds` is provided, it bypasses email preference filtering (intentional for admin-selected sends)

There are no issues with the sending function. It properly delivers to all selected users. The only potential limitation is Resend's own rate limits (varies by plan), but the batching with delays mitigates this.

---

## Files to create
- `src/components/Admin/MessagesManagement.tsx`

## Files to modify
- `src/pages/Admin.tsx` (add Messages tab, super admin only)
- `src/pages/Dashboard.tsx` (fetch dynamic credit costs, update badges)
- `src/components/Admin/EmailCampaigns.tsx` (delete all campaigns, copy & resend)
- `supabase/functions/admin-operations/index.ts` (add message CRUD actions)

