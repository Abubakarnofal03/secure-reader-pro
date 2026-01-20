import { useRef, useCallback, useEffect, useState, memo, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import { usePageCache } from '@/hooks/usePageCache';

interface VirtualizedPdfViewerProps {
  numPages: number;
  pageWidth: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  pdfDocument: unknown;
  contentId: string;
  scrollContainerRef: RefObject<HTMLDivElement>;
}

// Memoized page component to prevent unnecessary re-renders
const PdfPage = memo(({ 
  pageNumber, 
  pageWidth,
  registerPage,
  cachedImage,
  onPageRendered,
}: { 
  pageNumber: number; 
  pageWidth: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  cachedImage: string | null;
  onPageRendered: (pageNumber: number, canvas: HTMLCanvasElement) => void;
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

  const handleRenderSuccess = useCallback(() => {
    // After render, capture the canvas for caching
    if (pageRef.current) {
      const canvas = pageRef.current.querySelector('canvas');
      if (canvas) {
        onPageRendered(pageNumber, canvas);
      }
    }
  }, [pageNumber, onPageRendered]);

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
        {cachedImage ? (
          // Show cached image for instant display
          <img 
            src={cachedImage} 
            alt={`Page ${pageNumber}`}
            width={pageWidth}
            height={estimatedHeight}
            className="shadow-[var(--shadow-lg)] rounded-sm"
            style={{ width: pageWidth, height: 'auto' }}
            draggable={false}
          />
        ) : (
          // Render from PDF
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
  contentId,
  scrollContainerRef,
}: VirtualizedPdfViewerProps) {
  const [isReady, setIsReady] = useState(false);
  
  // In-memory page cache
  const { getCachedPage, cachePage } = usePageCache({
    maxCachedPages: 30,
    contentId,
  });

  // Estimated height per page (page + page break + gap)
  const estimatedPageHeight = Math.round(pageWidth * 1.4) + 60; // page height + page break indicator

  // Wait for scroll container to be available
  useEffect(() => {
    if (scrollContainerRef.current) {
      setIsReady(true);
    }
  }, [scrollContainerRef]);

  const virtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedPageHeight,
    overscan: 2, // Render 2 pages above/below viewport
    paddingStart: 16,
    paddingEnd: 16,
  });

  const handlePageRendered = useCallback((pageNumber: number, canvas: HTMLCanvasElement) => {
    // Convert canvas to blob URL and cache it
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        cachePage(pageNumber, url);
      }
    }, 'image/webp', 0.85);
  }, [cachePage]);

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
        const cachedImage = getCachedPage(pageNumber);
        
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
              cachedImage={cachedImage}
              onPageRendered={handlePageRendered}
            />
          </div>
        );
      })}
    </div>
  );
}
