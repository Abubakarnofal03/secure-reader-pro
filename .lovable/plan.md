

# News/Highlights/Blogs Feature

## Overview

Add a new "Highlights" section to the app that allows admins to publish news, blogs, and announcements. This content will be managed through the admin panel with a rich text editor and displayed to users in a dedicated, lazy-loaded section accessible from the main library screen.

## Architecture

### User Flow

```text
+------------------+     +-------------------+     +------------------+
|   Library Tab    |     |   Highlights Tab  |     |    Article View  |
|  Navigation Bar  | --> |   (Lazy Loaded)   | --> |   Full Content   |
| Library | Store  |     |   List of Posts   |     |   with Rich Text |
|  | Highlights    |     |   Cards/Preview   |     |                  |
+------------------+     +-------------------+     +------------------+
```

### Admin Flow

```text
+------------------+     +-------------------+     +------------------+
|   Admin Panel    |     |   Posts Tab       |     |   Post Editor    |
|   New Tab: Posts | --> |   Create/Edit     | --> |   Rich Text      |
|                  |     |   List of Posts   |     |   WYSIWYG Editor |
+------------------+     +-------------------+     +------------------+
```

## Database Schema

New table: `posts`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier |
| title | text | Post title |
| content | text | Rich text HTML content |
| excerpt | text | Short preview text (150 chars) |
| cover_image_url | text | Optional cover image |
| category | text | 'news', 'blog', 'highlight' |
| is_published | boolean | Draft vs published |
| published_at | timestamp | When it was published |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |
| author_id | uuid | Admin who created it |

RLS Policies:
- SELECT: Everyone can read published posts (`is_published = true`)
- INSERT/UPDATE/DELETE: Only admins (using `is_admin(auth.uid())`)

## Implementation Plan

### Phase 1: Database Setup

1. Create `posts` table with the schema above
2. Add RLS policies for public read access to published posts and admin-only write access
3. Create storage bucket for post cover images (public bucket)

### Phase 2: Admin Panel - Post Management

1. **Add new "Posts" tab to AdminScreen**
   - Add newspaper icon tab between Content and Approvals
   - 5 columns in tab list

2. **Create `PostEditor.tsx` component**
   - Rich text editor using Tiptap (industry-standard, works well with React)
   - Toolbar with formatting options: Bold, Italic, Underline, Headings (H1-H3), Lists (bullet/numbered), Links, Blockquotes
   - Cover image upload option
   - Title input field
   - Category selector (News, Blog, Highlight)
   - Excerpt field (auto-generated or manual)
   - Publish/Save Draft toggle

3. **Create `PostList.tsx` component**
   - List of all posts (drafts and published)
   - Status badges (Draft/Published)
   - Edit/Delete actions
   - Quick publish toggle

4. **Create `usePostManagement.ts` hook**
   - CRUD operations for posts
   - Cover image upload to storage

### Phase 3: Client-Side - Highlights Section

1. **Add "Highlights" tab to ContentListScreen**
   - Third tab alongside Library and Store
   - Uses same navigation pattern with underline indicator

2. **Create `HighlightsSection.tsx` component (lazy loaded)**
   - Use `React.lazy()` and `Suspense` for code splitting
   - Only fetches posts when tab is first opened
   - Shows loading skeleton while loading

3. **Create `PostCard.tsx` component**
   - Card layout with cover image, title, excerpt, date
   - Category badge
   - Tap to open full view

4. **Create `PostViewDialog.tsx` component**
   - Full-screen sheet/dialog showing complete post
   - Renders HTML content safely
   - Back button to return to list

5. **Create `usePublishedPosts.ts` hook**
   - Fetches published posts ordered by published_at
   - Lazy loading pattern (only loads when needed)

### Phase 4: Rich Text Editor Setup

Install Tiptap dependencies:
- `@tiptap/react`
- `@tiptap/starter-kit` (includes Bold, Italic, Headings, Lists, etc.)
- `@tiptap/extension-link`
- `@tiptap/extension-underline`
- `@tiptap/extension-placeholder`

Create reusable `RichTextEditor.tsx` component with:
- Toolbar with formatting buttons
- Editor content area
- HTML output for saving
- Matches app's design system

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/PostEditor.tsx` | Rich text editor for creating/editing posts |
| `src/components/admin/PostList.tsx` | List of all posts in admin |
| `src/components/admin/RichTextEditor.tsx` | Reusable Tiptap editor component |
| `src/components/admin/EditorToolbar.tsx` | Toolbar for rich text editor |
| `src/components/highlights/HighlightsSection.tsx` | Lazy-loaded highlights tab content |
| `src/components/highlights/PostCard.tsx` | Post preview card |
| `src/components/highlights/PostViewDialog.tsx` | Full post view dialog |
| `src/hooks/usePostManagement.ts` | Admin CRUD hook for posts |
| `src/hooks/usePublishedPosts.ts` | Client-side posts fetching hook |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/AdminScreen.tsx` | Add Posts tab |
| `src/pages/ContentListScreen.tsx` | Add Highlights tab with lazy loading |

---

## Technical Details

### Lazy Loading Pattern

```text
ContentListScreen.tsx
       |
       v
  TabType = 'my-books' | 'store' | 'highlights'
       |
       v
  When highlights tab selected:
       |
       v
  React.lazy(() => import('./HighlightsSection'))
       |
       v
  Suspense with loading skeleton
       |
       v
  HighlightsSection fetches posts only when mounted
```

### Security Considerations
- Rich text content stored as HTML
- Render using `dangerouslySetInnerHTML` with controlled input (admin-only content creation)
- Cover images stored in public storage bucket
- RLS ensures only admins can create/modify posts

### Performance Benefits
- Lazy loading prevents unnecessary network requests on app start
- Code splitting reduces initial bundle size
- Posts only fetched when user navigates to Highlights tab

### Dependencies to Add
- `@tiptap/react` - Core Tiptap React integration
- `@tiptap/starter-kit` - Basic formatting extensions
- `@tiptap/extension-link` - Link support
- `@tiptap/extension-underline` - Underline support
- `@tiptap/extension-placeholder` - Placeholder text

