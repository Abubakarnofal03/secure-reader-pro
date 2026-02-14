

# Offline Reading for Android and iOS

## Overview
Add offline reading capability so users can download purchased publications and read them without an internet connection. The existing online reading flow remains completely untouched -- offline is an additive layer that intercepts before the network path.

## How It Works (User Perspective)

1. In the **Library** tab, each purchased book shows a **download button** (cloud-download icon)
2. Tapping it downloads all PDF segments to local device storage with a progress indicator
3. Once downloaded, a **checkmark** replaces the download icon
4. When offline (or anytime), opening a downloaded book loads from local storage instead of fetching signed URLs
5. When the app comes back online, it silently verifies access -- if revoked, the local cache is deleted and the user is notified

## Architecture

The offline layer sits **between** the existing reader and the network, acting as a transparent cache:

```text
User opens book
      |
      v
[OfflineManager] -- has local copy? -- YES --> serve from local storage
      |                                            |
      NO                                    (online? verify access)
      |
      v
[Existing SegmentManager / render-pdf-page] -- fetch from server as today
```

No existing files are modified. New files wrap/intercept at integration points.

## Technical Plan

### 1. Install Capacitor Filesystem Plugin
- Add `@capacitor/filesystem` dependency
- This provides native file system access on Android/iOS for storing PDFs in the app's private directory

### 2. New: `src/services/offlineStorage.ts`
Core service that handles all local file operations:
- `downloadSegment(contentId, segmentIndex, url)` -- fetches PDF blob from signed URL, saves to app private storage via Capacitor Filesystem
- `getLocalSegmentPath(contentId, segmentIndex)` -- returns local file URI if exists
- `isContentDownloaded(contentId)` -- checks if all segments for a content are stored locally
- `deleteContentCache(contentId)` -- removes all local files for a content
- `getDownloadedContentIds()` -- returns list of all offline-available content IDs
- Storage path: `offline-content/{contentId}/segment-{index}.pdf`
- Stores a metadata JSON file per content with segment info, download timestamp, and version hash

### 3. New: `src/hooks/useOfflineDownload.ts`
Hook for managing downloads from the Library screen:
- `downloadContent(contentId)` -- orchestrates full download: fetches segment metadata, gets signed URLs for each segment via the existing edge function, downloads each blob, saves locally
- Exposes `downloadProgress` (0-100), `isDownloading`, `downloadError`
- `removeDownload(contentId)` -- deletes local cache
- `isDownloaded(contentId)` -- checks local availability
- `downloadedContentIds` -- reactive list of all downloaded content

### 4. New: `src/hooks/useOfflineReader.ts`
Hook that wraps the existing segment manager for the reader:
- On mount, checks if content is available offline via `offlineStorage`
- If yes AND (offline OR local copy exists), returns local file URIs instead of signed URLs
- Exposes the same interface shape as `useSegmentManager` so the reader can consume it transparently
- Falls back to online `useSegmentManager` when no local copy exists

### 5. New: `src/hooks/useOfflineAccessSync.ts`
Background hook for access verification:
- When the app comes online (listens for `online` event and `visibilitychange`)
- For each downloaded contentId, queries `user_content_access` to verify the user still has access
- If access revoked: deletes local cache, shows toast notification ("Access to [title] has been revoked")
- Runs on app startup and on network reconnection

### 6. Update: `src/components/library/LibraryBookItem.tsx`
- Add a download/delete icon button on purchased books
- Show download progress bar during download
- Show "Downloaded" indicator (filled cloud icon) when available offline
- Long-press or second tap on downloaded icon offers "Remove download" option

### 7. Update: `src/pages/SecureReaderScreen.tsx`
- Import and use `useOfflineReader` hook
- Before the existing `useSegmentManager` call, check if offline version is available
- If offline data exists, pass local file URIs to `VirtualizedPdfViewer` instead of signed URLs
- Show a small "Offline" badge in the toolbar when reading from local storage
- The existing segment manager, session recovery, and URL refresh hooks remain active but idle when offline data is being used

### 8. Update: `src/App.tsx`
- Add `useOfflineAccessSync` hook at the app level so it runs globally after authentication

### 9. New: `src/components/library/DownloadButton.tsx`
Dedicated component for the download UI:
- Download icon (not downloaded), progress ring (downloading), checkmark (downloaded)
- Handles tap to download, tap to cancel, long-press to remove
- Uses `useOfflineDownload` hook internally

## Data Flow: Download

1. User taps download on a book in Library
2. `useOfflineDownload` fetches segment list from `content_segments` table
3. For each segment, calls `get-segment-url` edge function to get a signed URL
4. Downloads the PDF blob via `fetch(signedUrl)`
5. Saves blob to device filesystem via Capacitor Filesystem `writeFile()`
6. Updates local metadata JSON with segment info
7. Progress updates as each segment completes

## Data Flow: Offline Reading

1. User taps a downloaded book
2. `SecureReaderScreen` mounts, `useOfflineReader` checks local storage
3. Local segment files found -- creates `file://` or Capacitor `Filesystem.getUri()` URIs
4. These URIs are passed to `VirtualizedPdfViewer` as segment URLs (same prop interface)
5. PDF.js loads from local file URIs instead of remote signed URLs
6. No network calls needed -- reading works fully offline

## Data Flow: Access Revocation

1. App comes online or user opens the app
2. `useOfflineAccessSync` queries `user_content_access` for all downloaded content IDs
3. Any content ID not found in access table -> delete local files + show toast
4. Sync runs silently in background, does not block the UI

## Security Considerations

- Files stored in app's private directory (not accessible to other apps)
- Capacitor Filesystem uses app-internal storage by default on both platforms
- Watermark data is embedded during download (stored in metadata)
- Access revocation check ensures content is removed when permissions change
- No files are stored in the database -- only on device filesystem

## Files Summary

| Action | File |
|--------|------|
| NEW | `src/services/offlineStorage.ts` |
| NEW | `src/hooks/useOfflineDownload.ts` |
| NEW | `src/hooks/useOfflineReader.ts` |
| NEW | `src/hooks/useOfflineAccessSync.ts` |
| NEW | `src/components/library/DownloadButton.tsx` |
| EDIT | `src/components/library/LibraryBookItem.tsx` (add download button) |
| EDIT | `src/pages/SecureReaderScreen.tsx` (add offline reader hook) |
| EDIT | `src/App.tsx` (add access sync hook) |
| INSTALL | `@capacitor/filesystem` |

