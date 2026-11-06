# Project Notes

- Paywalls must use the shared `useUpgradeModal` hook (`src/hooks/useUpgradeModal.tsx`, mounted as `UpgradeModalProvider` in `App.tsx`) instead of bespoke upgrade toasts or redirects — one consistent upgrade treatment everywhere; `UpgradeDialog` is its UI.
- Toasts are sonner-only (`import { toast } from "sonner"`). The old shadcn `useToast`/`Toaster` was removed from App; do not reintroduce it. Error handling in tool pages goes through `useErrorHandler`.
- `/topics` department counts come from the `get_topic_department_counts()` SQL function (server-side aggregate), not client-side row tallying.
- Lifecycle emails (welcome, 3-day inactivity, low-credit) are sent by the `lifecycle-emails` edge function, scheduled daily at 08:30 UTC by the `lifecycle-emails-daily` pg_cron job; send-state is tracked in `profiles.welcome_email_sent_at` / `inactivity_email_sent_at` / `low_credit_email_sent_at` and respects `email_preferences` opt-outs.
- Project topics seed data lives in the database only (`project_topics`, 8 departments × 15); keep it idempotent by topic text when re-seeding.
- Blog posts are managed by super/admin users through the Admin → Blog tab (`src/components/Admin/BlogManagement.tsx`); RLS on `blog_posts` already gates writes to admins.
- Keep questionnaire export credit eligibility in a pure helper so the five-credit threshold is testable independently of the edge-function runtime.
