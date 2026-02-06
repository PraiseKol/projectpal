

# Plan: Add PDF Support to PowerPoint Generator

## Problem Summary

The PowerPoint Generator edge function (`generate-ppt`) currently rejects PDF files with a "PDF extraction is temporarily unavailable" error. Users can only upload DOCX files, which is limiting.

**Note:** The Document Editor already supports PDF uploads using client-side extraction with `pdfjs-dist` - no changes needed there.

---

## Solution Overview

Use Gemini's multimodal capabilities to extract text from PDF documents server-side. Gemini can directly read PDF files when sent as base64-encoded `file_data`, making it ideal for this use case.

---

## Implementation Details

### File: `supabase/functions/generate-ppt/index.ts`

**1. Add PDF Text Extraction Function**

Create a new helper function that sends the PDF to Gemini for comprehensive text extraction:

```typescript
async function extractPdfTextWithGemini(
  pdfArrayBuffer: ArrayBuffer, 
  apiKey: string
): Promise<string> {
  const base64Data = uint8ToBase64(new Uint8Array(pdfArrayBuffer));
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: `data:application/pdf;base64,${base64Data}`,
              },
            },
            {
              type: 'text',
              text: `Extract ALL text content from this PDF document. Include:
- All headings and subheadings
- All body text and paragraphs  
- All bullet points and numbered lists
- All table data (as text)
- All figure captions
- References and citations

Return ONLY the extracted text content, preserving the document structure with appropriate line breaks. Do not add any commentary.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`PDF extraction failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
```

**2. Update Document Processing Logic (around lines 1552-1558)**

Replace the PDF rejection block with actual extraction:

```typescript
} else if (contentType.includes('pdf')) {
  console.log('[PPT] Processing PDF document...');
  const arrayBuffer = await docResponse.arrayBuffer();
  console.log(`[PPT] PDF size: ${arrayBuffer.byteLength} bytes`);
  
  try {
    docContent = await extractPdfTextWithGemini(arrayBuffer, LOVABLE_API_KEY);
    docContent = docContent.substring(0, 60000); // Limit for AI processing
    console.log(`[PPT] Extracted ${docContent.length} characters from PDF via Gemini`);
    
    // Extract title from first line
    const titleMatch = docContent.match(/^(?:#?\s*)?(.+?)[\n\r]/);
    if (titleMatch) {
      documentTitle = titleMatch[1].replace(/[#*]/g, '').trim().substring(0, 100);
    }
  } catch (err) {
    console.error('[PPT] PDF extraction error:', err);
    throw new Error('Failed to extract text from PDF. The file may be corrupted or image-only. Please try a different file or use DOCX format.');
  }
}
```

---

## How It Works

```text
+------------------+       +-------------------+       +------------------+
|  User uploads    |  -->  |  Edge Function    |  -->  |  Gemini extracts |
|  PDF document    |       |  receives binary  |       |  text from PDF   |
+------------------+       +-------------------+       +------------------+
                                    |
                                    v
                          +-------------------+
                          |  AI generates     |
                          |  slide structure  |
                          +-------------------+
                                    |
                                    v
                          +-------------------+
                          |  PPTX created     |
                          |  and returned     |
                          +-------------------+
```

---

## Technical Notes

### Why Gemini for PDF Extraction?
- Gemini has native PDF understanding through its multimodal capabilities
- No need for additional Deno-compatible PDF parsing libraries
- Handles complex layouts, tables, and multi-column text
- Works with both text-based and OCR-able scanned PDFs

### Limitations to Communicate to Users
- Very large PDFs (>50 pages) may have content truncated
- Image-only scanned PDFs without OCR text may have limited extraction
- Complex charts/graphs will be described textually

### Credit Usage
- PDF extraction uses one additional AI call, but this is absorbed in the existing credit cost (15-20 credits)
- No change to pricing needed

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-ppt/index.ts` | Add `extractPdfTextWithGemini` function; Replace PDF rejection block with extraction logic |

---

## Testing Checklist

After implementation:
1. Upload a text-based PDF and verify extraction quality
2. Upload a DOCX file and confirm it still works
3. Verify the generated PowerPoint has actual document content
4. Test with a large PDF to ensure truncation works gracefully
5. Check credit deduction is correct (15 or 20 credits)

