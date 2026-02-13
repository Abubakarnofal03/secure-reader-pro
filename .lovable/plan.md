
# PDF Reader Architecture Refactoring Plan

## Overview

This plan replaces the current browser-based PDF rendering (react-pdf + HTML pages + UI watermark overlay) with a server-side watermarked, encrypted PDF delivery system paired with a native Android PDF viewer. The result is a simpler, more secure, and offline-capable architecture.

---

## Architecture Comparison

### What Gets Removed
- `react-pdf`, `pdfjs-dist` dependencies and all browser-side PDF rendering
- `VirtualizedPdfViewer` component and its virtualization logic (~650 lines)
- `Watermark.tsx` UI overlay component
- `useSegmentDocumentCache`, `useSignedUrlRefresh`, `usePdfOutline`, `usePinchZoom`, `useScrollPageDetection`, `useSegmentManager`, `usePageCache`, `usePdfTextExtraction` hooks
- `HighlightDrawingLayer`, `HighlightOverlay`, `NoteIndicator`, `PageSeparator`, `PageSlider`, `FloatingPageIndicator`, `ScrollProgressBar` reader sub-components
- Legacy `render-pdf-page` edge function
- `get-segment-url` edge function (replaced by new delivery function)

### What Gets Added
- **Edge Function: `watermark-pdf`** -- downloads the full PDF from storage, embeds diagonal watermark text on every page using pdf-lib, returns watermarked bytes
- **Edge Function: `deliver-encrypted-pdf`** -- orchestrates: auth check, access check, device check, calls watermark service, encrypts with AES-256-GCM, returns encrypted blob + metadata
- **Capacitor Plugin: Custom `EncryptedPdfViewer`** -- native Android plugin that decrypts in memory and renders using Android's `PdfRenderer`
- **Client Hook: `useEncryptedPdfStorage`** -- manages encrypted file storage in app-private directory via `@capacitor/filesystem`
- **Simplified `SecureReaderScreen`** -- lightweight screen that checks for cached encrypted PDF, downloads if needed, hands off to native viewer

---

## Detailed Implementation

### Phase 1: Server-Side Watermarking Edge Function

Create `supabase/functions/watermark-pdf/index.ts`:
- Accepts: `content_id`, user profile data (name, email)
- Downloads all segments from storage, merges them back into one PDF using pdf-lib
- Embeds a repeating diagonal watermark pattern on every page:
  - Username, email, timestamp, session ID
  - Light gray, rotated -45 degrees, repeated across the page
  - Embedded in the PDF content stream (not removable by UI stripping)
- Returns the watermarked PDF as `Uint8Array`

### Phase 2: Encryption and Delivery Edge Function

Create `supabase/functions/deliver-encrypted-pdf/index.ts`:
- Full auth, device, and access validation (same as current `get-segment-url`)
- Calls the watermarking logic internally (same Deno process, no separate HTTP call)
- Derives an AES-256-GCM key from: `userId + deviceId + contentId` using PBKDF2 with a server-side salt
- Encrypts the watermarked PDF bytes
- Returns: encrypted blob (base64), IV, salt, and metadata (title, total pages, version hash)
- Stores a record in a new `encrypted_content_cache` table so the server knows what version the client has

### Phase 3: Database Changes

New table: `encrypted_content_cache`
```text
id           uuid  PK  default gen_random_uuid()
user_id      uuid  NOT NULL
content_id   uuid  NOT NULL
device_id    text  NOT NULL
version_hash text  NOT NULL  -- hash of content + watermark params
created_at   timestamptz  default now()
UNIQUE(user_id, content_id, device_id)
```

RLS policies:
- Users can SELECT/INSERT/UPDATE/DELETE their own rows
- Admins can view all

### Phase 4: Client-Side Encrypted Storage

New hook `src/hooks/useEncryptedPdfStorage.ts`:
- Uses `@capacitor/filesystem` to write encrypted PDF to app-private directory (`Directory.Data`)
- File naming: `{contentId}_{versionHash}.enc`
- Checks if cached version matches server version before re-downloading
- Provides `getDecryptedPdf(contentId)` that:
  1. Reads encrypted file from disk
  2. Derives the same AES key using `userId + deviceId + contentId`
  3. Decrypts in memory using Web Crypto API
  4. Returns `Uint8Array` (never written to disk decrypted)

### Phase 5: Native Android PDF Viewer (Capacitor Plugin)

Create a custom Capacitor plugin `EncryptedPdfViewer`:
- **Android Implementation** (`android/app/src/main/java/.../EncryptedPdfViewerPlugin.java`):
  - Receives decrypted PDF bytes via bridge (or decrypts natively using passed key material)
  - Uses Android's `android.graphics.pdf.PdfRenderer` in a `RecyclerView`
  - Supports smooth scrolling, pinch-to-zoom
  - Applies `FLAG_SECURE` to the activity window
  - No file written to disk -- works entirely from `ParcelFileDescriptor` backed by in-memory pipe
- **TypeScript definitions** (`src/plugins/encrypted-pdf-viewer/definitions.ts`)
- **Web fallback**: For development/preview, falls back to rendering via an in-memory blob URL with a simple `<iframe>` or retained `react-pdf` minimal viewer (dev-only)

### Phase 6: Simplified SecureReaderScreen

Rewrite `src/pages/SecureReaderScreen.tsx` to ~200 lines:
1. Check auth and content access
2. Check if encrypted PDF is cached locally (via `useEncryptedPdfStorage`)
3. If not cached or outdated, call `deliver-encrypted-pdf` edge function
4. Save encrypted response to device storage
5. Decrypt in memory
6. Pass decrypted bytes to native `EncryptedPdfViewer` plugin
7. Keep: reading progress, notes panel, TOC (from stored `table_of_contents` in DB)
8. Remove: all virtualization, segment management, highlight drawing, UI watermark

### Phase 7: Security Hardening

- Screenshot prevention: Keep existing `usePrivacyScreen` hook with `FLAG_SECURE` (re-enable it -- currently disabled)
- Watermark is embedded in PDF layer -- survives printing, screenshotting, and PDF export
- No decrypted file ever touches disk
- Encryption key is deterministic per user+device+content -- lost if user logs out or switches device (by design)
- Encrypted files in app-private storage are inaccessible to other apps

### Phase 8: Cleanup

Remove these files:
- `src/components/reader/VirtualizedPdfViewer.tsx`
- `src/components/reader/HighlightDrawingLayer.tsx`
- `src/components/reader/HighlightOverlay.tsx`
- `src/components/reader/PageSeparator.tsx`
- `src/components/reader/PageSlider.tsx`
- `src/components/reader/FloatingPageIndicator.tsx`
- `src/components/reader/ScrollProgressBar.tsx`
- `src/components/reader/HighlightColorPicker.tsx`
- `src/components/Watermark.tsx`
- `src/hooks/useSegmentDocumentCache.ts`
- `src/hooks/useSignedUrlRefresh.ts`
- `src/hooks/usePinchZoom.ts`
- `src/hooks/useScrollPageDetection.ts`
- `src/hooks/useSegmentManager.ts`
- `src/hooks/usePageCache.ts`
- `src/hooks/usePdfTextExtraction.ts`
- `src/hooks/usePdfOutline.ts`
- `supabase/functions/render-pdf-page/index.ts`
- `supabase/functions/get-segment-url/index.ts`

Remove npm dependencies: `react-pdf`, `pdfjs-dist`
Add npm dependency: `@capacitor/filesystem`

---

## Technical Considerations

### Edge Function Limits
- Deno edge functions have a ~150MB memory limit and 60s timeout. For very large PDFs (100MB+), watermarking might need to process segments sequentially rather than merging into one giant document first. The implementation will handle this by streaming segments.

### Encryption Details
- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: PBKDF2 with 100,000 iterations, SHA-256
- Salt: Randomly generated per encryption, stored alongside ciphertext
- IV: 12 bytes, randomly generated per encryption

### Offline Capability
- Once downloaded, the encrypted PDF is available offline indefinitely
- Decryption happens client-side using deterministic key derivation
- Notes and reading progress sync when back online (existing Supabase sync)

### What Is Preserved
- Authentication flow (Supabase Auth, device validation)
- Notes system (`useUserNotes`, `NotesPanel`, `AddNoteDialog`)
- Reading progress tracking (`useReadingProgress`)
- Table of Contents (from stored DB metadata)
- Privacy screen / FLAG_SECURE
- Content upload flow (admin segmentation stays -- server merges on delivery)

### Migration Path
- Existing segmented content in storage remains unchanged
- The new `deliver-encrypted-pdf` function reads segments and merges them server-side
- No data migration needed -- only new code paths

---

## File Summary

| Action | File |
|--------|------|
| CREATE | `supabase/functions/deliver-encrypted-pdf/index.ts` |
| CREATE | `src/hooks/useEncryptedPdfStorage.ts` |
| CREATE | `src/plugins/encrypted-pdf-viewer/definitions.ts` |
| CREATE | `src/plugins/encrypted-pdf-viewer/index.ts` |
| CREATE | `src/plugins/encrypted-pdf-viewer/web.ts` |
| CREATE | `android/app/src/main/java/com/mycalorics/app/EncryptedPdfViewerPlugin.java` |
| REWRITE | `src/pages/SecureReaderScreen.tsx` |
| MODIFY | `src/App.tsx` (remove unused imports) |
| DELETE | ~18 files (reader components, hooks, old edge functions) |
| DB MIGRATION | Create `encrypted_content_cache` table with RLS |
| DELETE EDGE FNS | `render-pdf-page`, `get-segment-url` |
