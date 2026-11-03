# Roadmap

## Phase 1 — Credibility & bug fixes (approved plan, in progress)
- [ ] 1. Remove fake testimonials / inflated social proof (Testimonials.tsx, SocialProof.tsx)
- [ ] 2. chat-ai: free insufficient-funds explanation + client/server balance check parity
- [ ] 3. Chat: atomic session switch, failed-send retry, loading state
- [ ] 4. Documents: clear stale upload on file change
- [ ] 5. Blog/BlogPost/Topics/DepartmentTopics: loading/empty/error states
- [ ] 6. Auth: signup-intent routing (`/auth?mode=signup`), Sign In link, "Different Email" → signup tab

## Phase 2 — First-run onboarding
- [ ] 7. Mount dashboard tour (TutorialProvider) with skip/restart, per-user completion
- [ ] 8. "Start your first project" card above balances; new-user greeting
- [ ] 9. Getting-started checklist instead of hidden empty sections
- [ ] 10. Fix duplicate chat cards (merge or deep-link with starter prompt)
- [ ] 11. Cost badges on chat starter prompts; operational credit copy

## Phase 3 — Free tier & paywall UX
- [ ] 12. PPT sample preview before paywall + wire Pro monthly free trial
- [ ] 13. Unified upgrade panel (replace 4 paywall treatments)
- [ ] 14. Paraphraser locked-export state, credit disclosure, before/after sample
- [ ] 15. Humanizer live cost, 25k-char limit, balance display

## Phase 4 — Quality polish
- [ ] 16. Adopt useErrorHandler; single toast system
- [ ] 17. Mobile: Data Analysis header, Chat composer viewport/textarea
- [ ] 18. aria-labels on icon-only buttons
- [ ] 19. Lazy routes/export libs, memoize MarkdownRenderer, chunked typing, /topics aggregate counts

## Carried-over growth items (from earlier plan, pending)
- [ ] Referral credit rewards in paystack-webhook (20 signup / 100 first purchase)
- [ ] lifecycle-emails edge function + cron
- [ ] BlogManagement admin tab
- [ ] Seed ~120 project topics across 8 departments
