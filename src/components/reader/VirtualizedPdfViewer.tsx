import { useRef, useCallback, useEffect, useState, memo, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Document, Page } from 'react-pdf';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useSegmentDocumentCache } from '@/hooks/useSegmentDocumentCache';

interface Segment {
  id: string;
  segment_index: number;
  start_page: number;
  end_page: number;
  file_path: string;
}

// API exposed via onReady callback for external scroll control
export interface VirtualizedPdfViewerApi {
  scrollToPage: (page: number, smooth?: boolean) => void;
}

interface VirtualizedPdfViewerProps {
  numPages: number;
  pageWidth: number;
  scale: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
  gestureTransform?: string;
  // New segment-related props
  segments?: Segment[];
  getSegmentUrl?: (segmentIndex: number) => string | null;
  getSegmentForPage?: (pageNumber: number) => Segment | null;
  isLoadingSegment?: boolean;
  // Legacy mode: single document URL (for backwards compatibility)
  legacyMode?: boolean;
  // Callback to expose scroll API for external navigation control
  onReady?: (api: VirtualizedPdfViewerApi) => void;
}

// Segmented page component - renders a page from a specific segment
// Now accepts a STABLE cached URL to prevent re-downloads
const SegmentedPdfPage = memo(({ 
  globalPageNumber,
  segment,
  cachedUrl,
  scaledWidth,
  estimatedHeight,
  registerPage,
  onLoadError,
}: { 
  globalPageNumber: number;
  segment: { segment_index: number; start_page: number; end_page: number };
  cachedUrl: string | null;
  scaledWidth: number;
  estimatedHeight: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  onLoadError?: (segmentIndex: number) => void;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  
  // Calculate local page number within the segment
  const localPageNumber = globalPageNumber - segment.start_page + 1;

  // Register page element for scroll detection
  useEffect(() => {
    if (pageRef.current) {
      registerPage(globalPageNumber, pageRef.current);
    }
    return () => {
      registerPage(globalPageNumber, null);
    };
  }, [globalPageNumber, registerPage]);

  // Reset load state when URL changes
  useEffect(() => {
    if (cachedUrl) {
      setLoadFailed(false);
    }
  }, [cachedUrl]);

  // Handle load error
  const handleLoadError = useCallback(() => {
    setLoadFailed(true);
    onLoadError?.(segment.segment_index);
  }, [segment.segment_index, onLoadError]);

  // Show loading while waiting for URL
  if (!cachedUrl) {
    return (
      <div
        data-page={globalPageNumber}
        ref={pageRef}
        className="flex justify-center"
        style={{ width: scaledWidth }}
      >
        <div 
          className="flex items-center justify-center bg-muted/30 rounded-sm"
          style={{ width: scaledWidth, height: estimatedHeight }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Show error state
  if (loadFailed) {
    return (
      <div
        data-page={globalPageNumber}
        ref={pageRef}
        className="flex justify-center"
        style={{ width: scaledWidth }}
      >
        <div 
          className="flex flex-col items-center justify-center bg-destructive/10 rounded-sm gap-2"
          style={{ width: scaledWidth, height: estimatedHeight }}
        >
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-xs text-destructive">Failed to load</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-page={globalPageNumber}
      ref={pageRef}
      className="flex justify-center"
      style={{ width: scaledWidth }}
    >
      <Document
        file={cachedUrl}
        loading={null}
        error={
          <div 
            className="flex flex-col items-center justify-center bg-destructive/10 rounded-sm gap-2"
            style={{ width: scaledWidth, height: estimatedHeight }}
          >
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-xs text-destructive">Failed to load document</span>
          </div>
        }
        onLoadError={handleLoadError}
      >
        <Page
          pageNumber={localPageNumber}
          width={scaledWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-[var(--shadow-lg)] rounded-sm"
          loading={
            <div 
              className="flex items-center justify-center bg-muted/30 rounded-sm"
              style={{ width: scaledWidth, height: estimatedHeight }}
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
          error={
            <div 
              className="flex items-center justify-center bg-destructive/10 rounded-sm"
              style={{ width: scaledWidth, height: estimatedHeight }}
            >
              <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
              <span className="text-xs text-destructive">Failed to load page</span>
            </div>
          }
        />
      </Document>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if essential props change
  // IMPORTANT: cachedUrl should be STABLE once loaded, so this rarely triggers
  return prevProps.globalPageNumber === nextProps.globalPageNumber && 
         prevProps.scaledWidth === nextProps.scaledWidth &&
         prevProps.estimatedHeight === nextProps.estimatedHeight &&
         prevProps.cachedUrl === nextProps.cachedUrl &&
         prevProps.segment.segment_index === nextProps.segment.segment_index;
});

SegmentedPdfPage.displayName = 'SegmentedPdfPage';

// Legacy page component - renders from parent Document (backwards compatibility)
const LegacyPdfPage = memo(({ 
  pageNumber, 
  scaledWidth,
  estimatedHeight,
  registerPage,
}: { 
  pageNumber: number; 
  scaledWidth: number;
  estimatedHeight: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);

  // Register page element for scroll detection
  useEffect(() => {
    if (pageRef.current) {
      registerPage(pageNumber, pageRef.current);
    }
    return () => {
      registerPage(pageNumber, null);
    };
  }, [pageNumber, registerPage]);

  return (
    <div
      data-page={pageNumber}
      ref={pageRef}
      className="flex justify-center"
      style={{ width: scaledWidth }}
    >
      <Page
        pageNumber={pageNumber}
        width={scaledWidth}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="shadow-[var(--shadow-lg)] rounded-sm"
        loading={
          <div 
            className="flex items-center justify-center bg-muted/30 rounded-sm"
            style={{ width: scaledWidth, height: estimatedHeight }}
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
        error={
          <div 
            className="flex items-center justify-center bg-destructive/10 rounded-sm"
            style={{ width: scaledWidth, height: estimatedHeight }}
          >
            <span className="text-xs text-destructive">Failed to load page</span>
          </div>
        }
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.pageNumber === nextProps.pageNumber && 
         prevProps.scaledWidth === nextProps.scaledWidth &&
         prevProps.estimatedHeight === nextProps.estimatedHeight;
});

LegacyPdfPage.displayName = 'LegacyPdfPage';

export function VirtualizedPdfViewer({
  numPages,
  pageWidth,
  scale,
  registerPage,
  scrollContainerRef,
  gestureTransform,
  segments,
  getSegmentUrl,
  getSegmentForPage,
  isLoadingSegment = false,
  legacyMode = false,
  onReady,
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);

  // Document cache to prevent constant re-downloads when URLs refresh
  const { getStableUrl, markFailed } = useSegmentDocumentCache();

  // Calculate scaled dimensions
  const scaledWidth = Math.round(pageWidth * scale);
  const scaledHeight = Math.round(scaledWidth * 1.4); // Maintain aspect ratio
  
  // Gap between pages
  const pageGap = 16;
  const estimatedPageHeight = scaledHeight + pageGap;

  // Determine if we're in segmented mode
  const isSegmentedMode = !legacyMode && segments && segments.length > 0 && getSegmentUrl && getSegmentForPage;

  // Wait for scroll container to be available
  useEffect(() => {
    if (scrollContainerRef.current) {
      setIsReady(true);
    }
  }, [scrollContainerRef]);

  // Stable registerPage callback to prevent re-renders
  const stableRegisterPage = useCallback((pageNumber: number, element: HTMLDivElement | null) => {
    registerPage(pageNumber, element);
  }, [registerPage]);

  // Handle segment load failure - clear from cache so we try fresh URL
  const handleSegmentLoadError = useCallback((segmentIndex: number) => {
    console.warn(`[VirtualizedPdfViewer] Segment ${segmentIndex} failed to load, clearing cache`);
    markFailed(segmentIndex);
  }, [markFailed]);

  const virtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedPageHeight,
    // Higher overscan for smoother fast scrolling
    overscan: 5,
    paddingStart: 16,
    paddingEnd: 16,
  });

  // Expose scroll API for external navigation (jump to page, resume reading)
  const scrollToPage = useCallback((page: number, smooth: boolean = true) => {
    const pageIndex = page - 1; // Convert 1-based page to 0-based index
    if (pageIndex >= 0 && pageIndex < numPages) {
      virtualizer.scrollToIndex(pageIndex, { 
        align: 'start',
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, [virtualizer, numPages]);

  // Call onReady when component is ready with the scroll API
  useEffect(() => {
    if (isReady && onReady) {
      onReady({ scrollToPage });
    }
  }, [isReady, onReady, scrollToPage]);

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
      className="relative"
      style={{
        height: virtualizer.getTotalSize(),
        width: scaledWidth,
        margin: '0 auto',
        // Apply gesture transform for instant visual feedback during pinch
        transform: gestureTransform,
        transformOrigin: 'center top',
        // Smooth transition only when NOT gesturing (on commit)
        transition: gestureTransform ? 'none' : 'transform 0.15s ease-out',
      }}
    >
      {virtualItems.map((virtualItem) => {
        const globalPageNumber = virtualItem.index + 1;
        
        // Segmented mode: each page gets its own Document
        if (isSegmentedMode) {
          const segment = getSegmentForPage!(globalPageNumber);
          
          if (!segment) {
            // Page not found in any segment - show error
            return (
              <div
                key={`page-${globalPageNumber}-${scale}`}
                data-index={virtualItem.index}
                className="absolute top-0 left-0"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                  width: scaledWidth,
                }}
              >
                <div 
                  className="flex items-center justify-center bg-destructive/10 rounded-sm"
                  style={{ width: scaledWidth, height: scaledHeight }}
                >
                  <span className="text-xs text-destructive">Page not found</span>
                </div>
              </div>
            );
          }

          // Get fresh URL from segment manager
          const freshUrl = getSegmentUrl!(segment.segment_index);
          // Get stable URL from cache - prevents re-downloads when URL refreshes
          const cachedUrl = getStableUrl(segment.segment_index, freshUrl);
          
          return (
            <div
              key={`page-${globalPageNumber}-seg${segment.segment_index}-${scale}`}
              data-index={virtualItem.index}
              className="absolute top-0 left-0"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
                width: scaledWidth,
              }}
            >
              <SegmentedPdfPage
                globalPageNumber={globalPageNumber}
                segment={segment}
                cachedUrl={cachedUrl}
                scaledWidth={scaledWidth}
                estimatedHeight={scaledHeight}
                registerPage={stableRegisterPage}
                onLoadError={handleSegmentLoadError}
              />
            </div>
          );
        }
        
        // Legacy mode: pages rendered from parent Document context
        return (
          <div
            key={`page-${globalPageNumber}-${scale}`}
            data-index={virtualItem.index}
            className="absolute top-0 left-0"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
              width: scaledWidth,
            }}
          >
            <LegacyPdfPage
              pageNumber={globalPageNumber}
              scaledWidth={scaledWidth}
              estimatedHeight={scaledHeight}
              registerPage={stableRegisterPage}
            />
          </div>
        );
      })}
    </div>
  );
}
