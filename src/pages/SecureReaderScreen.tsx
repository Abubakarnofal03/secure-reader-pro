import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Loader2, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Watermark } from '@/components/Watermark';
import { SecurityWarning } from '@/components/SecurityWarning';
import { GoToPageDialog } from '@/components/reader/GoToPageDialog';
import { ResumeReadingToast } from '@/components/reader/ResumeReadingToast';
import { ScrollProgressBar } from '@/components/reader/ScrollProgressBar';
import { Progress } from '@/components/ui/progress';
import { getDeviceId } from '@/lib/device';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { usePrivacyScreen } from '@/hooks/usePrivacyScreen';
import { useScrollPageDetection } from '@/hooks/useScrollPageDetection';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ContentDetails {
  title: string;
  pdfBase64: string;
  watermark: {
    userName: string;
    userEmail: string;
    timestamp: string;
    sessionId: string;
  };
}

const MAX_RECENT_PAGES = 5;

export default function SecureReaderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  
  // Security monitoring for iOS screenshot/recording detection
  const { isRecording, screenshotDetected, clearScreenshotAlert } = useSecurityMonitor();
  
  // Privacy screen protection - TEMPORARILY DISABLED for testing
  usePrivacyScreen(false);
  
  const [content, setContent] = useState<ContentDetails | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [baseWidth, setBaseWidth] = useState(window.innerWidth - 32);
  const [sessionId] = useState(() => crypto.randomUUID().substring(0, 8));
  const [showGoToDialog, setShowGoToDialog] = useState(false);
  const [recentPages, setRecentPages] = useState<number[]>([]);
  const [hasInitializedPage, setHasInitializedPage] = useState(false);

  // Scroll-based page detection
  const { 
    containerRef: scrollContainerRef, 
    registerPage, 
    currentPage, 
    scrollToPage 
  } = useScrollPageDetection({
    totalPages: numPages,
    enabled: numPages > 0,
  });

  // Reading progress hook
  const {
    savedProgress,
    isLoading: isProgressLoading,
    showResumePrompt,
    dismissResumePrompt,
    saveProgress,
    saveProgressImmediate,
  } = useReadingProgress({
    contentId: id,
    totalPages: numPages,
  });

  // Pinch-to-zoom hook - returns transform state and controls
  const { transform, zoomIn, zoomOut, resetZoom, scale } = usePinchZoom({
    minScale: 0.5,
    maxScale: 4,
    containerRef: contentRef as React.RefObject<HTMLElement>,
    contentRef: pdfWrapperRef as React.RefObject<HTMLElement>,
  });

  const pageWidth = baseWidth;

  // Initialize to saved page after progress is loaded
  useEffect(() => {
    if (!isProgressLoading && savedProgress && !hasInitializedPage && numPages > 0) {
      // Don't auto-navigate, let user decide via resume prompt
      setHasInitializedPage(true);
    }
  }, [isProgressLoading, savedProgress, hasInitializedPage, numPages]);

  // Track recent pages
  useEffect(() => {
    if (currentPage > 0 && hasInitializedPage) {
      setRecentPages((prev) => {
        const filtered = prev.filter((p) => p !== currentPage);
        return [currentPage, ...filtered].slice(0, MAX_RECENT_PAGES);
      });
    }
  }, [currentPage, hasInitializedPage]);

  // Save progress when page changes
  useEffect(() => {
    if (currentPage > 0 && numPages > 0 && hasInitializedPage) {
      saveProgress(currentPage);
    }
  }, [currentPage, numPages, saveProgress, hasInitializedPage]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (currentPage > 0 && numPages > 0) {
        saveProgressImmediate(currentPage);
      }
    };
  }, [currentPage, numPages, saveProgressImmediate]);

  // Prevent all copy/paste/context menu
  useEffect(() => {
    const preventActions = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventKeyboard = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+P, Ctrl+S, PrintScreen
      if (
        (e.ctrlKey && ['c', 'v', 'p', 's', 'a'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', preventActions);
    document.addEventListener('copy', preventActions);
    document.addEventListener('cut', preventActions);
    document.addEventListener('paste', preventActions);
    document.addEventListener('keydown', preventKeyboard);
    document.addEventListener('dragstart', preventActions);
    document.addEventListener('selectstart', preventActions);

    return () => {
      document.removeEventListener('contextmenu', preventActions);
      document.removeEventListener('copy', preventActions);
      document.removeEventListener('cut', preventActions);
      document.removeEventListener('paste', preventActions);
      document.removeEventListener('keydown', preventKeyboard);
      document.removeEventListener('dragstart', preventActions);
      document.removeEventListener('selectstart', preventActions);
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setBaseWidth(containerRef.current.clientWidth - 32);
      } else {
        setBaseWidth(window.innerWidth - 32);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch content via edge function
  useEffect(() => {
    const fetchSecureContent = async () => {
      if (!id) {
        setError('No content ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoadingProgress(10);
        const deviceId = await getDeviceId();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError('Please log in to view content');
          setLoading(false);
          return;
        }

        setLoadingProgress(30);

        const response = await supabase.functions.invoke('render-pdf-page', {
          body: {
            content_id: id,
            page_number: 1,
            device_id: deviceId,
          },
        });

        setLoadingProgress(70);

        if (response.error) {
          throw new Error(response.error.message);
        }

        const data = response.data;

        if (data.error) {
          if (data.code === 'DEVICE_MISMATCH') {
            // Session hijacked - force logout
            await signOut();
            navigate('/login', { replace: true });
            return;
          }
          throw new Error(data.error);
        }

        setLoadingProgress(90);

        setContent({
          title: data.title,
          pdfBase64: data.pdfBase64,
          watermark: data.watermark,
        });

        setLoadingProgress(100);
      } catch (err) {
        console.error('Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    fetchSecureContent();
  }, [id, signOut, navigate]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setHasInitializedPage(true);
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      scrollToPage(page, 'smooth');
    }
  }, [numPages, scrollToPage]);

  const handleResume = useCallback(() => {
    if (savedProgress) {
      // Use setTimeout to ensure pages are rendered before scrolling
      setTimeout(() => {
        scrollToPage(savedProgress.currentPage, 'smooth');
      }, 100);
    }
    dismissResumePrompt();
  }, [savedProgress, dismissResumePrompt, scrollToPage]);

  const handleStartOver = useCallback(() => {
    scrollToPage(1, 'smooth');
    dismissResumePrompt();
  }, [dismissResumePrompt, scrollToPage]);

  const handleClose = useCallback(() => {
    // Save progress before closing
    if (currentPage > 0 && numPages > 0) {
      saveProgressImmediate(currentPage);
    }
    navigate('/library', { replace: true });
  }, [currentPage, numPages, saveProgressImmediate, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground mb-4">Loading document...</p>
        <div className="w-48">
          <Progress value={loadingProgress} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{loadingProgress}%</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-center text-muted-foreground mb-4">{error}</p>
        <button
          onClick={handleClose}
          className="text-sm font-medium text-primary hover:underline"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const pdfDataUri = content ? `data:application/pdf;base64,${content.pdfBase64}` : null;

  return (
    <div 
      ref={containerRef}
      className="flex h-screen flex-col bg-reader-bg secure-content safe-top safe-bottom overflow-hidden"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        height: '100dvh', // Use dynamic viewport height for mobile
      }}
    >
      {/* Scroll Progress Bar */}
      <ScrollProgressBar currentPage={currentPage} totalPages={numPages} />

      {/* Security Warning Overlay (iOS) */}
      <SecurityWarning
        isRecording={isRecording}
        screenshotDetected={screenshotDetected}
        onDismiss={clearScreenshotAlert}
      />

      {/* Resume Reading Toast */}
      <ResumeReadingToast
        show={showResumePrompt && numPages > 0}
        savedPage={savedProgress?.currentPage ?? 1}
        totalPages={numPages}
        onResume={handleResume}
        onStartOver={handleStartOver}
        onDismiss={dismissResumePrompt}
      />

      {/* Go to Page Dialog */}
      <GoToPageDialog
        open={showGoToDialog}
        onOpenChange={setShowGoToDialog}
        currentPage={currentPage}
        totalPages={numPages}
        onPageChange={goToPage}
        recentPages={recentPages}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
          <div className="text-center flex-1 mx-4">
            <h1 className="line-clamp-1 text-sm font-medium text-foreground">
              {content?.title}
            </h1>
            <button
              onClick={() => setShowGoToDialog(true)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Page {currentPage} of {numPages || '...'} • Tap to jump
            </button>
          </div>
          
          {/* Zoom Controls in Header */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-30 transition-all"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-w-[3rem]"
              title="Reset zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= 4}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-30 transition-all"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* PDF Viewer with Watermark - Continuous Scroll */}
      <main 
        ref={contentRef}
        className="relative flex-1 overflow-hidden"
      >
        {/* Enhanced Watermark */}
        <Watermark sessionId={sessionId} />
        
        {/* Scrollable PDF Container */}
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto overflow-x-hidden"
          style={{
            pointerEvents: 'auto',
            touchAction: scale > 1 ? 'none' : 'pan-y', // Allow vertical scroll when not zoomed
          }}
        >
          <div
            ref={pdfWrapperRef}
            className="flex flex-col items-center py-4 gap-4"
            style={{
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
              transformOrigin: 'top center',
              transition: 'none',
            }}
          >
            {pdfDataUri && (
              <Document
                file={pdfDataUri}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Loading PDF...</p>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center py-20">
                    <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                    <p className="text-muted-foreground">Failed to load document</p>
                    <p className="text-xs text-muted-foreground mt-1">The file may be too large or corrupted</p>
                  </div>
                }
              >
                {/* Render all pages for continuous scrolling */}
                {Array.from({ length: numPages }, (_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <div
                      key={pageNumber}
                      data-page={pageNumber}
                      ref={(el) => registerPage(pageNumber, el)}
                      className="flex justify-center"
                    >
                      <Page
                        pageNumber={pageNumber}
                        width={pageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="shadow-lg rounded-sm"
                        loading={
                          <div 
                            className="flex items-center justify-center bg-muted/30 rounded-sm"
                            style={{ width: pageWidth, height: pageWidth * 1.4 }}
                          >
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        }
                      />
                    </div>
                  );
                })}
              </Document>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
