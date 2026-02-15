
# Chat Lazy Creation, Admin Tab Restrictions, and PPT Slide Flexibility

## 1. Lazy Chat Session Creation

**Problem**: Every time a user opens the chat page without a `session_id`, a new "New Chat" session is created in the database -- even if they never send a message. This leads to clutter.

**Fix** in `src/pages/Chat.tsx`:
- In `initializeChat`, when there's no `session_id` in the URL, do NOT create a session. Instead, just set `sessionId` to `null` and show the empty chat UI.
- In `createNewChat` (the sidebar "New Chat" button), same approach: just clear messages and set `sessionId` to `null`. Do not insert into the database.
- In `handleSend`, before sending the first message, check if `sessionId` is `null`. If so, create the session in the database at that point, set the `sessionId`, update the URL, and then proceed with sending the message.
- This means the session is only persisted once the user actually sends their first message.

### Changes
- `initializeChat` (lines 105-147): Remove the `else` block that inserts a new chat_session. Just set `sessionId(null)` and `setMessages([])`.
- `createNewChat` (lines 189-215): Replace the database insert with just clearing state: `setSessionId(null)`, `setMessages([])`, `navigate("/chat")`.
- `handleSend` (lines 311-387): At the top, if `sessionId` is null, create the session first, then continue with the message flow.

## 2. Admin Tab Visibility Based on Role (Super Admin vs Admin)

**Problem**: Currently, the admin page checks for the `admin` role to grant access, but does not differentiate between `admin` and `super_admin`. Sensitive tabs (Users, Transactions, Roles, Audit Log) should only be visible to super admins.

**Fix** in `src/pages/Admin.tsx`:
- In `checkAdminAccess`, fetch ALL roles for the user (not just `admin`). Check if they have `admin` OR `super_admin`. Store which role(s) they have.
- Add a state variable `isSuperAdmin` (boolean).
- Conditionally render the tabs: Users, Transactions, Roles, and Audit Log tabs and their content are only shown when `isSuperAdmin` is true.
- Admin users (non-super) can still see: Overview, Activity, Ambassadors, Email Campaigns, Settings.

### Changes
- Add `const [isSuperAdmin, setIsSuperAdmin] = useState(false);`
- Update `checkAdminAccess` to query for both `admin` and `super_admin` roles, set `isSuperAdmin` accordingly.
- Wrap the 4 restricted `TabsTrigger` and `TabsContent` elements in `{isSuperAdmin && ...}` conditionals.

## 3. PPT Slide Content Flexibility (Avoid Squeezing)

**Problem**: The AI prompt asks for 10-15 slides, but bullet points per slide are hard-capped at 6-7 in the rendering code, and the slide count is hard-capped at 15. For long documents, content gets squeezed into too few slides with too many bullets truncated.

**Fix** in `supabase/functions/generate-ppt/index.ts`:
- Update the AI system prompt to instruct: "Use as many slides as needed. Limit each content slide to 4-5 bullet points maximum. If a section has more content, split it across multiple slides (e.g., 'Methodology (1/2)', 'Methodology (2/2)'). Aim for 12-25 slides for thorough coverage."
- Raise the `.slice(0, 15)` cap to `.slice(0, 30)` to allow longer presentations.
- In `buildContentSlide`, if there are more than 5 bullets, auto-split into continuation slides. This is a safety net in case the AI still sends too many bullets per slide.
- In `buildConclusionSlide` and `buildReferencesSlide`, similarly raise the bullet/reference caps slightly (8 to 12 for references).
- In the `toBullets` fallback function, raise `max` from 6 to 5 per slide but allow the fallback builder to create more slides.

### Specific Code Changes

**AI Prompt** (line ~1699):
- Change "Create 10-15 slides" to "Create 12-25 slides for thorough coverage"
- Add instruction: "Limit each slide to 4-5 bullet points. If a topic needs more points, split across multiple slides with numbered titles like 'Results (1/2)'."

**Slide cap** (line 1750):
- Change `.slice(0, 15)` to `.slice(0, 30)`

**Content slide rendering** (line 1072-1086):
- Change `if (i < 7)` to `if (i < 5)` -- render max 5 bullets per slide
- Add overflow handling: if a slide has more than 5 bullets, split into continuation slides automatically in the main build loop

**Conclusion slide** (line 1304):
- Change `if (i < 6)` to `if (i < 5)`

**References slide** (line 1365):
- Change `if (i < 8)` to `if (i < 10)` and add overflow to create additional reference slides

**Fallback builder** (`buildFallbackFromDocContent`):
- Update `toBullets` to use max 5 per call
- Split long sections into multiple slides

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Chat.tsx` | Defer session creation to first message send; "New Chat" just clears state |
| `src/pages/Admin.tsx` | Add `isSuperAdmin` state; restrict Users, Transactions, Roles, Audit tabs to super admins only |
| `supabase/functions/generate-ppt/index.ts` | Update AI prompt for more slides with fewer bullets each; raise slide cap to 30; auto-split overflowing slides; reduce per-slide bullet cap from 7 to 5 |
