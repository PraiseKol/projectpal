

# Plan: Fix PDF Upload and Enhance Chat Features

## Issues Identified

### 1. PDF Upload Fails in Document Editor
**Root Cause:** The `public/pdf.worker.min.mjs` file is incomplete - it only contains 28 lines (the license header) instead of the full worker code (~180KB). The PDF.js library needs this worker file to process PDF documents.

**Solution:** Replace the incomplete file with the correctly configured worker. Since we can't copy from node_modules directly, we'll configure PDF.js to use the legacy CDN approach with the correct file extension (`.mjs` for version 5.x) as a reliable fallback.

### 2. Chat Names Are Not Intelligent
**Current Behavior:** The `generateTitle` function just truncates the first 35 characters of the user's message.

**Solution:** Use AI to generate a concise, meaningful title (3-5 words) that summarizes the conversation intent. This will be done through a quick API call after the first message.

### 3. Delete Icon Visibility
**Current Behavior:** The delete functionality exists but the icon only appears on hover (`opacity-0 group-hover:opacity-100`).

**Solution:** Make the delete icon always visible (at least on mobile) and ensure the confirmation dialog works smoothly.

---

## Implementation Details

### Fix 1: Correct PDF.js Worker Configuration

**File: `src/pages/DocumentEditor.tsx`**

Replace the local worker path with a properly versioned CDN URL that uses the `.mjs` extension for pdfjs-dist 5.x:

```typescript
// BEFORE (line 35):
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// AFTER - Use unpkg CDN with correct version and extension:
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

**Why unpkg instead of cdnjs?**
- unpkg directly mirrors npm packages, guaranteeing version match
- It uses the correct `.mjs` extension for ES modules in version 5.x
- More reliable than cdnjs which may have version/extension mismatches

Also delete the incomplete `public/pdf.worker.min.mjs` file since it's no longer needed.

### Fix 2: AI-Powered Intelligent Chat Naming

**File: `supabase/functions/chat-ai/index.ts`**

Add a helper function to generate intelligent titles using a quick AI call:

```typescript
async function generateIntelligentTitle(userMessage: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast, cheap model for simple task
        messages: [
          {
            role: 'system',
            content: 'Generate a 3-5 word title that summarizes the user\'s request. Be concise and descriptive. No quotes, no punctuation at the end. Examples: "Research Topic Ideas", "Chapter 2 Literature Review", "APA Citation Help", "Methodology Guidance"'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 20, // Very short response
        temperature: 0.3, // Consistent outputs
      }),
    });

    if (!response.ok) {
      throw new Error('Title generation failed');
    }

    const data = await response.json();
    const title = data.choices[0]?.message?.content?.trim() || '';
    
    // Fallback to truncation if AI fails or returns empty
    if (!title || title.length > 50) {
      return userMessage.substring(0, 35).trim() + (userMessage.length > 35 ? '...' : '');
    }
    
    return title;
  } catch (error) {
    console.error('Title generation error:', error);
    // Fallback to simple truncation
    return userMessage.substring(0, 35).trim() + (userMessage.length > 35 ? '...' : '');
  }
}
```

Modify the main handler to return the generated title in the response:

```typescript
// At end of successful AI response, generate title if first message
const isFirstMessage = (previousMessages?.length || 0) === 0;
let generatedTitle = null;

if (isFirstMessage) {
  generatedTitle = await generateIntelligentTitle(message, LOVABLE_API_KEY);
}

return new Response(
  JSON.stringify({
    response: aiMessage,
    credits_used: creditCost,
    action_type: actionType,
    generated_title: generatedTitle, // NEW: Include AI-generated title
    profile: { ... }
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

**File: `src/pages/Chat.tsx`**

Update the client to use the AI-generated title:

```typescript
// In handleSend, after receiving AI response (around line 346-359):
if (isFirstMessage && sessionId) {
  // Use AI-generated title if available, otherwise fallback to local generation
  const title = data.generated_title || generateTitle(userMessage);
  
  await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId);
  
  setChatSessions(prev => 
    prev.map(s => s.id === sessionId ? { ...s, title } : s)
  );
}
```

Remove the local `generateTitle` function since it's now a fallback handled by the edge function.

### Fix 3: Improve Delete Icon Visibility

**File: `src/pages/Chat.tsx`**

Make delete icon always visible on mobile, show on hover for desktop:

```typescript
// Around line 491-500, update the delete button:
<Button
  variant="ghost"
  size="icon"
  className={`h-8 w-8 shrink-0 mr-1 transition-opacity ${
    isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`}
  onClick={(e) => {
    e.stopPropagation();
    setDeleteSessionId(session.id);
  }}
>
  <Trash2 className="h-4 w-4 text-destructive" />
</Button>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/DocumentEditor.tsx` | Fix PDF.js worker URL to use unpkg CDN with correct version |
| `public/pdf.worker.min.mjs` | **DELETE** - incomplete file no longer needed |
| `supabase/functions/chat-ai/index.ts` | Add `generateIntelligentTitle` function and return title in response |
| `src/pages/Chat.tsx` | Use AI-generated title from response; improve delete icon visibility |

---

## Technical Notes

### PDF.js Worker Loading
- Version 5.x of pdfjs-dist uses `.mjs` ES module files
- unpkg CDN directly mirrors npm, ensuring version consistency
- The worker must match the exact version installed (`5.4.530`)

### Intelligent Title Generation
- Uses the cheapest/fastest model (`gemini-2.5-flash-lite`) for minimal latency
- Does NOT cost extra credits (it's a backend operation, not user-facing)
- Has fallback to simple truncation if AI call fails
- Title generation happens in parallel with the main response

### Delete Button UX
- Mobile: Always visible (touch interfaces need visible targets)
- Desktop: Appears on hover (cleaner interface)
- Confirmation dialog prevents accidental deletion

---

## Testing Checklist

After implementation:
1. Upload a PDF file to Document Editor and verify text extraction works
2. Upload a DOCX file to confirm it still works
3. Start a new chat and send a message - verify the chat gets an intelligent title
4. Verify the delete icon is visible (always on mobile, on hover for desktop)
5. Delete a chat and confirm it's removed from the sidebar
6. Test on mobile to ensure the sidebar and delete functionality work correctly

