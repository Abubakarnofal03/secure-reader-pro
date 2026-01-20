import { useRef, useCallback, useEffect, useState, memo, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';

interface VirtualizedPdfViewerProps {
  numPages: number;
  pageWidth: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
}

interface CacheEntry {
  dataUrl: string;
  width: number;
  height: number;
}

// Global in-memory cache for rendered pages (persists across re-renders but clears on page reload)
const pageCache = new Map<string, CacheEntry>();
const MAX_CACHED_PAGES = 30;

function getCacheKey(pageNumber: number): string {
  return `page-${pageNumber}`;
}

function getCachedPage(pageNumber: number): CacheEntry | null {
  return pageCache.get(getCacheKey(pageNumber)) || null;
}

function cachePage(pageNumber: number, entry: CacheEntry): void {
  const key = getCacheKey(pageNumber);
  
  // Don't cache if already exists
  if (pageCache.has(key)) return;

  // Evict oldest entries if at capacity (simple FIFO for performance)
  if (pageCache.size >= MAX_CACHED_PAGES) {
    const firstKey = pageCache.keys().next().value;
    if (firstKey) {
      pageCache.delete(firstKey);
    }
  }

  pageCache.set(key, entry);
}

// Memoized page component with caching support
const PdfPage = memo(({ 
  pageNumber, 
  pageWidth,
  registerPage,
  onRenderComplete,
}: { 
  pageNumber: number; 
  pageWidth: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  onRenderComplete: (pageNumber: number, canvas: HTMLCanvasElement) => void;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const estimatedHeight = Math.round(pageWidth * 1.4);
  const cached = getCachedPage(pageNumber);

  // Register page element for scroll detection
  useEffect(() => {
    if (pageRef.current) {
      registerPage(pageNumber, pageRef.current);
    }
    return () => {
      registerPage(pageNumber, null);
    };
  }, [pageNumber, registerPage]);

  const handleRenderSuccess = useCallback(() => {
    // After PDF renders, capture canvas for caching
    if (pageRef.current) {
      const canvas = pageRef.current.querySelector('canvas');
      if (canvas) {
        onRenderComplete(pageNumber, canvas);
      }
    }
  }, [pageNumber, onRenderComplete]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Page break indicator */}
      {pageNumber > 1 && (
        <div className="w-full flex items-center gap-3 py-3 px-4 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
            Page {pageNumber}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}
      <div
        data-page={pageNumber}
        ref={pageRef}
        className="flex justify-center"
      >
        {cached ? (
          // Show cached image instantly
          <img
            src={cached.dataUrl}
            width={cached.width}
            height={cached.height}
            alt={`Page ${pageNumber}`}
            className="shadow-[var(--shadow-lg)] rounded-sm"
            style={{ width: pageWidth, height: 'auto' }}
            draggable={false}
          />
        ) : (
          // Render from PDF and cache after
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-[var(--shadow-lg)] rounded-sm"
            onRenderSuccess={handleRenderSuccess}
            loading={
              <div 
                className="flex items-center justify-center bg-muted/30 rounded-sm"
                style={{ width: pageWidth, height: estimatedHeight }}
              >
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          />
        )}
      </div>
    </div>
  );
});

PdfPage.displayName = 'PdfPage';

export function VirtualizedPdfViewer({
  numPages,
  pageWidth,
  registerPage,
  scrollContainerRef,
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);
  // Force re-render when cache updates so cached pages show instantly
  const [cacheVersion, setCacheVersion] = useState(0);

  // Clear cache when component mounts (new document)
  useEffect(() => {
    pageCache.clear();
    setCacheVersion(0);
  }, []);

  // Estimated height per page (page + page break + gap)
  const estimatedPageHeight = Math.round(pageWidth * 1.4) + 60;

  // Wait for scroll container to be available
  useEffect(() => {
    if (scrollContainerRef.current) {
      setIsReady(true);
    }
  }, [scrollContainerRef]);

  const handleRenderComplete = useCallback((pageNumber: number, canvas: HTMLCanvasElement) => {
    // Convert canvas to data URL and cache
    try {
      const dataUrl = canvas.toDataURL('image/webp', 0.85);
      cachePage(pageNumber, {
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      });
      // Trigger re-render so next time this page shows cached version
      setCacheVersion(v => v + 1);
    } catch (e) {
      // Canvas might be tainted, ignore caching
      console.warn('Could not cache page:', e);
    }
  }, []);

  const virtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedPageHeight,
    overscan: 2,
    paddingStart: 16,
    paddingEnd: 16,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{
        height: virtualizer.getTotalSize(),
      }}
      data-cache-version={cacheVersion}
    >
      {virtualItems.map((virtualItem) => {
        const pageNumber = virtualItem.index + 1;
        
        return (
          <div
            key={virtualItem.key}
            className="absolute top-0 left-0 w-full flex justify-center"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PdfPage
              pageNumber={pageNumber}
              pageWidth={pageWidth}
              registerPage={registerPage}
              onRenderComplete={handleRenderComplete}
            />
          </div>
        );
      })}
    </div>
  );
}
