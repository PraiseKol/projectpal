
# Add Multiple Choice Question Type and Update Sample Template

## Summary

Two changes are needed:
1. Add a new **"Multiple Choice"** question type so users can define a list of selectable options (e.g., "What is your age range?" with options like "16-20", "21-24", etc.)
2. Replace the generic sample template with a comprehensive **ProjectPal User Experience Survey**

## What Changes

### 1. New "Multiple Choice" Question Type

A new `multiple_choice` type will be added to the questionnaire system. Each multiple choice question will have an `options` array of strings that the user can define in the Builder.

**How it works in the Builder:**
- When "Multiple Choice" is selected as the response type, an options editor appears below
- Users can add/remove individual options using text inputs with + and trash buttons
- New options start with a blank input; there's always at least 2 options

**How it looks in Preview:**
- Each option is shown as a radio-button-style circle with the option text beside it

**How it exports (PDF and DOCX):**
- Options rendered as a vertical list with empty circles, matching the existing Yes/No style

### 2. Updated Sample Template

The "Sample" button will load a **ProjectPal User Experience Survey** with 5 sections and approximately 20 questions covering:

- **Demographics** -- age range (multiple choice), education level (multiple choice), field of study (short text)
- **Platform Usage** -- how long using ProjectPal (multiple choice), which features used (multiple choice), frequency of use (multiple choice)
- **Feature Satisfaction** -- rating scales for AI Chat, Document Editor, PPT Generator, Data Analysis, Questionnaire Builder, Paraphraser
- **Usability and Support** -- ease of navigation (rating), encountered issues (yes/no), describe issues (long text), customer support rating
- **Overall Experience** -- overall satisfaction (rating), recommend to others (yes/no), what you like most (long text), suggestions (long text)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Questionnaire/types.ts` | Add `multiple_choice` to `QuestionType`, add `options?: string[]` to `Question` interface |
| `src/components/Questionnaire/QuestionCard.tsx` | Add options editor UI when type is `multiple_choice` |
| `src/components/Questionnaire/QuestionnairePreview.tsx` | Render multiple choice options with radio circles |
| `src/components/Questionnaire/QuestionnaireExport.tsx` | Add PDF and DOCX rendering for multiple choice |
| `src/components/Questionnaire/SampleTemplate.ts` | Replace with ProjectPal survey using all question types including multiple choice |
| `supabase/functions/questionnaire-ai/index.ts` | Update system prompt to include `multiple_choice` type with `options` array |

## Technical Details

### types.ts
- `QuestionType` union adds `'multiple_choice'`
- `Question` interface gets `options?: string[]`
- `createEmptyQuestion` remains `short_text` by default (no change needed)

### QuestionCard.tsx
- When `question.type === 'multiple_choice'`, render below the type selector:
  - A list of `Input` fields for each option, each with a delete button
  - An "Add Option" button
  - Default to 2 empty options when switching to this type
- On type change to `multiple_choice`, auto-set `options: ['', '']` if not already present

### QuestionnairePreview.tsx
- New rendering block for `multiple_choice`:
  - Vertical list of options, each with an empty circle and the option text

### QuestionnaireExport.tsx (PDF)
- For `multiple_choice`: render each option as a circle + text line (similar to yes/no but vertical list)

### QuestionnaireExport.tsx (DOCX)
- For `multiple_choice`: render each option as a paragraph with "○  Option text"

### questionnaire-ai/index.ts
- Update the JSON schema in the system prompt to include:
  - `"type": "yes_no" | "short_text" | "long_text" | "rating_scale" | "multiple_choice"`
  - `"options": ["string array"] (required for multiple_choice type)`

### SampleTemplate.ts
The full replacement survey content:

**Section 1: Demographics**
- What is your age range? (multiple_choice: Under 16, 16-20, 21-24, 25-30, 31-40, 41+)
- What is your highest level of education? (multiple_choice: Secondary School, Undergraduate, Postgraduate, Doctorate, Other)
- What is your field of study or work? (short_text)

**Section 2: Platform Usage**
- How long have you been using ProjectPal? (multiple_choice: Less than 1 month, 1-3 months, 3-6 months, 6-12 months, Over 1 year)
- Which ProjectPal features have you used? (multiple_choice: AI Chat Assistant, Document Editor, PPT Generator, Data Analysis, Questionnaire Builder, Paraphraser)
- How often do you use ProjectPal? (multiple_choice: Daily, Several times a week, Weekly, Monthly, Rarely)

**Section 3: Feature Satisfaction**
- Rate the AI Chat Assistant (rating_scale 1to5)
- Rate the Document Editor (rating_scale 1to5)
- Rate the PPT Generator (rating_scale 1to5)
- Rate the Data Analysis tool (rating_scale 1to5)
- Rate the Questionnaire Builder (rating_scale 1to5)
- Rate the Paraphraser tool (rating_scale 1to5)

**Section 4: Usability and Support**
- How easy is it to navigate the platform? (rating_scale 1to5)
- Have you encountered any technical issues? (yes_no)
- If yes, please describe the issues (long_text)
- How would you rate the customer support experience? (rating_scale 1to5)

**Section 5: Overall Experience and Recommendations**
- How satisfied are you with ProjectPal overall? (rating_scale 1to5)
- Would you recommend ProjectPal to a colleague or friend? (yes_no)
- What do you like most about ProjectPal? (long_text)
- What improvements or new features would you suggest? (long_text)
