
# Rebuild PDF Reader: On-Demand Server Rendering with Caching

## Understanding Your Constraints

You've identified a critical issue: **pre-rendering 1600-page PDFs to images would consume 300-500MB per document**, quickly exhausting your Supabase storage quota. This rules out the pre-render approach.

Your preferred solution is **on-demand server-side rendering**: when a user opens a page, the server renders it to an image (with watermark) and streams it to the client.

## Technical Reality Check

After researching Supabase Edge Functions limitations:

| Capability | Status |
|------------|--------|
| Sharp (native image library) | Not supported (requires Node.js native modules) |
| @napi-rs/canvas | Not supported (native bindings) |
| magick-wasm | Supported (WASM-based) - but for image manipulation, not PDF rendering |
| pdfjs-dist (browser version) | Requires DOM/Canvas |
| pdfjs-serverless | Text extraction only, no image rendering |
| Memory limit | Edge Functions have resource limits, large PDFs may fail |

**Bottom line**: True PDF-to-image rendering in Supabase Edge Functions is currently not feasible without external services.

## Proposed Solution: Fix Client-Side Rendering Properly

Since server-side rendering isn't viable within your cost constraints, the best path forward is to **fix the current client-side react-pdf implementation** properly. The issues you're seeing (missing content, zoom problems, no page separation) are all fixable without changing the architecture.

### Why Content is "Being Eaten Up"

The current implementation has:
```typescript
renderTextLayer={false}
renderAnnotationLayer={false}
```

This disables:
- **Text layer**: Selectable text overlays
- **Annotation layer**: Links, form fields, embedded content

Some PDFs (especially medical/scientific) use text layers for critical content. Disabling them causes missing text.

### Why Zoom is Broken

The current approach uses CSS `transform: scale()` on a virtualized container. This fundamentally conflicts with virtualization because:
- The virtualizer calculates scroll positions based on unscaled dimensions
- CSS transforms don't affect document flow
- Scroll coordinates become misaligned

### Why Pages Blend Together

No visual separator or page number indicator between pages - just continuous content.

---

## Implementation Plan

### Phase 1: Fix Content Rendering (Missing Text/Images)

**File: `src/components/reader/VirtualizedPdfViewer.tsx`**

1. Enable text and annotation layers:
```typescript
<Page
  pageNumber={localPageNumber}
  width={scaledWidth}
  renderTextLayer={true}      // Enable text layer
  renderAnnotationLayer={true} // Enable annotations/links
  ...
/>
```

2. Import required CSS for layers:
```typescript
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
```

3. Add CSS to hide text layer visually (for security) while keeping content:
```css
.react-pdf__Page__textContent {
  opacity: 0;
  pointer-events: none;
}
```

### Phase 2: Add Clear Page Separation

**New Component: `src/components/reader/PageSeparator.tsx`**

Create a visual separator between pages:
```typescript
export function PageSeparator({ pageNumber }: { pageNumber: number }) {
  return (
    <div className="w-full flex items-center justify-center py-3 my-2">
      <div className="flex-1 h-px bg-border" />
      <span className="px-3 text-xs text-muted-foreground font-medium bg-background">
        Page {pageNumber}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
```

Integrate into `VirtualizedPdfViewer.tsx` to show after each page (except the last).

### Phase 3: Fix Zoom with Native Approach

**Strategy**: Remove CSS transform zoom entirely. Instead, use **actual page re-rendering at different widths**.

**Why this works better**:
- Virtualizer works with correct dimensions
- No scroll position conflicts
- Text stays crisp at any zoom level
- Native scrolling works perfectly

**File: `src/hooks/usePinchZoom.ts`**

Simplify to just control `zoomLevel` (1, 1.25, 1.5, 1.75, 2):
```typescript
export function usePinchZoom({ minScale = 1, maxScale = 2 }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(maxScale, prev + 0.25));
  }, [maxScale]);
  
  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(minScale, prev - 0.25));
  }, [minScale]);
  
  const resetZoom = useCallback(() => setZoomLevel(1), []);
  
  return { zoomLevel, zoomIn, zoomOut, resetZoom };
}
```

**File: `src/pages/SecureReaderScreen.tsx`**

Calculate `pageWidth` based on zoom:
```typescript
const baseWidth = window.innerWidth - 32;
const pageWidth = Math.round(baseWidth * zoomLevel);
```

Remove all CSS transform code from the PDF wrapper.

**File: `src/components/reader/VirtualizedPdfViewer.tsx`**

The virtualizer now receives the zoomed `pageWidth` directly:
- Pages render at the correct size
- Virtualizer calculates correct scroll positions
- Horizontal scrolling works naturally when content exceeds viewport

### Phase 4: Proper Page Dimensions

**File: `src/components/reader/VirtualizedPdfViewer.tsx`**

Currently using hardcoded aspect ratio:
```typescript
const scaledHeight = Math.round(scaledWidth * 1.4); // Hardcoded 1.4 ratio
```

Add a page dimension cache that stores actual heights after first render:
```typescript
const [pageDimensions, setPageDimensions] = useState<Map<number, number>>(new Map());

// In Page onRenderSuccess callback
onRenderSuccess={(page) => {
  const height = page.height;
  setPageDimensions(prev => new Map(prev).set(pageNumber, height));
}}
```

Update virtualizer to use dynamic heights:
```typescript
const virtualizer = useVirtualizer({
  count: numPages,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: (index) => {
    const pageNum = index + 1;
    return (pageDimensions.get(pageNum) || scaledHeight) + pageGap;
  },
  ...
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/reader/VirtualizedPdfViewer.tsx` | Enable text/annotation layers, add page separators, use dynamic dimensions |
| `src/components/reader/PageSeparator.tsx` | New component for visual page dividers |
| `src/hooks/usePinchZoom.ts` | Simplify to control zoom level without CSS transforms |
| `src/pages/SecureReaderScreen.tsx` | Remove CSS transform zoom, calculate pageWidth from zoom level |
| `src/index.css` | Add CSS to hide text layer for security while keeping rendering |

---

## Expected Improvements

| Issue | Before | After |
|-------|--------|-------|
| Missing content | Text/annotation layers disabled | Enabled (content renders fully) |
| Zoom broken | CSS transform conflicts with virtualizer | Native width-based zoom, smooth scrolling |
| No page separation | Continuous flow | Clear separators with page numbers |
| Scroll issues | Transform breaks scroll math | Natural scrolling at all zoom levels |

---

## Alternative: External Rendering Service (Future)

If you later want true server-side rendering, you could:
1. Use a paid API like **CloudConvert**, **pdf.co**, or **Adobe PDF Services**
2. Build a separate **Node.js microservice** (not Edge Function) with Sharp/Canvas
3. Cache rendered pages temporarily (1-hour TTL) to reduce API calls

These add cost but would enable:
- Perfect watermark embedding in the image itself
- No client-side PDF parsing
- Consistent rendering across devices

For now, the client-side fix is the most practical path forward.

---

## Technical Notes

### Security Consideration
With `renderTextLayer={true}`, the text becomes potentially selectable. We mitigate this by:
1. CSS: `opacity: 0; pointer-events: none;` on text layer
2. Existing event listeners blocking copy/paste/select
3. The watermark overlay

### Performance
Re-rendering pages at different widths is actually fine because:
- react-pdf caches rendered pages internally
- Virtualizer only renders visible pages (5-7 at a time)
- Zoom changes are infrequent user actions

### Bundle Size
No new dependencies needed - this is all about properly using react-pdf features that are already installed.
