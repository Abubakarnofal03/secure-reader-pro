
# Fix: Jump to Page and Resume Reading for Segmented PDF Reader

## Problem Summary

Both "Jump to Page" and "Resume Reading" features are broken due to a fundamental incompatibility between virtualized rendering and element-based scrolling.

**Technical Root Cause:**
- The current `scrollToPage` function tries to find a page's DOM element using `pageRefs.current.get(pageNumber)`
- With virtualization, only ~5 pages around the current view are rendered
- Jumping to page 50 fails because that page element doesn't exist in the DOM yet

## Solution Overview

Replace the element-based scrolling with position-based scrolling using the virtualizer's built-in `scrollToIndex()` method.

---

## Implementation Plan

### Step 1: Update VirtualizedPdfViewer to Expose Scroll Method

Modify the viewer component to accept an optional callback that provides scroll control:

```text
┌─────────────────────────────────────────────────────────────┐
│  VirtualizedPdfViewer                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  useVirtualizer({ ... })                              │  │
│  │       │                                               │  │
│  │       ▼                                               │  │
│  │  virtualizer.scrollToIndex(pageIndex)  ◄── exposed   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  SecureReaderScreen                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  scrollToPage() ──► calls virtualizer ref method      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Changes to `VirtualizedPdfViewer.tsx`:**
- Accept a new prop: `onReady?: (api: { scrollToPage: (page: number, behavior?: ScrollBehavior) => void }) => void`
- Call `onReady` when the virtualizer is initialized, passing a function that uses `virtualizer.scrollToIndex()`

### Step 2: Update SecureReaderScreen to Use New Scroll API

**Changes to `SecureReaderScreen.tsx`:**
- Create a ref to store the virtualizer's scroll function
- Pass `onReady` callback to `VirtualizedPdfViewer` to capture the scroll method
- Update `goToPage`, `handleResume`, and `handleStartOver` to use the new method
- Remove dependency on `useScrollPageDetection`'s `scrollToPage` for navigation

### Step 3: Pre-fetch Segment When Jumping (for Segmented Content)

**Changes to `useSegmentManager.ts`:**
- Add a new function `prefetchSegmentForPage(pageNumber)` that fetches the URL for a specific page's segment
- Export this function so the reader can call it before scrolling

**Changes to `SecureReaderScreen.tsx`:**
- When jumping to a page in segmented mode, first call `prefetchSegmentForPage(targetPage)`
- Wait for the segment URL to be available (or timeout after 2 seconds)
- Then perform the scroll

### Step 4: Handle Initial Page Load for Resume Reading

**Changes to `SecureReaderScreen.tsx`:**
- Add an effect that runs once when:
  - `savedProgress` is available AND
  - `numPages > 0` AND
  - The virtualizer is ready
- This effect will automatically scroll to the saved page on initial load (when user dismisses the prompt)

---

## Technical Details

### New VirtualizedPdfViewer Props

```typescript
interface VirtualizedPdfViewerProps {
  // ... existing props ...
  onReady?: (api: { 
    scrollToPage: (page: number, behavior?: ScrollBehavior) => void 
  }) => void;
}
```

### Updated scrollToPage Implementation

```typescript
// Inside VirtualizedPdfViewer
const scrollToPage = useCallback((page: number, behavior: ScrollBehavior = 'smooth') => {
  const pageIndex = page - 1; // Convert 1-based to 0-based index
  virtualizer.scrollToIndex(pageIndex, { 
    align: 'start',
    behavior 
  });
}, [virtualizer]);

// Call onReady when component mounts
useEffect(() => {
  if (isReady && onReady) {
    onReady({ scrollToPage });
  }
}, [isReady, onReady, scrollToPage]);
```

### Segment Prefetch for Jump

```typescript
// In SecureReaderScreen
const goToPage = useCallback(async (page: number) => {
  if (page < 1 || page > numPages) return;
  
  // For segmented content, prefetch the target segment first
  if (isSegmented) {
    const segment = getSegmentForPage(page);
    if (segment) {
      await prefetchSegmentForPage(page);
    }
  }
  
  // Use virtualizer's scroll method
  viewerApiRef.current?.scrollToPage(page, 'smooth');
}, [numPages, isSegmented, getSegmentForPage, prefetchSegmentForPage]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/reader/VirtualizedPdfViewer.tsx` | Add `onReady` prop, expose `scrollToPage` via callback |
| `src/hooks/useSegmentManager.ts` | Add `prefetchSegmentForPage()` function |
| `src/pages/SecureReaderScreen.tsx` | Update scroll logic to use virtualizer API, add segment prefetch |

---

## Expected Behavior After Fix

1. **Jump to Page Dialog**: User enters page 100 → system prefetches segment if needed → virtualizer scrolls to position → page 100 renders and displays

2. **Resume Reading Toast**: User clicks "Resume" → system scrolls to saved page position → user continues from where they left off

3. **Start Over**: User clicks "Start over" → scrolls to page 1 → reading restarts

4. **Segment Prefetch**: When jumping to a distant page, the target segment is fetched before scrolling, ensuring the page is ready to render when the user arrives

---

## Edge Cases Handled

- **Jumping before virtualizer ready**: The scroll command is queued until the virtualizer initializes
- **Jumping to invalid page**: Validated before scroll (page must be 1 ≤ page ≤ numPages)
- **Segment fetch failure**: Scroll proceeds anyway, page shows loading spinner, segment retries automatically
- **Very fast jumps**: Previous segment fetches are not cancelled, but new target takes priority
