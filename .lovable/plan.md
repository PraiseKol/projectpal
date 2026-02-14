

# Intelligent Chat Naming + Limited Chat Display

## What Already Works
The intelligent chat naming system is **already implemented**. The `chat-ai` backend function uses AI (gemini-2.5-flash-lite) to generate a concise 3-5 word title on the first message of each conversation, and the frontend already applies it. No changes needed here.

## What Will Change

### Sidebar: Show Only 3 Recent Chats + "View All"

**File: `src/pages/Chat.tsx`**

1. **Add state for expanded view** -- a new `showAllChats` toggle (default: false)
2. **Limit displayed chats** -- when collapsed, only show the 3 most recent sessions from `chatSessions`
3. **Add "View All" button** -- below the 3 chats, show a "View All (X)" button that expands to show all sessions
4. **Add "Show Less" option** -- when expanded, show a "Show Less" button to collapse back to 3

### Technical Details

- Add `const [showAllChats, setShowAllChats] = useState(false);` state
- Create `const displayedSessions = showAllChats ? chatSessions : chatSessions.slice(0, 3);`
- Replace `chatSessions.map(...)` with `displayedSessions.map(...)` in the sidebar rendering
- Add a toggle button after the chat list:
  - When collapsed and more than 3 chats exist: "View All (N total)" button
  - When expanded: "Show Less" button
- The full list of 20 sessions is still loaded from the database (no backend change needed)
