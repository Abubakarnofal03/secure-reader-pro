import { useRef, useCallback, useEffect, useState, memo, RefObject, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Document, Page } from 'react-pdf';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Segment {
  id: string;
  segment_index: number;
  start_page: number;
  end_page: number;
  file_path: string;
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
}

// Segmented page component - renders a page from a specific segment
const SegmentedPdfPage = memo(({ 
  globalPageNumber,
  segment,
  segmentUrl,
  scaledWidth,
  estimatedHeight,
  registerPage,
  isLoadingUrl,
}: { 
  globalPageNumber: number;
  segment: Segment;
  segmentUrl: string | null;
  scaledWidth: number;
  estimatedHeight: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  isLoadingUrl: boolean;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  
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

  // Show loading while fetching segment URL
  if (!segmentUrl || isLoadingUrl) {
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

  return (
    <div
      data-page={globalPageNumber}
      ref={pageRef}
      className="flex justify-center"
      style={{ width: scaledWidth }}
    >
      <Document
        file={segmentUrl}
        loading={null}
        error={null}
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
  return prevProps.globalPageNumber === nextProps.globalPageNumber && 
         prevProps.scaledWidth === nextProps.scaledWidth &&
         prevProps.estimatedHeight === nextProps.estimatedHeight &&
         prevProps.segmentUrl === nextProps.segmentUrl &&
         prevProps.isLoadingUrl === nextProps.isLoadingUrl &&
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
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);

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

  const virtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedPageHeight,
    // Higher overscan for smoother fast scrolling
    overscan: 5,
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

          const segmentUrl = getSegmentUrl!(segment.segment_index);
          
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
                segmentUrl={segmentUrl}
                scaledWidth={scaledWidth}
                estimatedHeight={scaledHeight}
                registerPage={stableRegisterPage}
                isLoadingUrl={isLoadingSegment && !segmentUrl}
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
