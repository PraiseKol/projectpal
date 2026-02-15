

# AI Chat Tab for Questionnaire Builder

## Overview

Add a new "AI Assistant" tab to the left of "Builder" in the Questionnaire Builder. Users can chat with AI to describe the questionnaire they want, and the AI generates the full questionnaire structure which populates the Builder and Preview tabs.

## How It Works

1. User opens the "AI Assistant" tab and describes their questionnaire (e.g., "Create a 20-question customer satisfaction survey with sections on service quality, product feedback, and demographics")
2. AI responds with a conversational message AND generates a structured questionnaire
3. The generated questionnaire automatically loads into the Builder tab
4. User can continue chatting to refine (e.g., "Add a section about pricing" or "Change question 5 to a rating scale")
5. User can switch to Builder to manually tweak, or Preview to see the result

## New Files

### 1. Edge Function: `supabase/functions/questionnaire-ai/index.ts`
- Accepts `{ message, history, currentQuestionnaire }` 
- Uses `google/gemini-2.5-flash` via Lovable AI gateway
- System prompt instructs AI to respond with TWO parts:
  - A conversational message to the user
  - A JSON block containing the full `QuestionnaireData` structure
- Parses out the JSON from the response and returns both `{ reply, questionnaire }`
- Credit cost: 2 credits per message (same as generation/suggestion tier)
- Handles auth, credit deduction (daily -> paid for subscribers, daily from monthly for free)

### 2. Component: `src/components/Questionnaire/QuestionnaireChat.tsx`
- Chat interface with message history (stored in local component state, not DB)
- ScrollArea for messages, input at bottom with send button
- Messages rendered with markdown support
- Loading state with animated dots while AI responds
- When AI returns a questionnaire, calls `onQuestionnaireGenerated(data)` callback
- Shows a small toast/badge when questionnaire is updated from AI
- Displays credit cost info (2 credits per message)

## Modified Files

### 3. `src/pages/QuestionnaireBuilder.tsx`
- Add "AI Assistant" tab with `MessageSquare` icon to the LEFT of "Builder"
- Tab order: AI Assistant | Builder | Preview
- Pass `data` and `setData` to the chat component so AI output populates the builder
- When AI generates a questionnaire, auto-switch to "builder" tab briefly or show a notification

## Technical Details

### Edge Function System Prompt Strategy

The AI is instructed to always include a `|||QUESTIONNAIRE_JSON|||` delimiter followed by valid JSON matching the `QuestionnaireData` type. The function parses this out. If the user is just asking a question (not requesting generation), the AI can omit the JSON block.

```text
QuestionnaireData format:
{
  title: string,
  subtitle?: string,
  introText?: string,
  sections: [{
    id: string (UUID),
    title: string,
    description?: string,
    questions: [{
      id: string (UUID),
      text: string,
      helperText?: string,
      type: "yes_no" | "short_text" | "long_text" | "rating_scale",
      scaleDirection?: "1to5" | "5to1"
    }]
  }]
}
```

### Credit Handling
- Cost: 2 credits per AI message
- Uses same pattern as `chat-ai`: check profile, determine if active subscriber, deduct from daily -> paid (or daily from monthly for free users)
- Returns updated credit info in the response

### Chat Component Layout
- Full height of the tab content area
- Messages list with user bubbles (right) and AI bubbles (left)
- Sticky input bar at bottom
- "Generate Questionnaire" suggestion chips for common templates (optional quick actions)

### No Database Storage
- Chat messages are kept in component state only (not persisted to DB)
- This keeps it lightweight -- the questionnaire data itself is already saved to localStorage

