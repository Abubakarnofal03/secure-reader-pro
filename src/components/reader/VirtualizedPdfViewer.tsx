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

// Simple page component - no caching, just render reliably
const PdfPage = memo(({ 
  pageNumber, 
  pageWidth,
  registerPage,
}: { 
  pageNumber: number; 
  pageWidth: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const estimatedHeight = Math.round(pageWidth * 1.4);

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
        <Page
          pageNumber={pageNumber}
          width={pageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-[var(--shadow-lg)] rounded-sm"
          loading={
            <div 
              className="flex items-center justify-center bg-muted/30 rounded-sm"
              style={{ width: pageWidth, height: estimatedHeight }}
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
          error={
            <div 
              className="flex items-center justify-center bg-destructive/10 rounded-sm"
              style={{ width: pageWidth, height: estimatedHeight }}
            >
              <span className="text-xs text-destructive">Failed to load page</span>
            </div>
          }
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.pageNumber === nextProps.pageNumber && 
         prevProps.pageWidth === nextProps.pageWidth;
});

PdfPage.displayName = 'PdfPage';

export function VirtualizedPdfViewer({
  numPages,
  pageWidth,
  registerPage,
  scrollContainerRef,
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);

  // Estimated height per page (page + page break + gap)
  const estimatedPageHeight = Math.round(pageWidth * 1.4) + 60;

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
    // Higher overscan for smoother fast scrolling - keep more pages in DOM
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
      className="relative w-full"
      style={{
        height: virtualizer.getTotalSize(),
      }}
    >
      {virtualItems.map((virtualItem) => {
        const pageNumber = virtualItem.index + 1;
        
        return (
          <div
            key={`page-${pageNumber}`}
            data-index={virtualItem.index}
            className="absolute top-0 left-0 w-full flex justify-center"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PdfPage
              pageNumber={pageNumber}
              pageWidth={pageWidth}
              registerPage={stableRegisterPage}
            />
          </div>
        );
      })}
    </div>
  );
}
