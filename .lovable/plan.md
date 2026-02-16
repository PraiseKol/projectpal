

# Two-Tier Credit System for Questionnaire AI Assistant

## Overview

Restructure the AI Assistant flow into two phases:
1. **Chat phase** (2 credits/message): The AI asks the user clarifying questions about their questionnaire needs (topic, audience, question types, sections, etc.) without generating a questionnaire.
2. **Build phase** (5 credits): Once the user is satisfied with the discussion, they click a "Build Questionnaire" button that the AI presents. Only then does the AI generate the actual questionnaire JSON and charge 5 credits.

## Changes

### 1. Edge Function: `supabase/functions/questionnaire-ai/index.ts`

- Accept a new field `mode` in the request body: `"chat"` (default) or `"build"`
- **Chat mode** (`CREDIT_COST = 2`): Update the system prompt to instruct the AI to NEVER include `|||QUESTIONNAIRE_JSON|||` -- it should only ask questions, discuss structure, and guide the user. The AI should cover: research topic, target audience, number of sections, question types preferred, scale preferences, etc.
- **Build mode** (`CREDIT_COST = 5`): Use the current system prompt that instructs the AI to generate the full questionnaire JSON. The AI receives the full chat history for context.
- The credit deduction logic stays the same, just uses a different cost depending on `mode`.

### 2. Frontend: `src/components/Questionnaire/QuestionnaireChat.tsx`

- Add a `readyToBuild` state that tracks whether the user has had enough conversation (at least 2 messages exchanged)
- After a few chat exchanges, show a prominent **"Build Questionnaire (5 credits)"** button above the input area
- When clicked, the button sends one final request with `mode: "build"` which tells the backend to generate the questionnaire
- Update the info text to explain the two-phase pricing: "Chat messages cost 2 credits. Building the questionnaire costs 5 credits."
- The suggestion chips stay but are reworded to be conversation starters rather than direct generation requests
- When the build response comes back with `data.questionnaire`, call `onQuestionnaireGenerated` as before

### 3. System Prompt Changes (inside edge function)

**Chat mode prompt** (new):
- "You are a questionnaire design assistant. Your job is to help users plan their questionnaire by asking clarifying questions. Do NOT generate any questionnaire yet. Ask about: research topic/purpose, target audience, preferred question types, number of sections, any specific questions they want included, rating scale preferences, etc. Be conversational and thorough. Once you feel you have enough information, tell the user they can click the 'Build Questionnaire' button when ready."

**Build mode prompt** (existing, slightly tweaked):
- Keep the current prompt that includes `|||QUESTIONNAIRE_JSON|||` instructions
- Add: "Based on the entire conversation, generate the complete questionnaire now."

## Detailed File Changes

### `supabase/functions/questionnaire-ai/index.ts`
- Line 9: Change `CREDIT_COST = 5` to determine cost dynamically based on mode
- Line 49: Extract `mode` from request body alongside `message`, `history`, `currentQuestionnaire`
- Add: `const CREDIT_COST = mode === 'build' ? 5 : 2;`
- Lines 119-159: Split into two prompts based on mode (chat vs build)
- Everything else (credit logic, deduction, response) stays the same

### `src/components/Questionnaire/QuestionnaireChat.tsx`
- Add state: `const [isBuilding, setIsBuilding] = useState(false)`
- Update `sendMessage` to accept an optional `mode` parameter (default `"chat"`)
- Add `mode` to the fetch body: `body: JSON.stringify({ message, history, currentQuestionnaire, mode })`
- Add a `handleBuild` function that calls `sendMessage("Generate my questionnaire based on our discussion", "build")`
- Show the "Build Questionnaire" button when `messages.length >= 2` (at least one exchange)
- Update info text: "Chat costs 2 credits/message. Building costs 5 credits."
- The build button should show a loading state while building

### No changes needed to `questionnaire-export` (that gates PDF/DOCX download separately)

## User Flow

```
1. User opens AI Assistant tab
2. Sees: "Chat with the AI to plan your questionnaire (2 credits/msg). 
   When ready, click Build (5 credits) to generate it."
3. User describes their needs -> AI asks clarifying questions (2 credits each)
4. After a few exchanges, a "Build Questionnaire" button appears
5. User clicks "Build Questionnaire" -> AI generates the full questionnaire (5 credits)
6. Questionnaire populates Builder tab
7. User can then export to PDF/DOCX (5 credits per export via questionnaire-export)
```

