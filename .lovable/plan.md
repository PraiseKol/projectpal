

# Plan: Update All URLs from Old Domains to `projectpal.site`

## Summary of Findings

After a thorough scan of the entire codebase and database, here are all the places that need updating:

---

## File 1: `index.html`

Four URL references need to change:

| Line | Current | New |
|------|---------|-----|
| 14 | `https://projectpal.lovable.app/` (canonical) | `https://projectpal.site/` |
| 19 | `https://id-preview--52a6c29a-...lovable.app/images/projectpal-og.png` (og:image) | `https://projectpal.site/images/projectpal-og.png` |
| 20 | `https://projectpal.lovable.app/` (og:url) | `https://projectpal.site/` |
| 27 | `https://id-preview--52a6c29a-...lovable.app/images/projectpal-og.png` (twitter:image) | `https://projectpal.site/images/projectpal-og.png` |

---

## File 2: `supabase/functions/send-newsletter/index.ts`

Three changes:

| Line | What | Change |
|------|------|--------|
| 234 | `baseUrl` fallback | Change `"https://projectpal.lovable.app"` to `"https://projectpal.site"` |
| 144 | `from` email address | Change `"ProjectPal <onboarding@resend.dev>"` to `"ProjectPal <noreply@projectpal.site>"` (since Resend is connected to the domain) |
| 219 | `from` email address (test emails) | Same change as above |

Also update line 234 to use a hardcoded base URL `"https://projectpal.site"` instead of the fragile `SUPABASE_URL` string replacement logic.

---

## File 3: `vercel.json`

No URL changes needed -- the rewrite config is domain-agnostic and works correctly.

---

## Already Correct (No Changes Needed)

- **`src/pages/Auth.tsx`**: Uses `window.location.origin` dynamically -- will automatically use `projectpal.site` when deployed there
- **`src/components/SEO.tsx`**: Uses relative paths for og:image (`/images/projectpal-og.png`) -- correct
- **`supabase/functions/manage-email-preferences/index.ts`**: Uses relative paths -- correct
- **`.env`**: Contains only Supabase connection details -- no domain URLs
- **`app_settings` table**: Contains only `PAYSTACK_PUBLIC_KEY` and `default_monthly_credits` -- no URLs
- **`robots.txt`**: No URLs -- correct
- **All other edge functions**: No hardcoded URLs found

---

## Technical Details

### `index.html` changes (4 replacements)
- Replace all `projectpal.lovable.app` with `projectpal.site`
- Replace all `id-preview--52a6c29a-04d7-4f1f-88ae-2afc4f2d550e.lovable.app` with `projectpal.site`

### `send-newsletter/index.ts` changes (3 replacements)
- Line 234: `const baseUrl = "https://projectpal.site";`
- Lines 144 and 219: `from: "ProjectPal <noreply@projectpal.site>"`

### Production Readiness Note
Since you've connected your Resend account to the `projectpal.site` domain, the sender email should use that domain (e.g., `noreply@projectpal.site`) instead of the default `onboarding@resend.dev` to improve email deliverability and avoid spam filters.

