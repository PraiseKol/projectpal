# Roadmap

## Phase 1 — Credibility & bug fixes (approved plan) — COMPLETE
- [x] 1. Remove fake testimonials / inflated social proof (Testimonials.tsx, SocialProof.tsx)
- [x] 2. chat-ai: free insufficient-funds explanation + client/server balance check parity
- [x] 3. Chat: atomic session switch, failed-send retry, loading state
- [x] 4. Documents: clear stale upload on file change
- [x] 5. Blog/BlogPost/Topics/DepartmentTopics: loading/empty/error states
- [x] 6. Auth: signup-intent routing (`/auth?mode=signup`), Sign In link, "Different Email" → signup tab

## Phase 2 — First-run onboarding — COMPLETE
- [x] 7. Mount dashboard tour (TutorialProvider) with skip/restart, per-user completion
- [x] 8. "Start your first project" card above balances; new-user greeting
- [x] 9. Getting-started checklist instead of hidden empty sections
- [x] 10. Fix duplicate chat cards (merge or deep-link with starter prompt)
- [x] 11. Cost badges on chat starter prompts; operational credit copy

## Phase 3 — Free tier & paywall UX — COMPLETE
- [x] 12. PPT sample preview before paywall + wire Pro monthly free trial
- [x] 13. Unified upgrade panel (`useUpgradeModal` + `UpgradeDialog`, replaces all upgrade toasts in Chat, Paraphraser, Humanizer, Documents)
- [x] 14. Paraphraser locked-export state, credit disclosure, before/after sample
- [x] 15. Humanizer live cost, 25k-char limit, balance display

## Phase 4 — Quality polish — COMPLETE
- [x] 16. Adopt useErrorHandler (Chat, Documents, Paraphraser, Admin, DataAnalysis); single toast system (sonner-only, old Toaster removed)
- [x] 17. Mobile: Data Analysis header, Chat composer tracks visualViewport so the input stays visible above mobile keyboards
- [x] 18. aria-labels on icon-only buttons
- [x] 19. Lazy routes/export libs, memoize MarkdownRenderer, /topics aggregate counts via `get_topic_department_counts()` RPC

## Carried-over growth items — COMPLETE
- [x] Referral credit rewards (20 signup / 100 first purchase) in triggers + paystack-webhook
- [x] lifecycle-emails edge function + daily cron (welcome / 3-day inactivity / low-credit, respects email_preferences)
- [x] BlogManagement admin tab (Admin → Blog)
- [x] Seed 120 project topics across 8 departments (Computer Science, Mass Comm, Accounting, Business Admin, Economics, Nursing Science, Education, Political Science)
- [x] WhatsApp share after chapter generation (Chat) and PPT export (Documents) via ShareWithClassmates

## Not verified with a signed-in session
- Chat upgrade modal, post-generation WhatsApp share buttons, and Admin → Blog tab were code-reviewed and build-verified but not driven end-to-end in a signed-in browser (no test account selected).
