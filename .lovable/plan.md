
# Fix Rating Scale Display in Questionnaire Preview

## Problem

The rating scale section in `QuestionnairePreview.tsx` (lines 78-82) contains a literal `...` placeholder instead of actual rendering code. This is why all rating scale questions show "..." in the preview.

## Fix

Replace the empty rating scale block with a proper scale UI that:
- Uses the `getScaleLabels()` helper (already imported) to get the 5 labels based on the question's `scaleDirection`
- Defaults to `1to5` if no direction is set
- Renders a horizontal row of 5 columns, each with a number, an empty radio circle, and a label underneath

## File to Modify

**`src/components/Questionnaire/QuestionnairePreview.tsx`** (lines 78-82)

Replace:
```tsx
{q.type === "rating_scale" && (
  <div className="overflow-x-auto">
...
  </div>
)}
```

With a proper scale table rendering:
- A flex/grid row with 5 evenly spaced columns
- Each column shows: the scale number (1-5), an empty circle, and the label (e.g., "Very Poor", "Poor", "Average", "Good", "Very Good")
- Uses `getScaleLabels(q.scaleDirection || '1to5')` to get the correct order
- Wrapped in `overflow-x-auto` for mobile responsiveness

No other files need changes.
