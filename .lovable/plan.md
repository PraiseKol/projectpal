

# Multi-Feature Update: Fully Wrap, Ambassador Gating, Referral Tooltip, and Landing Page

## 1. Fully Wrap Project -- Remove Certification/Declaration, Add Warning

**File: `src/components/DocumentEditor/AIInstructionInput.tsx`**
- Update the "Fully Wrap Project" quick action instruction text to exclude "Certification" and "Declaration" from the generated sections
- Add a warning note in the instruction: "Important: Only use this if your document contains the full project (Chapters 1-5)."
- Add a visual warning banner above or beside the "Fully Wrap Project" button (or show a confirmation dialog when clicked) warning users not to use it unless they have uploaded chapters 1-5

**File: `supabase/functions/document-ai-chat/index.ts`**
- Update the system prompt for wrap project requests to remove Certification and Declaration from the generated structure. The output will now be: Title Page, Dedication, Acknowledgement, Abstract, Table of Contents, List of Tables, List of Figures, then References and Appendices after Chapter 5.

## 2. Ambassador Request -- Require Paid Plan

**File: `src/components/Settings/AmbassadorRequestCard.tsx`**
- Accept a new prop `planType: string` from the parent Settings page
- Check if `planType` is `'pro'` or `'scholar'` (and subscription is active)
- If user is on a free plan: instead of the request button, show the ambassador perks list and an "Upgrade to a Paid Plan" button that navigates to `/pricing`
- Ambassador perks to list:
  - Earn 5% commission on referral subscriptions
  - Get a unique shareable referral code
  - Access to the Ambassador Portal with analytics
  - Track referrals and earnings in real-time

**File: `src/pages/Settings.tsx`**
- Pass `profile?.plan_type` as a prop to `AmbassadorRequestCard`
- Also pass credit expiry info so the component can determine if the paid plan is still active

## 3. Ambassador Claim -- Require Active Paid Plan

**File: `src/pages/Ambassador.tsx`**
- After loading ambassador data, also fetch the user's profile to check `plan_type` and `credits_expiry_date`
- In the "Claim Commission" section (lines 453-506): add a check -- if the user is on a free plan (or their paid plan has expired), replace the claim button with a disabled state and a message: "Upgrade to a paid plan to claim your commission"
- The rest of the Ambassador page (stats, referrals, commissions, payouts) remains fully accessible

## 4. Referral Code Tooltip on Sign Up Page

**File: `src/pages/Auth.tsx`**
- Import `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` from `@/components/ui/tooltip`
- Import `Info` icon from `lucide-react`
- Next to the "Referral Code (Optional)" label (line 688), add an info icon wrapped in a Tooltip
- Tooltip content: "Get 5% off your first subscription upgrade when you sign up with a valid referral code!"

## 5. Landing Page Feature List Update

**File: `src/pages/Index.tsx`**
- Update the `features` array to include the new/missing features:
  1. "Generate project topics instantly"
  2. "Write comprehensive proposals"
  3. "Create chapters 1-5 with AI assistance"
  4. "Get accurate academic references"
  5. "Edit, improve, and paraphrase your work"
  6. "Fully wrap your project with preliminary pages and references"
  7. "Analyze research data with built-in statistical tools"
  8. "Build custom questionnaires for your research"
  9. "Generate PowerPoint presentations from your documents"
  10. "AI-powered document editor with grammar, clarity, and tone tools"

---

## Technical Details

### AmbassadorRequestCard prop changes

```text
interface AmbassadorRequestCardProps {
  userId: string;
  isAmbassador: boolean;
  planType: string;       // NEW
  creditsExpiry: string | null;  // NEW
}
```

The component checks:
- `planType !== 'free'` AND expiry date is in the future = paid user, show request button
- Otherwise = free user, show perks + upgrade button

### Ambassador.tsx claim gating

After `checkAmbassadorAccess`, fetch profile:
```text
const { data: profileData } = await supabase
  .from("profiles")
  .select("plan_type, credits_expiry_date")
  .eq("id", user.id)
  .single();
```

Store in state, then in the claim section:
- If `plan_type === 'free'` or expiry is past: show "Upgrade to claim" message with button to `/pricing`
- Otherwise: show normal claim flow

### Fully Wrap instruction update (AIInstructionInput.tsx)

The instruction string changes from including "Certification, Declaration" to excluding them. The new instruction will specify: Title Page, Dedication, Acknowledgement, Abstract, Table of Contents, List of Tables, List of Figures, References, Appendices.

### Auth.tsx tooltip addition

Add next to the label on line 688-691:
```text
<Label className="flex items-center gap-2">
  <Gift /> Referral Code (Optional)
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger><Info className="h-3.5 w-3.5" /></TooltipTrigger>
      <TooltipContent>Get 5% off your first subscription!</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</Label>
```

---

## Summary of Files to Modify

| File | Change |
|------|--------|
| `src/components/DocumentEditor/AIInstructionInput.tsx` | Remove Certification/Declaration from wrap instruction; add warning |
| `supabase/functions/document-ai-chat/index.ts` | Update system prompt to exclude Certification/Declaration |
| `src/components/Settings/AmbassadorRequestCard.tsx` | Gate request behind paid plan; show perks + upgrade CTA for free users |
| `src/pages/Settings.tsx` | Pass `planType` and `creditsExpiry` props to AmbassadorRequestCard |
| `src/pages/Ambassador.tsx` | Gate claim button behind active paid plan |
| `src/pages/Auth.tsx` | Add info tooltip next to referral code field |
| `src/pages/Index.tsx` | Update features list with new capabilities |

