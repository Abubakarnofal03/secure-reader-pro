import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, AlertTriangle } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Watermark } from '@/components/Watermark';
import { LoadingScreen } from '@/components/LoadingScreen';
import { getDeviceId } from '@/lib/device';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

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

export default function SecureReaderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [content, setContent] = useState<ContentDetails | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(window.innerWidth - 32);
  const [sessionId] = useState(() => crypto.randomUUID().substring(0, 8));

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
        setPageWidth(containerRef.current.clientWidth - 32);
      } else {
        setPageWidth(window.innerWidth - 32);
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
        const deviceId = await getDeviceId();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError('Please log in to view content');
          setLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('render-pdf-page', {
          body: {
            content_id: id,
            page_number: 1,
            device_id: deviceId,
          },
        });

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

        setContent({
          title: data.title,
          pdfBase64: data.pdfBase64,
          watermark: data.watermark,
        });
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
  }, []);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  const handleClose = () => {
    navigate('/library', { replace: true });
  };

  if (loading) {
    return <LoadingScreen />;
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
      className="flex min-h-screen flex-col bg-reader-bg secure-content safe-top safe-bottom"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
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
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {numPages || '...'}
            </p>
          </div>
          <div className="w-9" />
        </div>
      </header>

      {/* PDF Viewer with Watermark */}
      <main className="relative flex-1 overflow-auto scrollbar-hide">
        {/* Enhanced Watermark */}
        <Watermark sessionId={sessionId} />
        
        {/* PDF Content */}
        <div 
          className="flex justify-center py-4 relative"
          style={{
            pointerEvents: 'auto',
            touchAction: 'pan-y',
          }}
        >
          {pdfDataUri && (
            <Document
              file={pdfDataUri}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center py-20">
                  <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-muted-foreground">Failed to load document</p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-lg rounded-sm"
              />
            </Document>
          )}
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="sticky bottom-0 z-30 glass border-t border-border px-4 py-3 safe-bottom">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary disabled:opacity-30 transition-opacity"
          >
            <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (!isNaN(page)) goToPage(page);
              }}
              className="w-14 rounded-lg bg-secondary px-2 py-1.5 text-center text-sm font-medium text-secondary-foreground border-0 focus:ring-2 focus:ring-primary"
              min={1}
              max={numPages}
            />
            <span className="text-sm text-muted-foreground">/ {numPages}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary disabled:opacity-30 transition-opacity"
          >
            <ChevronRight className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      </footer>
    </div>
  );
}
