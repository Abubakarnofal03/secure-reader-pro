import { useRef, useCallback, useEffect, useState, memo, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';

interface VirtualizedPdfViewerProps {
  numPages: number;
  pageWidth: number;
  scale: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
}

// Page component - renders at scaled size
const PdfPage = memo(({ 
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
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.pageNumber === nextProps.pageNumber && 
         prevProps.scaledWidth === nextProps.scaledWidth &&
         prevProps.estimatedHeight === nextProps.estimatedHeight;
});

PdfPage.displayName = 'PdfPage';

export function VirtualizedPdfViewer({
  numPages,
  pageWidth,
  scale,
  registerPage,
  scrollContainerRef,
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);

  // Calculate scaled dimensions - this is the key to re-render zoom
  const scaledWidth = Math.round(pageWidth * scale);
  const scaledHeight = Math.round(scaledWidth * 1.4); // Maintain aspect ratio
  
  // Total height per item including page break indicator (60px) 
  const estimatedPageHeight = scaledHeight + 60;

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
            key={`page-${pageNumber}-${scale}`}
            data-index={virtualItem.index}
            className="absolute top-0 left-0 w-full flex justify-center"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PdfPage
              pageNumber={pageNumber}
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
