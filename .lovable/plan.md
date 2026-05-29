# Growth & SEO Build Plan

This is a large multi-feature build. Grouped into 7 deliverables, ordered by impact. Each is independently shippable.

---

## 1. Universal Referral with Credit Rewards

**Goal:** Every user (not just ambassadors) gets a referral code and earns **bonus credits** when friends sign up & purchase. Cash payouts remain ambassador-only.

**DB migration:**
- Add `referral_credit_rewards` table: `id, referrer_user_id, referred_user_id, trigger_event ('signup' | 'first_purchase'), credits_awarded, created_at`
- Backfill: ensure every existing user has a row in `referral_codes` (extend `handle_new_user` to auto-create a code on signup if user is NOT an ambassador — code format `USER-XXXXXX`).
- Add `app_settings` keys: `referral_signup_bonus_credits` (default 20), `referral_purchase_bonus_credits` (default 100).

**Edge function:** `award-referral-credits` — called from `handle_new_user` trigger (signup) and `paystack-webhook` (first purchase). Awards bonus credits to `referred_by` if referrer is NOT an ambassador (ambassadors keep cash commission instead).

**UI:** In Settings → existing `ReferralCodeCard` — show "Earn X credits per signup, Y credits per first purchase" for non-ambassadors. Show shareable link with WhatsApp CTA.

---

## 2. Landing Page Social Proof

**Goal:** Fix conversion leak on `/` (Index.tsx).

**Add to Index.tsx:**
- Live stats counter (students helped, projects generated, universities) — query from `profiles`, `documents`, `analysis_sessions` counts via a public RPC.
- Testimonials section (3–5 cards, hardcoded initially with real student names/universities — placeholder copy user can edit later).
- "Sample outputs" carousel — 3 screenshots of generated PPT + chapter (use placeholder images user can replace).
- University logos strip ("Used by students at: UNILAG, UI, OAU, FUTA, ABU, UNN").

All as new section components in `src/components/Landing/`.

---

## 3. Lifecycle Emails (Cron-Driven)

**Goal:** Automated triggered emails using existing Resend setup.

**New edge function:** `lifecycle-emails` — runs hourly via pg_cron. Sends:
- Day 1 welcome (uses `created_at`)
- Day 3 re-engagement (if zero `messages` activity)
- 7-day inactive nudge
- Credits expiring in 7/3/1 days (uses `credits_expiry_date`)
- Paid credits below 20% nudge

Tracks sent emails in `email_logs` with `campaign_id = NULL` and a new `email_type` column (`lifecycle_*`). Respects `email_preferences`.

**Cron setup:** via `supabase--insert` after function is deployed.

---

## 4. SEO Content Engine

**a) Blog at `/blog` and `/blog/:slug`:**
- New table `blog_posts`: `id, slug, title, excerpt, content (markdown), cover_image_url, author, published, published_at, created_at, updated_at, meta_description, keywords`.
- Public SELECT where `published = true`; admin full access.
- Pages: `Blog.tsx` (list), `BlogPost.tsx` (detail with MarkdownRenderer, SEO component, JSON-LD Article schema).
- Admin tab in `Admin.tsx` → `BlogManagement.tsx` for CRUD (also "AI seed post" button using Lovable AI to draft from a topic).
- Seed 5 starter posts via migration: "How to write Chapter 3 methodology", "Literature review guide", "Choosing a project topic", "Defending your project", "Research questions vs objectives".

**b) Programmatic SEO at `/topics/:department`:**
- New table `project_topics`: `id, department (slug), department_name, topic, level (undergrad/postgrad), created_at`.
- Public SELECT all.
- Page `Topics.tsx` (list of departments) and `DepartmentTopics.tsx` ("200 Computer Science Project Topics") with SEO meta.
- Seed ~10 departments × 30 topics via migration (Computer Science, Mass Comm, Accounting, Business Admin, Education, Nursing, Microbiology, Economics, Political Science, English).

**c) Generated `sitemap.xml`:**
- `scripts/generate-sitemap.ts` with predev/prebuild hooks.
- Includes static routes + dynamic blog slugs + department slugs (fetched via supabase client at build time).
- Update `public/robots.txt` to reference sitemap and existing domain `https://projectpal.site`.

**d) Add `/blog` and `/topics` routes to `App.tsx`** (public, no auth).

---

## 5. Dashboard Onboarding Tour

**Goal:** Reuse existing Tutorial system for first-time dashboard visitors.

- Add 5 steps in a new `dashboardTutorialSteps.ts`: Welcome → Chat card → PPT card → Credits display → Upgrade CTA.
- Wrap `Dashboard.tsx` in `TutorialProvider` (single stage).
- Add `data-tutorial-id` attributes to existing dashboard elements.
- Show `WelcomeDialog` variant on first login (separate localStorage key: `projectpal_dashboard_welcome_shown`).

---

## 6. Pro Free Monthly PPT + Data Analysis Trial

**Goal:** Let Pro users try Scholar features once/month.

- Add columns to `profiles`: `monthly_free_ppt_used_at`, `monthly_free_analysis_used_at` (timestamp, nullable).
- Update `FeatureGate.tsx`: if feature is `powerpoint_generator` or `data_analysis` AND user is Pro AND monthly free slot not used this calendar month → allow access with a one-time-this-month banner.
- After successful PPT generation / analysis run in edge functions, set the corresponding `_used_at` to now.
- Dashboard shows "🎁 1 free PPT this month" badge for Pro users.

---

## 7. WhatsApp Share After Generation

**Goal:** Post-success share prompts.

- New component `ShareWithClassmates.tsx`: shows after PPT download (`Documents.tsx`) and chapter generation (`Chat.tsx`). 
- Generates WhatsApp deep link `https://wa.me/?text=...` with referral code baked in.
- Copy: "I just made my project chapter with ProjectPal! Get 10% off your first 3 purchases with my code: {code} → projectpal.site/auth?ref={code}"

---

## Files Touched (Summary)

| Area | Files |
|------|-------|
| DB migrations | 4 new migrations (referral rewards, blog_posts, project_topics, profiles columns) |
| Edge functions | `lifecycle-emails` (new), `paystack-webhook` (edit), `generate-ppt` (edit), `data-analysis` (edit) |
| Pages | `Blog.tsx`, `BlogPost.tsx`, `Topics.tsx`, `DepartmentTopics.tsx` (new); `Index.tsx`, `Dashboard.tsx`, `Documents.tsx`, `Chat.tsx`, `Admin.tsx` (edit) |
| Components | `Landing/SocialProof.tsx`, `Landing/Testimonials.tsx`, `Landing/SampleOutputs.tsx`, `Admin/BlogManagement.tsx`, `ShareWithClassmates.tsx`, `Tutorial/dashboardTutorialSteps.ts` (new); `FeatureGate.tsx`, `ReferralCodeCard.tsx` (edit) |
| SEO infra | `scripts/generate-sitemap.ts`, `public/robots.txt`, `package.json` predev/prebuild |
| Routing | `App.tsx` adds 4 public routes |

---

## Execution Order

I'll ship in this order so each milestone is independently testable:

1. **DB migrations** (all 4 in parallel where possible) → request approval
2. **Universal referrals + ReferralCodeCard update**
3. **SEO engine** (blog + topics + sitemap + routes)
4. **Landing page social proof**
5. **Lifecycle emails edge function + cron**
6. **Dashboard tour**
7. **Pro free trials**
8. **WhatsApp share component**

This is ~15–20 file changes + 4 migrations + 1 new edge function. Estimated 3–4 implementation rounds.

**Note on scope:** This plan deliberately keeps testimonials, university logos, and sample output images as placeholders — you'll need to replace those with real assets/quotes. I'll flag exactly where to swap them.
