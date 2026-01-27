
# Plan: Fix PowerPoint Download Error and Update Credit Pricing

## Problem Analysis

### Issue 1: PowerPoint Download Fails with "Bucket not found" / 400 Error

**Root Cause Identified:**
The `documents` storage bucket is **private** (`public: false`), but the edge function uses `getPublicUrl()` to generate the download link. This causes a 400 error because:

1. `getPublicUrl()` generates a URL pattern: `https://.../storage/v1/object/public/documents/...`
2. The `/public/` path only works for **public buckets**
3. Since the bucket is private, Supabase returns a 400/404 error

**Evidence from database:**
- Bucket exists: `documents` (public: false)
- File exists in storage: `37c4a9e1-3e7d-4ffa-9f6f-78406a915f27/ppt-1769391759393.pptx`
- Error: "Bucket not found" when accessing via public URL pattern

**Solution:**
Change the edge function to use **signed URLs** instead of public URLs. Signed URLs provide temporary authenticated access to private storage objects.

### Issue 2: Credit Pricing Update

Update the credit costs in both the edge function and the frontend display:
- Base cost: 6 credits → **15 credits**
- With AI images: 8 credits → **20 credits**

---

## Implementation Details

### File 1: `supabase/functions/generate-ppt/index.ts`

**Changes:**

1. **Update credit constants** (lines 10-11):
   ```typescript
   // Before
   const BASE_CREDIT_COST = 6;
   const IMAGE_CREDIT_COST = 2;
   
   // After
   const BASE_CREDIT_COST = 15;
   const IMAGE_CREDIT_COST = 5;  // 15 + 5 = 20 with images
   ```

2. **Replace getPublicUrl with createSignedUrl** (lines 1572-1574):
   ```typescript
   // Before
   const { data: urlData } = supabaseClient.storage
     .from('documents')
     .getPublicUrl(fileName);
   
   // After
   const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
     .from('documents')
     .createSignedUrl(fileName, 3600); // 1 hour expiry
   
   if (signedUrlError || !signedUrlData?.signedUrl) {
     throw new Error('Failed to generate download URL');
   }
   ```

3. **Update response to use signed URL** (line 1588):
   ```typescript
   // Before
   ppt_url: urlData.publicUrl,
   
   // After
   ppt_url: signedUrlData.signedUrl,
   ```

### File 2: `src/pages/Documents.tsx`

**Changes:**

1. **Update credit display text** (line 294):
   ```typescript
   // Before
   Credit cost: <span className="font-semibold">{includeImages ? 8 : 6} credits</span>
   
   // After
   Credit cost: <span className="font-semibold">{includeImages ? 20 : 15} credits</span>
   ```

2. **Update image toggle credit indicator** (line 290):
   ```typescript
   // Before
   {includeImages ? "+2 credits" : ""}
   
   // After
   {includeImages ? "+5 credits" : ""}
   ```

---

## Technical Notes

### Why Signed URLs?
- **Security**: Files remain private in storage
- **Time-limited**: URLs expire after 1 hour (configurable)
- **No bucket changes needed**: No need to make the bucket public
- **Works with existing RLS**: Respects storage policies

### Signed URL Expiry
The signed URL will be valid for 1 hour (3600 seconds). This is sufficient for:
- Immediate download after generation
- Opening in the document viewer
- Multiple download attempts if needed

If users need to download later, they would need to regenerate the presentation (which is the expected behavior for a generation feature).

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `supabase/functions/generate-ppt/index.ts` | 10 | Change BASE_CREDIT_COST from 6 to 15 |
| `supabase/functions/generate-ppt/index.ts` | 11 | Change IMAGE_CREDIT_COST from 2 to 5 |
| `supabase/functions/generate-ppt/index.ts` | 1572-1574 | Replace getPublicUrl with createSignedUrl |
| `supabase/functions/generate-ppt/index.ts` | 1588 | Use signedUrl in response |
| `src/pages/Documents.tsx` | 290 | Update "+2 credits" to "+5 credits" |
| `src/pages/Documents.tsx` | 294 | Update "8 : 6" to "20 : 15" credits |

---

## Testing After Implementation

1. Upload a document and generate a PowerPoint
2. Verify the download link works (should not show "Bucket not found")
3. Verify the document viewer opens correctly
4. Confirm credits deducted: 15 without images, 20 with images
