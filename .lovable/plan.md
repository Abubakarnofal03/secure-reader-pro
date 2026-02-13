
# Offline-First PDF Reader with Persistent Downloads

## Overview

Restructure the PDF reader so that once a document is downloaded, it stays on the device permanently (even after logout). The document is only fetched from the server on first open. Subsequent opens always use the local copy. Offline and logged-out viewing is supported. Admin access control is checked only when online.

---

## Key Behavior Changes

1. **First open (online + logged in)**: Download all segments, watermark/encrypt server-side, save encrypted segments + metadata (including IV, salt, userId, title, TOC) to app-private storage.
2. **Subsequent opens**: Read from local storage, decrypt in memory, show in viewer. No server call needed.
3. **Logged out**: Can still open previously downloaded documents from device storage. The decryption key is derived from `userId + deviceId + contentId` -- all stored locally.
4. **Offline**: Same as logged out -- everything works from local cache.
5. **Access revocation**: When online and logged in, the app checks `user_content_access` before showing the document. If access is revoked, the cached content is deleted. When offline or logged out, no check is possible, so cached content remains accessible.

---

## Detailed Changes

### 1. Stop clearing device ID on logout

**File**: `src/contexts/AuthContext.tsx`

Currently `signOut()` calls `clearDeviceId()`. This must be removed because the device ID is part of the encryption key. If it gets cleared, previously downloaded PDFs become undecryptable.

- Remove the `clearDeviceId()` call from the `signOut` function
- Keep clearing the `active_device_id` on the profile (server-side session invalidation still works)

### 2. Expand encrypted storage metadata

**File**: `src/hooks/useEncryptedPdfStorage.ts`

The current meta file only stores `versionHash` and `contentId`. It needs to store everything required for offline decryption and display:

```text
CachedMeta {
  versionHash: string
  contentId: string
  userId: string          // NEW - needed for key derivation when logged out
  title: string           // NEW - display without server
  totalPages: number      // NEW - display without server
  tableOfContents: object // NEW - TOC without server
  segments: Array<{       // NEW - IV/salt per segment for decryption
    segmentIndex: number
    iv: string            // base64
    salt: string          // base64
    fileName: string      // encrypted file name on disk
  }>
}
```

- `saveEncryptedPdf` becomes `saveSegment` -- saves one segment at a time with its IV/salt
- `saveContentMeta` -- saves the full metadata after all segments are downloaded
- `getDecryptedPdf` -- reads all segments from disk, decrypts each using stored IV/salt, returns merged bytes
- Remove dependency on `userId` parameter -- read it from stored metadata instead
- Add `getStoredContentMeta(contentId)` to check if content exists locally
- Add `deleteContent(contentId)` for access revocation cleanup
- Add `listDownloadedContent()` for the library to show offline-available books

### 3. Rewrite SecureReaderScreen flow

**File**: `src/pages/SecureReaderScreen.tsx`

New flow:

```text
1. Check local storage for cached content meta
2. If cached:
   a. If online AND logged in: verify access (user_content_access)
      - If access revoked: delete cache, show error
      - If access valid: proceed to step 3
   b. If offline OR logged out: skip access check, proceed to step 3
3. Decrypt segments from local storage, open viewer
4. If NOT cached:
   a. Require login (redirect to /login if not authenticated)
   b. Download metadata from server
   c. Download each segment, save encrypted to device
   d. Save full meta (including IV/salt per segment)
   e. Proceed to step 3
```

- The screen no longer requires `profile` to be present for viewing cached content
- Reading progress and notes only sync when online/logged in (graceful degradation)

### 4. Remove ProtectedRoute wrapper for reader

**File**: `src/App.tsx`

The `/reader/:id` route is currently wrapped in `<ProtectedRoute>` which redirects to `/login` if not authenticated. This must be removed so logged-out users can still open cached content.

Change:
```text
<Route path="/reader/:id" element={
  <ProtectedRoute>
    <SecureReaderScreen />
  </ProtectedRoute>
} />
```
To:
```text
<Route path="/reader/:id" element={<SecureReaderScreen />} />
```

The SecureReaderScreen itself will handle the logic: if content is cached, show it; if not cached and not logged in, redirect to login.

### 5. Add offline library indicator

**File**: `src/pages/ContentListScreen.tsx`

In the "My Books" tab, books that have been downloaded should show a download indicator (e.g., a small icon). This helps users know which books are available offline. When offline, only show downloaded books.

### 6. Edge function -- no changes needed

The `deliver-encrypted-pdf` function already handles the download flow correctly. Each segment returns its own IV and salt, which the client will now persist locally.

### 7. Database -- no schema changes needed

The `encrypted_content_cache` table already tracks which content has been downloaded per device. No changes required.

---

## Technical Details

### Key Derivation (unchanged algorithm, changed data source)

The encryption password is `userId:deviceId:contentId`. Currently:
- `userId` comes from `profile.id` (requires login)
- `deviceId` comes from `getDeviceId()` (stored in Preferences)

After this change:
- `userId` comes from stored metadata when offline (was captured during download)
- `deviceId` still comes from `getDeviceId()` (no longer cleared on logout)

### What happens when admin revokes access

- If user is online and logged in: access check fails, cached content is deleted, user sees "access revoked" message
- If user is offline: they can still view the cached content until they go online. This is an acceptable tradeoff -- the watermark identifies the user, and the content was already delivered to them

### What happens when content is updated

- On next online open, the server returns a new `versionHash`
- Client detects mismatch, re-downloads all segments
- Old encrypted files are cleaned up

---

## File Summary

| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/contexts/AuthContext.tsx` | Remove `clearDeviceId()` from `signOut` |
| REWRITE | `src/hooks/useEncryptedPdfStorage.ts` | Expand meta schema, store IV/salt/userId/title per content, add offline decryption |
| REWRITE | `src/pages/SecureReaderScreen.tsx` | Offline-first flow: check cache first, only download if needed, handle logged-out viewing |
| MODIFY | `src/App.tsx` | Remove ProtectedRoute wrapper from `/reader/:id` |
| MODIFY | `src/pages/ContentListScreen.tsx` | Show download indicator for offline-available books |
