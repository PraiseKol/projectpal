

# Mobile and Desktop Responsiveness Audit and Fix

## Summary

After reviewing all 17 pages and key components, the app is generally well-structured for desktop but has several mobile responsiveness issues. Most pages use `container mx-auto px-4` which is good, but specific elements need fixes for small screens (< 480px). The custom `xs: 480px` breakpoint is already configured in Tailwind.

## Pages and Issues Found

### 1. Index.tsx (Landing Page) -- Minor fixes
- Hero title `text-5xl` is too large on very small screens; needs `text-3xl xs:text-4xl md:text-5xl` progression
- CTA buttons stack on small screens: `flex-col xs:flex-row`
- CTA section Card `p-12` is too much padding on mobile: `p-6 sm:p-12`

### 2. Dashboard.tsx -- Moderate fixes
- Welcome card header: title + upgrade button need stacking on mobile with `flex-col xs:flex-row`
- Quick action cards grid: `grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-3` (already partially handled)
- Credit display text `text-3xl` is fine but the expiry info tooltip/progress area gets cramped
- Recent chat cards: the "Resume" button + delete icon row can overflow on narrow screens

### 3. Chat.tsx -- Well handled already
- Has `useIsMobile` hook, sidebar overlay, hamburger menu
- Quick actions grid: `md:grid-cols-2` is fine, but on mobile the empty state heading `text-2xl` could be slightly smaller
- Message cards use `ml-4 md:ml-12` and `mr-4 md:mr-12` which is good

### 4. Auth.tsx -- Good (max-w-md centered)
- Already responsive with `p-4` wrapper

### 5. Pricing.tsx -- Moderate fixes
- Billing period toggle buttons can overflow on very small screens; needs `flex-wrap` or `text-xs` on mobile
- Plan cards grid `md:grid-cols-2 lg:grid-cols-4` -- needs `grid-cols-1 xs:grid-cols-2` for small screens
- Desktop comparison table is hidden on mobile (good), mobile cards view exists (good)
- Page title `text-4xl` needs `text-2xl sm:text-3xl md:text-4xl`

### 6. Settings.tsx -- Good (already has xs/sm breakpoints)
- Already uses responsive padding and sizing

### 7. Ambassador.tsx -- Moderate fixes
- Header: `text-2xl` title + back button need mobile treatment; hide "Back" text on mobile
- Stats grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` -- on mobile `grid-cols-2` would be better than `grid-cols-1` for the stat cards since they're compact
- Referral code section: the code display `text-2xl` + 3 buttons need wrapping on mobile
- Commission tables: already have `overflow-x-auto` (good)
- Earnings breakdown: `grid-cols-1 md:grid-cols-3` -- use `grid-cols-3` on all sizes since values are just numbers

### 8. DocumentEditor.tsx -- Good (already responsive)
- Uses `grid-cols-1 lg:grid-cols-2`, responsive padding, sticky header

### 9. Documents.tsx (PPT Generator) -- Minor fixes
- Upload section: `flex gap-4` for file input + button needs `flex-col sm:flex-row`
- Page title + back button layout needs mobile treatment
- Credit cost text (`20 or 15 credits`) -- update to match new costs (10 or 15)

### 10. Paraphraser.tsx -- Good (already responsive)
- Uses `sm:` breakpoints throughout, grid cols responsive

### 11. DataAnalysis.tsx -- Minor fixes  
- Progress steps: step labels and circles get cramped on mobile; hide description text, reduce circle size on small screens
- Header credits/tutorial buttons need tighter spacing on mobile

### 12. QuestionnaireBuilder.tsx -- Minor fixes
- Header buttons (Sample, New, PDF, DOCX) get crowded on mobile; hide text labels, show only icons on small screens

### 13. TransactionHistory.tsx -- Good
- Already has mobile scroll indicator and `overflow-x-auto`
- Header back button: hide "Back to Dashboard" text on mobile

### 14. Admin.tsx -- Minor fixes
- TabsList with 9 tabs overflows on mobile; needs `overflow-x-auto` scrollable tabs
- Tab trigger text: hide labels on mobile, show only icons

### 15. ResetPassword.tsx -- Good (max-w-md centered)
### 16. CheckoutSuccess.tsx -- Good (max-w-md centered)
### 17. NotFound.tsx -- Good (max-w-md centered)

### 18. AIInstructionInput.tsx -- Good (already has ScrollArea horizontal)

## Files to Modify

| File | Priority | Changes |
|------|----------|---------|
| `src/pages/Index.tsx` | Medium | Responsive hero text, stacking CTA buttons, CTA card padding |
| `src/pages/Dashboard.tsx` | Medium | Welcome card flex stacking, recent chat card layout |
| `src/pages/Pricing.tsx` | High | Billing toggle overflow, plan card grid, page title sizing |
| `src/pages/Ambassador.tsx` | Medium | Header mobile text, stats grid cols, referral code wrapping, earnings grid |
| `src/pages/Documents.tsx` | Medium | Upload flex direction, header layout, credit cost text fix |
| `src/pages/DataAnalysis.tsx` | Medium | Progress steps mobile sizing, header spacing |
| `src/pages/QuestionnaireBuilder.tsx` | Low | Header buttons icon-only on mobile |
| `src/pages/TransactionHistory.tsx` | Low | Back button text hidden on mobile |
| `src/pages/Admin.tsx` | Medium | Tab list scrollable overflow on mobile, icon-only tabs |
| `src/pages/Chat.tsx` | Low | Minor text sizing tweaks |

## Technical Details

### Index.tsx Changes
- Line 63: `text-5xl md:text-6xl` -> `text-3xl xs:text-4xl md:text-5xl lg:text-6xl`
- Line 64: `text-xl` -> `text-base sm:text-xl`
- Line 68: `flex gap-4` -> `flex flex-col xs:flex-row gap-3 xs:gap-4`
- Line 116: `p-12` -> `p-6 sm:p-8 md:p-12`

### Dashboard.tsx Changes
- Line 332: Welcome header: wrap title+button in `flex-col xs:flex-row` with gap
- Line 345: Upgrade button: add `w-full xs:w-auto` so it stacks on mobile
- Line 504: Recent chats grid: ensure card content doesn't overflow

### Pricing.tsx Changes
- Line 288: Title `text-4xl` -> `text-2xl sm:text-3xl md:text-4xl`
- Line 306: Billing toggle: add `flex-wrap` or reduce button padding on mobile
- Lines 383/432: Plan grids: `grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4`

### Ambassador.tsx Changes  
- Line 257: Title `text-2xl` -> `text-lg sm:text-2xl`; hide "Back" text on mobile
- Line 317: Stats grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6`
- Line 286-309: Referral code + buttons: `flex-col` always, buttons wrap
- Line 539: Earnings breakdown: `grid-cols-3` on all sizes (numbers are compact)

### Documents.tsx Changes
- Line 245: Upload flex: `flex flex-col sm:flex-row gap-3 sm:gap-4`
- Line 227-235: Header: `flex-col sm:flex-row` with responsive text
- Line 298: Credit cost text -- should show 10/15 credits not 20/15

### DataAnalysis.tsx Changes
- Lines 220-255: Progress steps: reduce circle `w-12 h-12` to `w-8 h-8 sm:w-12 sm:h-12`, hide step name text on `xs`, show on `sm+`
- Line 205: Header gap: `gap-2 sm:gap-4`

### QuestionnaireBuilder.tsx Changes
- Lines 145-157: Header buttons: use `sm:` prefix for text, show only icons on mobile

### TransactionHistory.tsx Changes
- Line 91: Back button: hide "Back to Dashboard" text on mobile with `hidden sm:inline`

### Admin.tsx Changes
- Line 174: TabsList: add `overflow-x-auto` and `flex-nowrap` with horizontal scroll
- Tab triggers: hide text on mobile (`hidden sm:inline`), keep icons

### Chat.tsx Changes
- Line 599: Empty state heading: `text-xl sm:text-2xl`
- Line 604: Quick actions grid: already `md:grid-cols-2`, fine

### Documents.tsx Credit Cost Fix
- Line 298: Change `{includeImages ? 20 : 15}` to `{includeImages ? 15 : 10}` to match new PPT credit costs

