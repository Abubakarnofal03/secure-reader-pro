import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Loader2, AlertTriangle, ZoomIn, ZoomOut, Menu, BookOpen } from 'lucide-react';
import { Document, pdfjs } from 'react-pdf';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Watermark } from '@/components/Watermark';
import { SecurityWarning } from '@/components/SecurityWarning';
import { GoToPageDialog } from '@/components/reader/GoToPageDialog';
import { ResumeReadingToast } from '@/components/reader/ResumeReadingToast';
import { ScrollProgressBar } from '@/components/reader/ScrollProgressBar';
import { FloatingPageIndicator } from '@/components/reader/FloatingPageIndicator';
import { TableOfContents } from '@/components/reader/TableOfContents';
import { VirtualizedPdfViewer } from '@/components/reader/VirtualizedPdfViewer';
import { Progress } from '@/components/ui/progress';
import { getDeviceId } from '@/lib/device';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { usePrivacyScreen } from '@/hooks/usePrivacyScreen';
import { useScrollPageDetection } from '@/hooks/useScrollPageDetection';
import { usePdfOutline } from '@/hooks/usePdfOutline';
import { useSignedUrlRefresh } from '@/hooks/useSignedUrlRefresh';
import { useSegmentManager } from '@/hooks/useSegmentManager';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ContentDetails {
  title: string;
  signedUrl: string;
  expiresAt: number;
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
  
  const { isRecording, screenshotDetected, clearScreenshotAlert } = useSecurityMonitor();
  // TEMPORARILY DISABLED for client presentation - set back to true when done
  usePrivacyScreen(false);
  
  const [content, setContent] = useState<ContentDetails | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [baseWidth, setBaseWidth] = useState(window.innerWidth - 32);
  const [sessionId] = useState(() => crypto.randomUUID().substring(0, 8));
  const [showGoToDialog, setShowGoToDialog] = useState(false);
  const [recentPages, setRecentPages] = useState<number[]>([]);
  const [hasInitializedPage, setHasInitializedPage] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [showToc, setShowToc] = useState(false);
  const [contentCategory, setContentCategory] = useState<string | null>(null);
  const [isLegacyContent, setIsLegacyContent] = useState(false);
  
  // Store the PDF URL in a ref so refreshes don't trigger re-renders
  const pdfUrlRef = useRef<string | null>(null);
  const expiresAtRef = useRef<number | null>(null);

  const { 
    containerRef: scrollContainerRef, 
    registerPage, 
    currentPage, 
    scrollToPage 
  } = useScrollPageDetection({
    totalPages: numPages,
    enabled: numPages > 0,
  });

  // Segment manager for segmented PDFs
  const {
    segments,
    isLoadingSegments,
    getSegmentForPage,
    getSegmentUrl,
    isLoadingSegment,
    totalPages: segmentedTotalPages,
    isSegmented,
  } = useSegmentManager({
    contentId: id,
    currentPage,
    enabled: hasAccess && !isLegacyContent && !loading,
  });

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

  // Hybrid pinch zoom - gesture for instant feedback, commit for crisp render
  // Use contentRef for touch detection (not scroll container) to avoid conflicts
  const { 
    scale, 
    visualScale,
    gestureTransform,
    isGesturing,
    zoomIn, 
    zoomOut, 
    resetZoom,
  } = usePinchZoom({
    minScale: 1,
    maxScale: 2,
    containerRef: contentRef as React.RefObject<HTMLElement>,
    scrollContainerRef: scrollContainerRef as React.RefObject<HTMLElement>,
  });

  const pageWidth = baseWidth;

  useEffect(() => {
    if (!isProgressLoading && savedProgress && !hasInitializedPage && numPages > 0) {
      setHasInitializedPage(true);
    }
  }, [isProgressLoading, savedProgress, hasInitializedPage, numPages]);

  useEffect(() => {
    if (currentPage > 0 && hasInitializedPage) {
      setRecentPages((prev) => {
        const filtered = prev.filter((p) => p !== currentPage);
        return [currentPage, ...filtered].slice(0, MAX_RECENT_PAGES);
      });
    }
  }, [currentPage, hasInitializedPage]);

  useEffect(() => {
    if (currentPage > 0 && numPages > 0 && hasInitializedPage) {
      saveProgress(currentPage);
    }
  }, [currentPage, numPages, saveProgress, hasInitializedPage]);

  useEffect(() => {
    return () => {
      if (currentPage > 0 && numPages > 0) {
        saveProgressImmediate(currentPage);
      }
    };
  }, [currentPage, numPages, saveProgressImmediate]);

  useEffect(() => {
    const preventActions = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventKeyboard = (e: KeyboardEvent) => {
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

  useEffect(() => {
    const checkContentAccess = async () => {
      if (!id || !profile) {
        setCheckingAccess(false);
        return;
      }

      try {
        if (profile.role === 'admin') {
          setHasAccess(true);
          setCheckingAccess(false);
          return;
        }

        const { data: access, error: accessError } = await supabase
          .from('user_content_access')
          .select('id')
          .eq('user_id', profile.id)
          .eq('content_id', id)
          .maybeSingle();

        if (accessError) {
          console.error('Error checking access:', accessError);
          setError('Failed to verify content access');
          setCheckingAccess(false);
          return;
        }

        if (!access) {
          setError('You have not purchased this content. Please purchase it from the library to access.');
          setHasAccess(false);
          setCheckingAccess(false);
          setLoading(false);
          return;
        }

        setHasAccess(true);
        setCheckingAccess(false);
      } catch (err) {
        console.error('Access check error:', err);
        setError('Failed to verify content access');
        setCheckingAccess(false);
      }
    };

    checkContentAccess();
  }, [id, profile]);

  // Check if content is segmented or legacy, then fetch appropriately
  useEffect(() => {
    if (checkingAccess || !hasAccess) return;

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

        // First, check if this content has segments
        const { data: segmentCheck, error: segmentError } = await supabase
          .from('content_segments')
          .select('id')
          .eq('content_id', id)
          .limit(1);

        if (segmentError) {
          console.error('Error checking segments:', segmentError);
        }

        const hasSegments = segmentCheck && segmentCheck.length > 0;
        
        if (hasSegments) {
          // Segmented content - don't call render-pdf-page, use segment manager instead
          setIsLegacyContent(false);
          setLoadingProgress(50);

          // Fetch content metadata (title, watermark info) directly
          const { data: contentData, error: contentError } = await supabase
            .from('content')
            .select('title, total_pages')
            .eq('id', id)
            .single();

          if (contentError) {
            throw new Error('Failed to load content metadata');
          }

          // Fetch profile for watermark
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', session.user.id)
            .single();

          setLoadingProgress(90);

          setContent({
            title: contentData.title,
            signedUrl: '', // Will be loaded per-segment
            expiresAt: 0,
            watermark: {
              userName: profileData?.name || profileData?.email?.split('@')[0] || 'User',
              userEmail: profileData?.email || '',
              timestamp: new Date().toISOString(),
              sessionId: crypto.randomUUID().substring(0, 8),
            },
          });

          // Set numPages from content metadata for segmented content
          if (contentData.total_pages) {
            setNumPages(contentData.total_pages);
          }

          setLoadingProgress(100);
        } else {
          // Legacy content - use render-pdf-page for single file
          setIsLegacyContent(true);
          setLoadingProgress(50);

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
              await signOut();
              navigate('/login', { replace: true });
              return;
            }
            throw new Error(data.error);
          }

          setLoadingProgress(90);

          // Store URL in refs to avoid re-renders on refresh
          pdfUrlRef.current = data.signedUrl;
          expiresAtRef.current = data.expiresAt || Date.now() + (5 * 60 * 1000);

          setContent({
            title: data.title,
            signedUrl: data.signedUrl,
            expiresAt: data.expiresAt || Date.now() + (5 * 60 * 1000),
            watermark: data.watermark,
          });

          setLoadingProgress(100);
        }
      } catch (err) {
        console.error('Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    fetchSecureContent();
  }, [id, signOut, navigate, checkingAccess, hasAccess]);

  // Fetch content category
  useEffect(() => {
    const fetchCategory = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('content')
        .select('category')
        .eq('id', id)
        .single();
      if (data?.category) {
        setContentCategory(data.category);
      }
    };
    fetchCategory();
  }, [id]);

  const { outline, hasOutline, loading: outlineLoading } = usePdfOutline(pdfDocument);

  // Auto-refresh signed URL before expiry - update refs only (no re-render)
  const handleUrlRefreshed = useCallback((newUrl: string, newExpiresAt: number) => {
    console.log('[SecureReader] URL refreshed silently, no reload needed');
    pdfUrlRef.current = newUrl;
    expiresAtRef.current = newExpiresAt;
    // Don't call setContent - the PDF.js document already has the file loaded
    // The new URL is stored in refs for any future page requests
  }, []);

  const handleUrlRefreshError = useCallback((error: Error) => {
    console.error('Failed to refresh signed URL:', error);
    // Don't set error state - let the user continue reading with existing URL
  }, []);

  useSignedUrlRefresh({
    contentId: id,
    initialUrl: pdfUrlRef.current,
    initialExpiresAt: expiresAtRef.current,
    enabled: !!content && numPages > 0,
    onUrlRefreshed: handleUrlRefreshed,
    onRefreshError: handleUrlRefreshError,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }, doc?: any) => {
    setNumPages(pages);
    setHasInitializedPage(true);
    if (doc) {
      setPdfDocument(doc);
    }
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      scrollToPage(page, 'smooth');
    }
  }, [numPages, scrollToPage]);

  const handleResume = useCallback(() => {
    if (savedProgress) {
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
    if (currentPage > 0 && numPages > 0) {
      saveProgressImmediate(currentPage);
    }
    navigate('/library', { replace: true });
  }, [currentPage, numPages, saveProgressImmediate, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-[var(--shadow-lg)]">
            <BookOpen className="h-10 w-10 text-primary-foreground" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)]" />
        </div>
        <p className="font-display text-lg font-semibold text-foreground mb-2">Loading Publication</p>
        <p className="text-sm text-muted-foreground mb-6">Preparing secure content...</p>
        <div className="w-48">
          <Progress value={loadingProgress} className="h-1.5" />
        </div>
        <p className="text-xs text-muted-foreground mt-3">{loadingProgress}%</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-5">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-center text-muted-foreground mb-6 max-w-xs">{error}</p>
        <button
          onClick={handleClose}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const pdfSource = content?.signedUrl || null;

  return (
    <div 
      ref={containerRef}
      className="flex h-screen flex-col bg-reader-bg secure-content safe-top safe-bottom overflow-hidden"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        height: '100dvh',
      }}
    >
      <ScrollProgressBar currentPage={currentPage} totalPages={numPages} />

      <SecurityWarning
        isRecording={isRecording}
        screenshotDetected={screenshotDetected}
        onDismiss={clearScreenshotAlert}
      />

      <ResumeReadingToast
        show={showResumePrompt && numPages > 0}
        savedPage={savedProgress?.currentPage ?? 1}
        totalPages={numPages}
        onResume={handleResume}
        onStartOver={handleStartOver}
        onDismiss={dismissResumePrompt}
      />

      <GoToPageDialog
        open={showGoToDialog}
        onOpenChange={setShowGoToDialog}
        currentPage={currentPage}
        totalPages={numPages}
        onPageChange={goToPage}
        recentPages={recentPages}
      />

      <TableOfContents
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        outline={outline}
        currentPage={currentPage}
        onNavigate={goToPage}
        hasOutline={hasOutline}
        isLoading={outlineLoading}
        category={contentCategory || undefined}
      />

      {/* Premium Reader Header */}
      <header className="sticky top-0 z-30 glass border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowToc(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              title="Table of Contents"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <button
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
          
          <div className="text-center flex-1 mx-4">
            <h1 className="line-clamp-1 font-display text-base font-semibold text-foreground">
              {content?.title}
            </h1>
            <button
              onClick={() => setShowGoToDialog(true)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Page {currentPage} of {numPages || '...'} • Tap to jump
            </button>
          </div>
          
          {/* Refined Zoom Controls */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
            <button
              onClick={zoomOut}
              disabled={scale <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-card disabled:opacity-30 transition-all"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors min-w-[3rem] rounded-lg hover:bg-card"
              title="Reset zoom"
            >
              {Math.round(visualScale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= 2}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-card disabled:opacity-30 transition-all"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* PDF Viewer */}
      <main 
        ref={contentRef}
        className="relative flex-1 overflow-hidden"
        style={{
          // Disable browser gestures during pinch to prevent page refresh
          touchAction: isGesturing ? 'none' : 'pan-y pinch-zoom',
        }}
      >
        <Watermark sessionId={sessionId} />
        
        <FloatingPageIndicator 
          currentPage={currentPage} 
          totalPages={numPages} 
          containerRef={scrollContainerRef}
        />
        
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-auto overscroll-none scroll-smooth"
          style={{
            WebkitOverflowScrolling: 'touch',
            // Prevent pull-to-refresh
            overscrollBehavior: 'none',
          }}
        >
          <div
            ref={pdfWrapperRef}
            className="py-4 min-h-full"
            style={{
              // Set explicit width for horizontal scrolling when zoomed
              width: scale > 1 ? `${Math.round(pageWidth * scale) + 32}px` : '100%',
              minWidth: '100%',
            }}
          >
            {/* Segmented content: VirtualizedPdfViewer handles its own Documents */}
            {!isLegacyContent && isSegmented && numPages > 0 && id && (
              <VirtualizedPdfViewer
                numPages={numPages}
                pageWidth={pageWidth}
                scale={scale}
                registerPage={registerPage}
                scrollContainerRef={scrollContainerRef}
                gestureTransform={gestureTransform}
                segments={segments}
                getSegmentUrl={getSegmentUrl}
                getSegmentForPage={getSegmentForPage}
                isLoadingSegment={isLoadingSegment}
                legacyMode={false}
              />
            )}
            
            {/* Legacy content: wrap in a single Document */}
            {isLegacyContent && pdfSource && (
              <Document
                file={pdfSource}
                onLoadSuccess={(loadedDoc) => onDocumentLoadSuccess({ numPages: loadedDoc.numPages }, loadedDoc)}
                loading={
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading document...</p>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center py-20">
                    <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
                    <p className="text-muted-foreground">Failed to load document</p>
                    <p className="text-xs text-muted-foreground mt-1">The file may be corrupted</p>
                  </div>
                }
              >
                {numPages > 0 && id && (
                  <VirtualizedPdfViewer
                    numPages={numPages}
                    pageWidth={pageWidth}
                    scale={scale}
                    registerPage={registerPage}
                    scrollContainerRef={scrollContainerRef}
                    gestureTransform={gestureTransform}
                    legacyMode={true}
                  />
                )}
              </Document>
            )}
            
            {/* Loading state when content hasn't determined mode yet */}
            {!content && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Preparing content...</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
