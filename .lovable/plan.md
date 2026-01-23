
# Fix PDF Zoom: Remove Clipping and Simplify to Browser-Like Zoom

## Problems Identified

### Issue 1: Content Cut Off When Zoomed
From the screenshots, when zoomed to 156%, the bottom text gets clipped. This happens because:
- The `main` element has `overflow-hidden` (line 696)
- The scroll container height calculation doesn't account for zoomed content height
- The `VirtualizedPdfViewer` component applies `transform: scale()` via `gestureTransform`, which doesn't expand the container's actual dimensions

### Issue 2: Complex Hybrid Zoom Approach
The current `usePinchZoom` hook implements a sophisticated "hybrid zoom" strategy:
- CSS `transform: scale()` for instant visual feedback during pinch
- Re-renders pages at committed scale for crisp text
- This complexity causes issues and isn't necessary for your use case

## Solution: Simpler Browser-Like Zoom

Since you're building a Capacitor mobile app (not a web browser), we can use a much simpler approach that:
1. Uses only CSS `transform: scale()` for zooming
2. Enables full omnidirectional scrolling when zoomed (up/down/left/right)
3. Doesn't re-render pages at different scales (keeps them at 100% render, scaled visually)
4. Fixes the clipping issue by properly sizing containers

## Technical Implementation

### Current Flow (Complex)
```text
Pinch gesture → gestureScale → CSS transform (visual feedback)
                    ↓
            Pinch ends → committedScale → Re-render pages at new scale
                    ↓
            Adjust scroll position to preserve focal point
```

### New Flow (Simplified)
```text
Zoom button tap → scale → CSS transform on wrapper → Enable 2D scroll
         ↓
No re-rendering, just visual scaling
```

### Key Changes

#### 1. Simplify `usePinchZoom.ts`
- Remove pinch gesture handling entirely (complex and causes issues)
- Keep only button-based zoom (zoomIn, zoomOut, resetZoom)
- Return only `scale` value (no gestureTransform or visual feedback complexity)

#### 2. Fix Layout in `SecureReaderScreen.tsx`
- Remove `overflow-hidden` from the main wrapper that causes clipping
- Apply `transform: scale()` on the PDF wrapper, not the virtualizer
- Enable `overflow: auto` in both X and Y directions when zoomed
- Calculate proper wrapper dimensions: `width * scale` and `height * scale`

#### 3. Update `VirtualizedPdfViewer.tsx`
- Remove `gestureTransform` prop handling
- Always render pages at base width (100% scale)
- Let the parent container handle zooming via CSS transform

## Detailed File Changes

### File: `src/hooks/usePinchZoom.ts`
**Changes:**
- Remove all touch event handlers (touchstart, touchmove, touchend, touchcancel)
- Remove gesture tracking refs and RAF batching
- Keep wheel zoom (Ctrl+scroll) for desktop testing
- Simplify to just `scale` state with zoomIn/zoomOut/resetZoom functions
- Remove `gestureScale`, `gestureTransform`, `isGesturing` return values

**New simplified hook:**
```typescript
export function usePinchZoom({ minScale = 1, maxScale = 2 }) {
  const [scale, setScale] = useState(1);
  
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(maxScale, Math.round((prev + 0.25) * 100) / 100));
  }, [maxScale]);
  
  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(minScale, Math.round((prev - 0.25) * 100) / 100));
  }, [minScale]);
  
  const resetZoom = useCallback(() => setScale(1), []);
  
  return { scale, zoomIn, zoomOut, resetZoom, isZoomed: scale > 1 };
}
```

### File: `src/pages/SecureReaderScreen.tsx`
**Changes:**

1. Update hook usage (remove unused returns):
```typescript
const { scale, zoomIn, zoomOut, resetZoom, isZoomed } = usePinchZoom({
  minScale: 1,
  maxScale: 2,
});
```

2. Fix the `<main>` element - remove `overflow-hidden`:
```typescript
<main 
  ref={contentRef}
  className="relative flex-1"  // Removed overflow-hidden
>
```

3. Fix scroll container - enable 2D scroll when zoomed:
```typescript
<div 
  ref={scrollContainerRef}
  className="h-full overflow-auto overscroll-none"
  style={{
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'none',
    // Don't apply scroll-smooth when zoomed (allows free scrolling)
  }}
>
```

4. Apply CSS transform to the PDF wrapper:
```typescript
<div
  ref={pdfWrapperRef}
  className="py-4"
  style={{
    // Set explicit dimensions for zoomed content
    width: isZoomed ? `${Math.round(pageWidth * scale) + 32}px` : '100%',
    minWidth: '100%',
    // Apply zoom via CSS transform
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
    // Ensure the container has proper height for scrolling
    minHeight: isZoomed ? `${100 * scale}%` : undefined,
  }}
>
```

5. Remove `gestureTransform` prop from VirtualizedPdfViewer calls

6. Update zoom controls display (use `scale` instead of `visualScale`):
```typescript
{Math.round(scale * 100)}%
```

### File: `src/components/reader/VirtualizedPdfViewer.tsx`
**Changes:**
- Remove `gestureTransform` prop from interface
- Remove transform/transition styles from the wrapper div
- Always render pages at `pageWidth` (base width), not `pageWidth * scale`

**Updated interface:**
```typescript
interface VirtualizedPdfViewerProps {
  numPages: number;
  pageWidth: number;
  // scale prop removed - no longer needed
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
  // gestureTransform removed
  segments?: Segment[];
  getSegmentUrl?: (segmentIndex: number) => string | null;
  getSegmentForPage?: (pageNumber: number) => Segment | null;
  isLoadingSegment?: boolean;
  legacyMode?: boolean;
  onReady?: (api: VirtualizedPdfViewerApi) => void;
}
```

**Wrapper styles (simplified):**
```typescript
<div
  className="relative"
  style={{
    height: virtualizer.getTotalSize(),
    width: pageWidth,  // Always base width
    margin: '0 auto',
    // No transform - parent handles zoom
  }}
>
```

## Visual Comparison

| Aspect | Current (Complex) | New (Simple) |
|--------|-------------------|--------------|
| Zoom method | CSS transform + re-render | CSS transform only |
| Text quality | Crisp (re-rendered) | Slightly soft (acceptable) |
| Scroll when zoomed | Horizontal only, complex focal point math | Natural 2D scroll |
| Content clipping | Yes (bug) | No |
| Touch gestures | Complex pinch handling | Button-only zoom |
| Code complexity | ~300 lines | ~50 lines |
| Performance | Re-renders on each zoom | No re-renders |

## Benefits of This Approach

1. **Fixes clipping issue**: Content properly expands, no overflow-hidden
2. **Natural scrolling**: Swipe in any direction when zoomed, like viewing an image
3. **Simpler code**: Much less complex, fewer bugs
4. **Better performance**: No page re-rendering on zoom
5. **Mobile-friendly**: Works great in Capacitor without touch gesture conflicts

## Trade-off

- **Text sharpness**: At 200% zoom, text may be slightly less crisp than re-rendered text. However, this is often imperceptible on high-DPI mobile screens, and the trade-off is worth the stability and simplicity.

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `src/hooks/usePinchZoom.ts` | Simplify | Remove touch handlers, keep button zoom only |
| `src/pages/SecureReaderScreen.tsx` | Fix | Fix overflow, apply transform to wrapper |
| `src/components/reader/VirtualizedPdfViewer.tsx` | Simplify | Remove scale/transform props, render at base width |

