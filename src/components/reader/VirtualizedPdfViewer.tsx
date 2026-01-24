import { useRef, useCallback, useEffect, useState, memo, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useSegmentDocumentCache } from '@/hooks/useSegmentDocumentCache';
import { PageSeparator } from './PageSeparator';

// Import react-pdf layer styles for proper text/annotation rendering
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// PDF.js options for proper rendering of fonts, characters, and embedded content
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

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
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
  // Segment-related props
  segments?: Segment[];
  getSegmentUrl?: (segmentIndex: number) => string | null;
  getSegmentForPage?: (pageNumber: number) => Segment | null;
  isLoadingSegment?: boolean;
  // Legacy mode: single document URL (for backwards compatibility)
  legacyMode?: boolean;
  // Callback to expose scroll API for external navigation control
  onReady?: (api: VirtualizedPdfViewerApi) => void;
  // Total pages for page separator display
  totalPages?: number;
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
  totalPages,
  onLoadError,
  onPageRendered,
}: { 
  globalPageNumber: number;
  segment: { segment_index: number; start_page: number; end_page: number };
  cachedUrl: string | null;
  scaledWidth: number;
  estimatedHeight: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  totalPages: number;
  onLoadError?: (segmentIndex: number) => void;
  onPageRendered?: (pageNumber: number, height: number) => void;
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

  // Handle successful render
  const handleRenderSuccess = useCallback((page: { height: number }) => {
    onPageRendered?.(globalPageNumber, page.height);
  }, [globalPageNumber, onPageRendered]);

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
      className="flex flex-col items-center"
      style={{ width: scaledWidth }}
    >
      <Document
        file={cachedUrl}
        loading={null}
        error={null}
        onLoadError={handleLoadError}
        options={pdfOptions}
      >
        <Page
          pageNumber={localPageNumber}
          width={scaledWidth}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          className="shadow-[var(--shadow-lg)] rounded-sm pdf-page-secure"
          onRenderSuccess={handleRenderSuccess}
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
      {/* Page separator */}
      <PageSeparator pageNumber={globalPageNumber} totalPages={totalPages} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if essential props change
  // IMPORTANT: cachedUrl should be STABLE once loaded, so this rarely triggers
  return prevProps.globalPageNumber === nextProps.globalPageNumber && 
         prevProps.scaledWidth === nextProps.scaledWidth &&
         prevProps.estimatedHeight === nextProps.estimatedHeight &&
         prevProps.cachedUrl === nextProps.cachedUrl &&
         prevProps.totalPages === nextProps.totalPages &&
         prevProps.segment.segment_index === nextProps.segment.segment_index;
});

SegmentedPdfPage.displayName = 'SegmentedPdfPage';

// Legacy page component - renders from parent Document (backwards compatibility)
const LegacyPdfPage = memo(({ 
  pageNumber, 
  scaledWidth,
  estimatedHeight,
  registerPage,
  totalPages,
  onPageRendered,
}: { 
  pageNumber: number; 
  scaledWidth: number;
  estimatedHeight: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  totalPages: number;
  onPageRendered?: (pageNumber: number, height: number) => void;
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

  // Handle successful render
  const handleRenderSuccess = useCallback((page: { height: number }) => {
    onPageRendered?.(pageNumber, page.height);
  }, [pageNumber, onPageRendered]);

  return (
    <div
      data-page={pageNumber}
      ref={pageRef}
      className="flex flex-col items-center"
      style={{ width: scaledWidth }}
    >
      <Page
        pageNumber={pageNumber}
        width={scaledWidth}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        className="shadow-[var(--shadow-lg)] rounded-sm pdf-page-secure"
        onRenderSuccess={handleRenderSuccess}
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
      {/* Page separator */}
      <PageSeparator pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.pageNumber === nextProps.pageNumber && 
         prevProps.scaledWidth === nextProps.scaledWidth &&
         prevProps.estimatedHeight === nextProps.estimatedHeight &&
         prevProps.totalPages === nextProps.totalPages;
});

LegacyPdfPage.displayName = 'LegacyPdfPage';

export function VirtualizedPdfViewer({
  numPages,
  pageWidth,
  registerPage,
  scrollContainerRef,
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

  // Pages render at the given width (native zoom via width). Height varies per PDF page.
  const scaledWidth = pageWidth;
  // Conservative starting estimate; we will MEASURE actual heights after render.
  const scaledHeight = Math.round(scaledWidth * 1.4);
  
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
    // Measure real rendered heights so pages never overlap/crop when zoom changes.
    measureElement: (el) => el.getBoundingClientRect().height,
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
      className="relative mx-auto"
      style={{
        height: virtualizer.getTotalSize(),
        // Use exact page width to prevent any cropping
        width: scaledWidth,
        // Ensure centering when not zoomed
        minWidth: scaledWidth,
      }}
    >
      {virtualItems.map((virtualItem) => {
        const pageNumber = virtualItem.index + 1;
        
        // Segmented mode: each page gets its own Document
        if (isSegmentedMode) {
          const segment = getSegmentForPage!(pageNumber);
          
          if (!segment) {
            // Page not found in any segment - show error
            return (
              <div
                key={`page-${pageNumber}`}
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
              key={`page-${pageNumber}-seg${segment.segment_index}`}
              data-index={virtualItem.index}
              className="absolute top-0 left-0"
                ref={virtualizer.measureElement}
              style={{
                transform: `translateY(${virtualItem.start}px)`,
                width: scaledWidth,
              }}
            >
              <SegmentedPdfPage
                globalPageNumber={pageNumber}
                segment={segment}
                cachedUrl={cachedUrl}
                scaledWidth={scaledWidth}
                estimatedHeight={scaledHeight}
                registerPage={stableRegisterPage}
                totalPages={numPages}
                onLoadError={handleSegmentLoadError}
              />
            </div>
          );
        }
        
        // Legacy mode: pages rendered from parent Document context
        return (
          <div
            key={`page-${pageNumber}`}
            data-index={virtualItem.index}
            className="absolute top-0 left-0"
            ref={virtualizer.measureElement}
            style={{
              transform: `translateY(${virtualItem.start}px)`,
              width: scaledWidth,
            }}
          >
            <LegacyPdfPage
              pageNumber={pageNumber}
              scaledWidth={scaledWidth}
              estimatedHeight={scaledHeight}
              registerPage={stableRegisterPage}
              totalPages={numPages}
            />
          </div>
        );
      })}
    </div>
  );
}
