# Plan: Make ProjectPal More Appealing to New Users — Prioritized Upgrade Build

## What the audit found (summary)

The app's happy path is solid, but a first-time user hits: fake "real students" testimonials, a paywall that can charge a credit just to explain a restriction, duplicate dashboard cards leading to the same chat, a finished tutorial that was never switched on, bugs where a new upload keeps processing the old file, and error screens that pretend everything is fine. Below is the fix list in priority order.

## Phase 1 — Credibility & bug fixes (must-do)

1. **Testimonials trust defect** — `src/components/Landing/Testimonials.tsx` shows placeholder quotes labeled "Real students. Real chapters. Real defence wins." with five stars. Remove the section (or clearly mark as example) until real quotes exist. Same for `SocialProof.tsx`: show only real counts, no inflated floors.
2. **Stop charging for a paywall explanation** — `supabase/functions/chat-ai` deducts 1 credit to tell a Free user they can't afford an action. Make insufficient-funds explanations free, and check both daily and monthly balances on the client like the server does.
3. **Chat session-switch bug** — `src/pages/Chat.tsx` sets the active session before messages load; a failed load shows conversation A while typing into B. Switch session + messages atomically after success, add a loading state, ignore stale responses, and mark failed sends with inline retry instead of showing them as sent.
4. **PPT generator stale upload** — `src/pages/Documents.tsx` keeps the old uploaded document URL when a new file is selected, so it can generate from the wrong document. Clear upload/output/error on file change.
5. **Public pages lie about errors** — Blog, BlogPost, Topics, DepartmentTopics show "No posts yet"/"Post not found" when the request actually fails. Add proper loading / empty / failed states with retry.
6. **Auth entry fixes** — "Get Started Free" and "Create Free Account" open Sign In (`src/pages/Auth.tsx` defaults to it); send users to the signup tab (`/auth?mode=signup`) and add a plain Sign In link. "Use a Different Email" must return to the signup tab.

## Phase 2 — First-run onboarding (biggest appeal win)

7. **Wire the existing dashboard tour** — `TutorialProvider` + step components are fully built but never mounted in `App.tsx`. Turn on a 4–5 step first-login tour with skip/restart, stored per user (not browser-wide).
8. **"Start your first project" card** — new card above the credit balances: pick department, enter topic, get an outline. First login greets "Welcome Back" — greet new users with "Welcome, let's start your project."
9. **Replace hidden empty sections** — recent chats/paraphrases only render when data exists. Show a short getting-started checklist with one recommended action instead of blank space.
10. **Fix duplicate cards** — "Start Chat", "Generate Project", and "Academic Writing" all open the same `/chat` with no context. Merge into one card or deep-link each with its starter prompt and cost.
11. **Cost transparency in chat** — show the estimated credit cost beside each starter prompt and translate balances operationally ("You can ask a question now").

## Phase 3 — Free tier & paywall UX

12. **Show PPT value before the paywall** — Free users are redirected to pricing before seeing the tool. Show a sample deck preview and the configuration screen for everyone; keep generation Scholar-only. Also wire the planned Pro monthly free trial (`monthly_free_ppt_used_at` columns exist but nothing uses them).
13. **Unified upgrade panel** — replace the four different paywall treatments (dashboard modal, hard redirect, destructive toast in Paraphraser, credit-charged chat explanation) with one contextual panel: what you tried → what you can still do free → what the plan unlocks → price → upgrade or continue free.
14. **Paraphraser honesty** — free users can generate but get destructive upgrade toasts when copying. Show a clear locked-export state, disclose that generation costs credits, and add a before/after sample.
15. **Humanizer** — fetch the live cost instead of the hard-coded 5-credit badge, show the 25,000-character limit and current balance before submission.

## Phase 4 — Quality polish

16. **One error-handling contract** — adopt `useErrorHandler` across pages (it exists, unused); remove the raw backend-error toasts; keep one toast system, not both.
17. **Mobile fixes** — Data Analysis header crowds at 320–375px (collapse title, compact step indicator); Chat composer needs dynamic-viewport height so the keyboard doesn't cover it and a scrollable textarea at its 120px cap.
18. **Accessibility** — add aria-labels to icon-only buttons (mobile nav, chat menu/back/send, settings back).
19. **Performance** — lazy-load routes and the `docx`/`jspdf` export libraries; memoize `MarkdownRenderer`; reveal chat answers in chunks instead of character-by-character reparsing; `/topics` should fetch aggregated counts instead of sampling up to 1,000 rows.

## Files touched (main)

| File | Change |
|------|--------|
| `src/components/Landing/Testimonials.tsx`, `SocialProof.tsx` | Remove fake social proof |
| `supabase/functions/chat-ai/index.ts` | Free insufficient-funds explanation, balance check parity |
| `src/pages/Chat.tsx` | Session-switch atomicity, failed-send retry, cost badges, composer fixes |
| `src/pages/Documents.tsx` | Stale-upload fix, sample preview for non-Scholar |
| `src/pages/Blog.tsx`, `BlogPost.tsx`, `Topics.tsx`, `DepartmentTopics.tsx` | Loading/empty/error states |
| `src/pages/Auth.tsx`, `src/pages/Index.tsx` | Signup-intent routing, Sign In link |
| `src/App.tsx`, `src/components/Tutorial/*` | Mount dashboard tour |
| `src/pages/Dashboard.tsx` | First-project card, checklist empty states, merge duplicate cards |
| `src/pages/Paraphraser.tsx`, `Humanizer.tsx` | Locked-export state, live costs, limits |
| `src/components/FeatureGate.tsx` + PPT/data-analysis functions | Pro monthly free trial |
| `src/pages/DataAnalysis.tsx`, `MobileNav.tsx`, `Settings.tsx` | Mobile header, aria-labels, unsaved-session warning |
| `src/App.tsx`, export components | Lazy routes, lazy export libs |

## Suggested build order

Phase 1 first (trust and bugs), then Phase 2 (onboarding), then 3 and 4 in follow-up passes. Each phase ships independently.
