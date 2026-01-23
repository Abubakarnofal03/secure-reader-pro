

# Fix Plan: Scroll/Zoom Issues and Upload ArrayBuffer Error

## Issue 1: Cannot Scroll Left/Right When Zoomed

### Root Cause
The scroll container in `SecureReaderScreen.tsx` (lines 702-719) has `overflow-auto` which should allow scrolling, but there are CSS/layout issues preventing horizontal scrolling:

1. The content wrapper sets `width` but mobile browsers may not interpret this correctly for horizontal scroll
2. The `overscroll-behavior: none` may interfere with horizontal panning
3. Missing `touch-action` CSS that allows pan-x and pan-y

### Solution
Update the scroll container and content wrapper CSS to explicitly enable omnidirectional scrolling:

**File: `src/pages/SecureReaderScreen.tsx`**
- Add `overflow-x-auto` and `overflow-y-auto` explicitly (instead of just `overflow-auto`)
- Remove `overscrollBehavior: 'none'` from inline styles (this blocks panning gestures)
- Add `touch-action: pan-x pan-y` to allow finger-based panning in both directions
- Ensure the content wrapper has proper minimum width to trigger horizontal scroll

```text
Before (line 704):
┌──────────────────────────────────────────┐
│ className="h-full overflow-auto ..."     │
│ style={{                                 │
│   overscrollBehavior: 'none',  ← Blocks! │
│ }}                                       │
└──────────────────────────────────────────┘

After:
┌──────────────────────────────────────────────┐
│ className="h-full overflow-x-auto            │
│            overflow-y-auto overscroll-none"  │
│ style={{                                     │
│   touchAction: 'pan-x pan-y pinch-zoom',     │
│ }}                                           │
└──────────────────────────────────────────────┘
```

---

## Issue 2: Upload Fails with "Cannot Construct on Detached ArrayBuffer"

### Root Cause
In `ContentUpload.tsx`, the upload flow:

1. **Line 158**: Reads PDF as ArrayBuffer: `await selectedFile.arrayBuffer()`
2. **Line 165**: Passes to TOC extraction: `extractTableOfContents(arrayBuffer)`
   - Inside, `pdfjs.getDocument({ data: pdfBytes })` **transfers** the ArrayBuffer
3. **Line 178**: Tries to reuse same ArrayBuffer: `splitPdfIntoSegments(arrayBuffer)`
   - This fails because the ArrayBuffer is now **detached**

When `pdfjs.getDocument()` receives an ArrayBuffer, it transfers ownership by default, making the original ArrayBuffer unusable (detached).

### Solution
Create a copy of the ArrayBuffer before passing to `extractTableOfContents()`, or read the file twice. The cleanest approach is to copy the ArrayBuffer:

**File: `src/components/admin/ContentUpload.tsx`**

```typescript
// Line 158-165: Create a copy for TOC extraction
const arrayBuffer = await selectedFile.arrayBuffer();

// Create a copy for TOC extraction (pdfjs detaches the original)
const tocArrayBuffer = arrayBuffer.slice(0);

// Use the copy for TOC
setUploadStatus('Extracting table of contents...');
setUploadProgress(8);
let tocData = null;
try {
  tocData = await extractTableOfContents(tocArrayBuffer);
  // ...
}

// Original arrayBuffer is still intact for splitPdfIntoSegments
setUploadStatus('Splitting PDF into segments...');
setUploadProgress(12);
const segments = await splitPdfIntoSegments(arrayBuffer);
```

The key change is `arrayBuffer.slice(0)` which creates a complete copy of the ArrayBuffer that can be detached independently.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/SecureReaderScreen.tsx` | Update scroll container CSS to enable omnidirectional pan/scroll when zoomed |
| `src/components/admin/ContentUpload.tsx` | Copy ArrayBuffer before TOC extraction to prevent detachment error |

## Technical Details

### Why `ArrayBuffer.slice(0)` Works
- `ArrayBuffer.slice()` creates a new ArrayBuffer with copied bytes
- The original and copy are independent - detaching one doesn't affect the other
- `slice(0)` means "copy from index 0 to end" = full copy

### Why `touch-action: pan-x pan-y` is Needed
- Mobile browsers use touch-action CSS to determine which gestures to allow
- Without it, the browser may capture pan gestures for navigation (back/forward swipe)
- `pan-x pan-y` explicitly allows finger panning in both directions
- `pinch-zoom` allows native browser pinch zoom gestures

Fix Missing Images in PDF Reader
Problem Analysis
After investigating the codebase and researching react-pdf configuration, I identified the root cause of missing images and content in the PDF reader.

Root Cause: Missing PDF.js Configuration Options
The Document components in both VirtualizedPdfViewer.tsx (segmented mode) and SecureReaderScreen.tsx (legacy mode) are missing the options prop that provides critical resources to the PDF.js rendering engine:


Current Code (both files):
┌─────────────────────────────────┐
│ <Document                       │
│   file={pdfUrl}                 │
│   ...                           │
│ >  ← Missing 'options' prop!    │
└─────────────────────────────────┘
What's Missing
Option	Purpose	Impact When Missing
cMapUrl	URL to character map files for fonts	Non-Latin text, special characters may not render
cMapPacked	Indicates CMaps are in compressed format	Required when using CDN CMaps
standardFontDataUrl	URL to standard PDF font data	Standard PDF fonts may render incorrectly or not at all
PDFs often embed content in ways that require these external resources to render properly. Medical PDFs are particularly affected because they frequently use:

Special symbols and characters
Embedded fonts that reference standard PDF fonts
Complex layouts that mix text and images
Solution
Add the options prop to all Document components with proper CDN URLs for PDF.js resources.

Files to Modify
src/components/reader/VirtualizedPdfViewer.tsx

Add pdfjs import from react-pdf
Create options constant with CDN URLs
Apply options to the Document component in SegmentedPdfPage
src/pages/SecureReaderScreen.tsx

Create options constant with CDN URLs
Apply options to the legacy Document component
Implementation Details
Step 1: Update VirtualizedPdfViewer.tsx

// At the top of the file, add pdfjs import
import { Document, Page, pdfjs } from 'react-pdf';

// Create options constant (outside component)
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

// In SegmentedPdfPage component, update the Document:
<Document
  file={cachedUrl}
  loading={null}
  error={null}
  onLoadError={handleLoadError}
  options={pdfOptions}  // ← Add this
>
Step 2: Update SecureReaderScreen.tsx

// Create options constant (near the top, after pdfjs import)
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

// In the legacy Document component:
<Document
  file={pdfSource}
  onLoadSuccess={(loadedDoc) => onDocumentLoadSuccess({ numPages: loadedDoc.numPages }, loadedDoc)}
  options={pdfOptions}  // ← Add this
  loading={...}
  error={...}
>
Why This Fixes Missing Images
Some PDFs encode content in ways that require these resources:

Character Maps (CMaps): PDFs can reference external character encoding maps. Without these, text may appear as blank spaces or the entire text layer may fail to render.

Standard Fonts: PDFs can reference the 14 standard PDF fonts (Helvetica, Times, Courier, etc.) without embedding them. If the viewer can't load these fonts, text renders incorrectly or content that depends on font metrics breaks.

Cascade Effect: When font/text rendering fails, it can sometimes affect the layout engine's understanding of where images should be placed, causing them to appear clipped or missing.

Technical Notes
CDN Choice
Using unpkg.com to serve the PDF.js resources because:

It's the same CDN used for the worker script
Matches the exact version of pdfjs-dist installed
No need to bundle these resources (saves ~3MB)
Version Matching
The options use pdfjs.version to ensure the CMaps and fonts match the exact PDF.js version, preventing compatibility issues.

Performance
These resources are loaded on-demand by PDF.js only when needed. Most simple PDFs won't request them at all.

Summary of Changes
File	Change
src/components/reader/VirtualizedPdfViewer.tsx	Add pdfjs import, create pdfOptions constant, add options={pdfOptions} to Document
src/pages/SecureReaderScreen.tsx	Create pdfOptions constant, add options={pdfOptions} to legacy Document
This should resolve the missing images and content issue by providing PDF.js with the resources it needs to fully render complex PDFs.