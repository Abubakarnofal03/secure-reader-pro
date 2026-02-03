

# PDF Reader Notes and Highlighting Feature

## Overview

Add two new features to the PDF reader:
1. **Notes System** - Allow users to add personal notes organized by page number
2. **Text Highlighting** - Visual highlighting of text regions (without actual text selection due to security constraints)

## Current Architecture Analysis

The PDF reader uses several important patterns:
- **Virtualized rendering** with @tanstack/react-virtual for performance
- **Segmented PDF loading** for large documents (50-page chunks)
- **Security constraints**: Text selection is disabled via CSS (`user-select: none`, `pointer-events: none` on text layer) and JavaScript event handlers block copy/paste
- **User data model**: Uses `reading_progress` table pattern with `user_id`, `content_id` for per-user content data

## Technical Approach

### 1. Notes Feature

**Database Design**
- New `user_notes` table to store notes per user/content/page
- Columns: `id`, `user_id`, `content_id`, `page_number`, `note_text`, `created_at`, `updated_at`
- RLS policies for user-only access

**UI Components**
- **NotesPanel** - A sheet/drawer accessible from the reader header showing all notes
- **AddNoteDialog** - Modal to add/edit notes for the current page
- **PageNotes indicator** - Small icon on pages that have notes

**Integration Points**
- Add notes icon button to reader header (next to TOC button)
- Notes panel slides in from right (similar to TOC which slides from left)
- Quick-add floating button on current page

### 2. Highlighting Feature

Since text selection is disabled for security, we'll implement a **visual overlay system**:

**How It Works**
- User taps a "Highlight Mode" toggle in the header
- In highlight mode, user can tap-and-drag to draw rectangular highlight regions on pages
- Highlights are stored as coordinates relative to page dimensions (percentage-based for zoom compatibility)
- Highlights render as semi-transparent colored overlays on top of the PDF canvas

**Database Design**
- New `user_highlights` table
- Columns: `id`, `user_id`, `content_id`, `page_number`, `x_percent`, `y_percent`, `width_percent`, `height_percent`, `color`, `created_at`
- RLS policies for user-only access

**UI Components**
- **HighlightLayer** - Overlay component rendered on each page showing saved highlights
- **HighlightModeToggle** - Header button to enter/exit highlight mode
- **ColorPicker** - Small popover to choose highlight color (yellow, green, blue, pink)

**Key Technical Considerations**
- Highlights stored as percentages to scale correctly with zoom
- Touch/mouse drag handling for drawing regions
- Highlight mode temporarily disables scroll to allow drawing

---

## Implementation Plan

### Phase 1: Database Setup

Create two new tables with appropriate RLS:

```text
+------------------+     +--------------------+
|   user_notes     |     |  user_highlights   |
+------------------+     +--------------------+
| id (uuid, PK)    |     | id (uuid, PK)      |
| user_id (uuid)   |     | user_id (uuid)     |
| content_id (uuid)|     | content_id (uuid)  |
| page_number (int)|     | page_number (int)  |
| note_text (text) |     | x_percent (float)  |
| created_at       |     | y_percent (float)  |
| updated_at       |     | width_percent (flt)|
+------------------+     | height_percent     |
                         | color (text)       |
                         | created_at         |
                         +--------------------+
```

### Phase 2: Notes Implementation

1. **Create `useUserNotes` hook**
   - Fetch notes for current content
   - CRUD operations (add, edit, delete notes)
   - Organize by page number

2. **Create UI components**
   - `NotesPanel.tsx` - Side drawer with list of all notes grouped by page
   - `AddNoteDialog.tsx` - Modal for adding/editing notes
   - `NoteIndicator.tsx` - Small badge shown on pages with notes

3. **Integrate into SecureReaderScreen**
   - Add notes button to header
   - Pass note data to VirtualizedPdfViewer for indicators

### Phase 3: Highlighting Implementation

1. **Create `useUserHighlights` hook**
   - Fetch highlights for current content
   - Save new highlights
   - Delete highlights

2. **Create UI components**
   - `HighlightOverlay.tsx` - Renders colored rectangles on pages
   - `HighlightModeController.tsx` - Manages draw mode, touch handling
   - `HighlightColorPicker.tsx` - Color selection UI

3. **Integrate into VirtualizedPdfViewer**
   - Add highlight overlay layer to each page
   - Handle touch/mouse events for drawing when in highlight mode

### Phase 4: Polish and UX

- Smooth animations for panels and dialogs
- Haptic feedback on mobile for highlight creation
- Undo functionality for accidental highlights
- Export notes feature (optional future enhancement)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useUserNotes.ts` | Notes CRUD hook |
| `src/hooks/useUserHighlights.ts` | Highlights CRUD hook |
| `src/components/reader/NotesPanel.tsx` | Notes sidebar panel |
| `src/components/reader/AddNoteDialog.tsx` | Add/edit note modal |
| `src/components/reader/NoteIndicator.tsx` | Page note badge |
| `src/components/reader/HighlightOverlay.tsx` | Highlight rendering |
| `src/components/reader/HighlightModeController.tsx` | Draw mode management |
| `src/components/reader/HighlightColorPicker.tsx` | Color selection |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/SecureReaderScreen.tsx` | Add notes/highlight buttons, integrate new hooks |
| `src/components/reader/VirtualizedPdfViewer.tsx` | Add highlight overlay layer to pages |
| `src/components/reader/SegmentedPdfPage` | Render highlight overlays and note indicators |
| `src/components/reader/LegacyPdfPage` | Same additions for legacy mode |

---

## Technical Details

### Security Considerations
- Notes and highlights are user-specific (RLS enforced)
- No access to actual PDF text content (respects existing security)
- Highlights are visual overlays, not text-based annotations

### Performance Considerations
- Lazy load notes/highlights per visible segment
- Debounce save operations
- Minimal re-renders using memo patterns consistent with existing code

### Mobile UX
- Large touch targets for highlight drawing
- Swipe gestures for notes panel
- Responsive layouts for both features

