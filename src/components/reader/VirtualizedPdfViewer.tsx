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
  gestureTransform?: string;
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
  gestureTransform,
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);

  // Calculate scaled dimensions
  const scaledWidth = Math.round(pageWidth * scale);
  const scaledHeight = Math.round(scaledWidth * 1.4); // Maintain aspect ratio
  
  // Gap between pages
  const pageGap = 16;
  const estimatedPageHeight = scaledHeight + pageGap;

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
        const pageNumber = virtualItem.index + 1;
        
        return (
          <div
            key={`page-${pageNumber}-${scale}`}
            data-index={virtualItem.index}
            className="absolute top-0 left-0"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
              width: scaledWidth,
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
