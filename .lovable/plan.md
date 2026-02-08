

# Plan: Fix PDF Upload and Add Tabbed Results View in Document Editor

## Problem Summary

1. **PDF Upload Fails**: The PDF.js worker configuration uses a CDN URL with version mismatch issues. The current config uses `.js` extension but pdfjs-dist 5.4.530 uses `.mjs` files.

2. **No Dedicated Results View**: Generated AI content (chapters, papers, summaries) is currently shown in the left panel. Users want a proper tabbed interface on the right side to switch between their uploaded document and generated results.

---

## Solution Overview

### Fix 1: Correct PDF.js Worker Configuration

Copy the PDF worker file to the `public` folder and update the worker source path to use a stable local file instead of CDN.

### Fix 2: Tabbed Document/Results Interface

Add a tabbed interface on the right panel with:
- **Document Tab**: The editable document content (current view)
- **Results Tab**: AI-generated content with proper markdown rendering

---

## Implementation Details

### 1. Copy PDF Worker to Public Folder

**File: `public/pdf.worker.min.mjs`**

Copy from `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/` folder.

This ensures version consistency and eliminates CDN issues.

### 2. Update PDF.js Worker Configuration

**File: `src/pages/DocumentEditor.tsx`**

```typescript
// BEFORE (line 30):
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// AFTER:
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

This uses the local worker file from the public folder, ensuring version consistency.

### 3. Add Enhanced Error Handling for PDF Extraction

**File: `src/pages/DocumentEditor.tsx`**

Improve the `extractPdfText` function with better error handling:

```typescript
const extractPdfText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const totalPages = Math.min(pdf.numPages, 100); // Limit to 100 pages
    
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the file is not corrupted.');
  }
};
```

### 4. Create Tabbed Interface on Right Panel

**File: `src/pages/DocumentEditor.tsx`**

Replace the current right panel (just a document editor) with a tabbed interface:

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

// In the component, track active tab
const [activeTab, setActiveTab] = useState<"document" | "results">("document");

// Auto-switch to results tab when content is generated
useEffect(() => {
  if (generatedContent) {
    setActiveTab("results");
  }
}, [generatedContent]);
```

**Updated Right Panel JSX:**

```tsx
{/* Right: Document Editor with Tabs */}
<div className="lg:order-2 order-1">
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {currentDocument.file_name}
          </CardTitle>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardHeader>
    
    <CardContent className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "document" | "results")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="document" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Results
            {generatedContent && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">New</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        {/* Document Tab */}
        <TabsContent value="document" className="mt-4">
          <Textarea
            value={editableContent}
            onChange={(e) => setEditableContent(e.target.value)}
            className="min-h-[350px] sm:min-h-[450px] font-mono text-sm"
            placeholder="Your document content will appear here..."
          />
        </TabsContent>
        
        {/* Results Tab */}
        <TabsContent value="results" className="mt-4">
          {generatedContent ? (
            <div className="space-y-4">
              <ScrollArea className="h-[350px] sm:h-[450px] border border-border rounded-lg p-4">
                <MarkdownRenderer 
                  content={generatedContent} 
                  className="prose-sm dark:prose-invert"
                />
              </ScrollArea>
              
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedContent);
                    toast.success("Copied to clipboard!");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button onClick={handleInsertContent}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Insert into Document
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[350px] sm:h-[450px] text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Generated content will appear here
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Use the AI Assistant to generate chapters, papers, summaries, and more
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Export buttons - always visible */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button variant="outline" onClick={exportAsDocx} disabled={isExporting || !editableContent}>
          <Download className="h-4 w-4 mr-2" />
          DOCX
        </Button>
        <Button variant="outline" onClick={exportAsPdf} disabled={isExporting || !editableContent}>
          <Download className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
```

### 5. Update Insert Content Handler

Modify the `handleInsertContent` function to switch back to document tab after inserting:

```typescript
const handleInsertContent = (content: string) => {
  setEditableContent(prev => prev + "\n\n" + content);
  setGeneratedContent("");
  setActiveTab("document");
  toast.success("Content inserted into document!");
};
```

### 6. Remove Duplicate Generated Content Display from SuggestionsPanel

Update `SuggestionsPanel.tsx` to only show edit suggestions since generated content now has its own tab:

```typescript
// In SuggestionsPanel, remove the generatedContent display block
// Only keep the suggestions functionality
```

---

## Architecture Diagram

```text
+----------------------------------+    +----------------------------------+
|         LEFT PANEL               |    |          RIGHT PANEL             |
+----------------------------------+    +----------------------------------+
|                                  |    |  +----------------------------+  |
|  +---------------------------+   |    |  | [Document] | [Results ●]   |  |
|  |     AI Assistant          |   |    |  +----------------------------+  |
|  |                           |   |    |                                  |
|  |  Quick Actions:           |   |    |  +----------------------------+  |
|  |  [Grammar] [Summarize]... |   |    |  |                            |  |
|  |                           |   |    |  |  Document Tab:             |  |
|  |  Custom Instruction:      |   |    |  |  - Editable textarea       |  |
|  |  [__________________]     |   |    |  |  - Raw document content    |  |
|  |                           |   |    |  |                            |  |
|  +---------------------------+   |    |  |  Results Tab:              |  |
|                                  |    |  |  - Markdown rendered       |  |
|  +---------------------------+   |    |  |  - Copy/Insert buttons     |  |
|  |   Edit Suggestions        |   |    |  |                            |  |
|  |   (if any)                |   |    |  +----------------------------+  |
|  +---------------------------+   |    |                                  |
|                                  |    |  [Export DOCX] [Export PDF]      |
+----------------------------------+    +----------------------------------+
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `public/pdf.worker.min.mjs` | **NEW** - Copy PDF.js worker from node_modules |
| `src/pages/DocumentEditor.tsx` | Fix worker config, add Tabs interface, update handlers |
| `src/components/DocumentEditor/SuggestionsPanel.tsx` | Remove generated content display (moved to Results tab) |

---

## Testing Checklist

After implementation:
1. Upload a PDF file and verify text extraction works
2. Upload a DOCX file and confirm it still works
3. Use AI to generate content (e.g., "Write Chapter 5")
4. Verify the Results tab appears with markdown-rendered content
5. Test Copy and Insert buttons work correctly
6. Verify switching between Document and Results tabs
7. Test export functionality still works

---

## Technical Notes

### Why Copy Worker to Public Folder?
- Eliminates version mismatch issues with CDN
- Ensures consistent behavior across deployments
- Avoids Vite's asset hashing that can break worker loading
- Best practice recommended by pdf.js maintainers

### Markdown Rendering
Using the existing `MarkdownRenderer` component ensures:
- Proper heading styles
- Code block formatting
- Table rendering
- List formatting
- Consistent dark/light theme support

