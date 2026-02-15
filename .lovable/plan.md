

# Document Editor Credit System Update and "Fully Wrap Project" Feature

## 1. Credit Cost Updates for Document AI Assistant

The current document-ai-chat edge function uses a simple 3-tier system (edit=1, analysis=2, generation=3). This needs to be replaced with granular, keyword-based detection matching the chat-ai credit costs.

### New Credit Structure

| Action | Current Cost | New Cost |
|--------|-------------|----------|
| Fix Grammar | 1 | 2 |
| Improve Clarity | 1 | 2 |
| Academic Tone | 1 | 2 |
| Summarize | 2 | 4 |
| Extract Key Points | 2 | 4 |
| Write Abstract | 3 | 5 |
| Write Chapter 5 / Conclusion | 3 | 15 |
| Write Introduction (Ch 1) | 3 | 5 |
| Journal Paper | 3 | 20 |
| Research Proposal | (not present) | 20 |
| Literature Review (Ch 2) | 3 | 10 |
| Fully Wrap Project | (new) | 50 |

### Uniformity with Chat AI

These costs are aligned with the chat-ai credit allocations where applicable:
- Chapter 1 / Introduction: 5 credits (matches chat-ai)
- Chapter 2 / Literature Review: 10 credits (matches chat-ai)
- Chapter 5 / Conclusion: 15 credits (user specified this specifically for the document editor)
- Research Proposal / Journal Paper: 20 credits each
- Grammar/Clarity/Academic Tone (edit tasks): 2 credits each
- Summarize / Extract Key Points: 4 credits each
- Write Abstract: 5 credits
- Fully Wrap Project: 50 credits (new, most expensive)

## 2. New Feature: "Fully Wrap Project"

This will be the first quick action shown. It generates all preliminary and end-matter content for a complete academic project:

### What it generates (based on uploaded sample documents):
**Before Chapter 1:**
- Title Page
- Certification Page
- Declaration (if applicable)
- Dedication
- Acknowledgement
- Abstract
- Table of Contents (template)
- List of Tables (template)
- List of Figures (template)

**After Chapter 5:**
- References / Bibliography section
- Appendices section (template)

The AI prompt will instruct the model to analyze the uploaded document's content (which should contain Chapters 1-5) and generate all these wrapper sections with appropriate placeholders for names, dates, supervisors, etc., styled in standard Nigerian university academic format.

---

## Files to Modify

### 1. `supabase/functions/document-ai-chat/index.ts`

**Replace the simple `categorizeRequest` function and flat credit constants** with a granular `determineCreditCost` function that pattern-matches instructions:

- "fully wrap" / "wrap project" / "full project": 50 credits, generation type
- "journal paper" / "research proposal": 20 credits, generation type
- "chapter 5" / "conclusion" / "write chapter 5": 15 credits, generation type
- "chapter 2" / "literature review": 10 credits, generation type
- "chapter 1" / "introduction" / "write abstract": 5 credits, generation/edit type
- "summarize" / "extract key" / "key points": 4 credits, analysis type
- "fix grammar" / "improve clarity" / "academic tone" / "proofread" / "spelling": 2 credits, edit type
- Default custom instruction: 2 credits

**Update the system prompt** to include instructions for the "Fully Wrap Project" task, describing the exact structure of preliminary pages and references based on the uploaded sample documents.

### 2. `src/components/DocumentEditor/AIInstructionInput.tsx`

**Update the `quickActions` array:**
- Add "Fully Wrap Project" as the first action (50 credits, generate category)
- Add "Research Proposal" action (20 credits, generate category)
- Update all existing credit values to match the new costs
- Update the credit info footer text at the bottom

### 3. No database or migration changes needed

Credits are already deducted from existing `daily_credits` and `paid_credits` columns.

---

## Technical Details

### Credit Detection Logic (document-ai-chat)

```text
determineCreditCost(instruction):
  "fully wrap" / "wrap project" / "full project wrap" -> 50cr, generation
  "journal paper" / "convert to journal" -> 20cr, generation
  "research proposal" -> 20cr, generation
  "chapter 5" / "conclusion" / "recommendations" -> 15cr, generation
  "chapter 2" / "literature review" -> 10cr, generation
  "chapter 1" / "introduction chapter" / "write introduction" -> 5cr, generation
  "write abstract" / "abstract" -> 5cr, generation
  "summarize" / "summary" / "extract key" / "key points" / "outline" -> 4cr, analysis
  "fix grammar" / "spelling" / "improve clarity" / "academic tone" / "proofread" / "edit" -> 2cr, edit
  default -> 2cr, generation
```

### Fully Wrap Project AI Prompt Addition

The system prompt will include a special instruction block for "wrap project" requests. Based on the sample documents analyzed, the structure is:

```text
1. TITLE PAGE - Project title, student name, matric number, department, faculty, university, date
2. CERTIFICATION - Supervisor signature block, HOD signature block, External examiner
3. DECLARATION (optional) - Standard reproduction declaration form
4. DEDICATION - Short dedication paragraph
5. ACKNOWLEDGEMENT - Gratitude to God, supervisor, lecturers, family, friends
6. ABSTRACT - 200-300 word summary with keywords
7. TABLE OF CONTENTS - Formatted with page number placeholders
8. LIST OF TABLES - Placeholder entries
9. LIST OF FIGURES - Placeholder entries
--- [Chapters 1-5 from the document] ---
10. REFERENCES - Formatted in APA style based on citations found in the document
11. APPENDICES - Template section
```

The AI will be instructed to use placeholder brackets like [Student Name], [Matric Number], [Supervisor Name], [University Name] etc., and to extract actual names/titles from the document content where possible.

### Quick Actions Array Update (AIInstructionInput.tsx)

The updated array will have 12 actions in this order:
1. Fully Wrap Project (50cr) - NEW, first position
2. Fix Grammar (2cr)
3. Improve Clarity (2cr)
4. Academic Tone (2cr)
5. Summarize (4cr)
6. Extract Key Points (4cr)
7. Write Abstract (5cr)
8. Write Chapter 5 (15cr)
9. Write Introduction (5cr)
10. Research Proposal (20cr) - NEW
11. Journal Paper (20cr)
12. Literature Review (10cr)
