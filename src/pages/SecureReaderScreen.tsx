import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Watermark } from '@/components/Watermark';
import { LoadingScreen } from '@/components/LoadingScreen';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ContentDetails {
  id: string;
  title: string;
  file_path: string;
}

export default function SecureReaderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [content, setContent] = useState<ContentDetails | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(window.innerWidth - 32);

  // Prevent context menu (right-click)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setPageWidth(window.innerWidth - 32);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch content details and PDF
  useEffect(() => {
    const fetchContent = async () => {
      if (!id) {
        setError('No content ID provided');
        setLoading(false);
        return;
      }

      // Fetch content details
      const { data: contentData, error: contentError } = await supabase
        .from('content')
        .select('id, title, file_path')
        .eq('id', id)
        .single();

      if (contentError || !contentData) {
        setError('Content not found or access denied');
        setLoading(false);
        return;
      }

      setContent(contentData);

      // Get signed URL for the PDF
      const { data: urlData, error: urlError } = await supabase.storage
        .from('content-files')
        .createSignedUrl(contentData.file_path, 3600); // 1 hour expiry

      if (urlError || !urlData) {
        setError('Could not load the document');
        setLoading(false);
        return;
      }

      setPdfUrl(urlData.signedUrl);
      setLoading(false);
    };

    fetchContent();
  }, [id]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
        <p className="text-center text-muted-foreground">{error}</p>
        <button
          onClick={() => navigate('/library')}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Return to Library
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-reader-bg secure-content safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/library')}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
          <div className="text-center">
            <h1 className="line-clamp-1 text-sm font-medium text-foreground">
              {content?.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {numPages}
            </p>
          </div>
          <div className="w-9" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* PDF Viewer with Watermark */}
      <main className="relative flex-1 overflow-auto scrollbar-hide">
        <Watermark />
        
        <div className="flex justify-center py-4">
          {pdfUrl && (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<LoadingScreen />}
              error={
                <div className="flex items-center justify-center py-20">
                  <p className="text-muted-foreground">Failed to load document</p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          )}
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="sticky bottom-0 z-20 glass border-t border-border px-4 py-3 safe-bottom">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
          </button>

          <div className="flex items-center gap-1">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (!isNaN(page)) goToPage(page);
              }}
              className="w-12 rounded-lg bg-secondary px-2 py-1 text-center text-sm font-medium text-secondary-foreground"
              min={1}
              max={numPages}
            />
            <span className="text-sm text-muted-foreground">/ {numPages}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      </footer>
    </div>
  );
}
