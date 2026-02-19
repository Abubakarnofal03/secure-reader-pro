

# Size-Gated Downloads and Persistent Offline Storage

## Overview
Large PDFs (100-200MB) are extremely slow to render on-the-fly via signed URLs. This plan introduces a size threshold: small PDFs can be read directly (download optional), but large PDFs must be downloaded first. Downloads persist across logouts so users never re-download. The download UI uses a "water filling" animation over the publication cell.

## Changes

### 1. Database: Add `file_size` column to `content` table
- Add a nullable `bigint` column `file_size` to `public.content` (stores bytes)
- Populated during upload from `selectedFile.size`

### 2. Admin Upload: Store file size
**File:** `src/components/admin/ContentUpload.tsx`
- In the `handleUpload` function, add `file_size: selectedFile.size` to the insert call

### 3. Content List: Fetch file size and enforce download gate
**File:** `src/pages/ContentListScreen.tsx`
- Add `file_size` to the content query `select()`
- Define a threshold constant: `SIZE_THRESHOLD = 30 * 1024 * 1024` (30MB)
- When a user taps a large, non-downloaded publication, show a toast or dialog saying "This publication is too large to stream. Please download it first for the best experience." and trigger the download instead of navigating to the reader
- Small publications navigate directly as today

### 4. Water-fill download animation on the publication cell
**File:** `src/components/library/LibraryBookItem.tsx`
- When `isThisDownloading` is true, render an overlay inside the entire card with:
  - A semi-transparent primary-colored div that animates from `height: 0%` to `height: 100%` (bottom to top), driven by `downloadProgress`
  - A percentage label centered on the card
  - The existing content remains visible underneath (slightly dimmed)
- Remove the separate `DownloadButton` progress ring -- the cell itself IS the progress indicator during download

**File:** `src/components/library/DownloadButton.tsx`
- Simplify: when downloading, return `null` (the cell handles the visual). Keep the download/checkmark/remove states as-is.

### 5. Persist downloads across logout
**File:** `src/hooks/useOfflineAccessSync.ts`
- Currently deletes caches when access is revoked. This stays.
- No change needed -- downloads already use Capacitor Filesystem which persists across app sessions.

**File:** `src/contexts/AuthContext.tsx`
- On sign-out, do NOT call any offline cache deletion. Downloads survive logout.
- On login, call `refreshDownloadedList()` so previously downloaded content shows as available.

**File:** `src/hooks/useOfflineDownload.ts`
- No changes to download logic. Already persists to device filesystem.

### 6. Reader: Block large non-downloaded content
**File:** `src/pages/SecureReaderScreen.tsx`
- After fetching content metadata, if `file_size > SIZE_THRESHOLD` and content is NOT downloaded locally, show a full-screen message: "This publication is large and needs to be downloaded first for the best reading experience" with a download button and progress indicator (water-fill style)
- Once download completes, auto-proceed to reader
- Small publications load as today (no gate)

### 7. ContentItem interface update
- Add `file_size: number | null` to the `ContentItem` interface in `ContentListScreen.tsx`

## Technical Details

### Size threshold
- Constant: `const LARGE_PDF_THRESHOLD_MB = 30`
- Stored in one shared location (e.g., a constants file or inline)

### Water-fill animation CSS
```text
The overlay div uses:
- position: absolute, bottom: 0, left: 0, right: 0
- height transitions from 0% to downloadProgress%
- background: primary color at 25% opacity
- transition: height 300ms ease
- rounded corners match the card
```

### Download persistence across logout
- Capacitor Filesystem writes to `Directory.Data` which is app-private and survives across sessions
- The `offlineStorage.ts` service already handles this correctly
- On login, `useOfflineDownload` runs `refreshDownloadedList()` on mount, which scans the filesystem -- so previously downloaded content appears immediately

### Migration SQL
```sql
ALTER TABLE public.content ADD COLUMN file_size bigint;
```

## Files Summary

| Action | File |
|--------|------|
| MIGRATE | Add `file_size` column to `content` table |
| EDIT | `src/components/admin/ContentUpload.tsx` (save file_size on upload) |
| EDIT | `src/pages/ContentListScreen.tsx` (fetch file_size, gate large PDFs) |
| EDIT | `src/components/library/LibraryBookItem.tsx` (water-fill download overlay) |
| EDIT | `src/components/library/DownloadButton.tsx` (hide progress ring during download) |
| EDIT | `src/pages/SecureReaderScreen.tsx` (block large non-downloaded PDFs with download prompt) |

