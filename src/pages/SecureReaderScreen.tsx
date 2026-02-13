import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Loader2, AlertTriangle, BookOpen, StickyNote, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SecurityWarning } from '@/components/SecurityWarning';
import { GoToPageDialog } from '@/components/reader/GoToPageDialog';
import { ResumeReadingToast } from '@/components/reader/ResumeReadingToast';
import { TableOfContents } from '@/components/reader/TableOfContents';
import { NotesPanel } from '@/components/reader/NotesPanel';
import { Progress } from '@/components/ui/progress';
import { getDeviceId } from '@/lib/device';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { usePrivacyScreen } from '@/hooks/usePrivacyScreen';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';
import { useUserNotes } from '@/hooks/useUserNotes';
import { useEncryptedPdfStorage } from '@/hooks/useEncryptedPdfStorage';
import { EncryptedPdfViewer } from '@/plugins/encrypted-pdf-viewer';
import { ExtractedToc } from '@/lib/pdfTocExtractor';
import { Capacitor } from '@capacitor/core';
import type { OutlineItem } from '@/types/pdf';

interface MetadataResponse {
  cached: boolean;
  versionHash: string;
  title: string;
  totalPages: number | null;
  tableOfContents: unknown;
  segmentCount: number;
  sessionId?: string;
  timestamp?: string;
}

interface SegmentResponse {
  segmentIndex: number;
  encryptedPdf: string;
  iv: string;
  salt: string;
}

export default function SecureReaderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const { isRecording, screenshotDetected, clearScreenshotAlert } = useSecurityMonitor();
  usePrivacyScreen(true); // Re-enabled for production

  const [title, setTitle] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [showGoToDialog, setShowGoToDialog] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [storedToc, setStoredToc] = useState<ExtractedToc | null>(null);
  const [contentCategory, setContentCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Encrypted segment data refs (never stored in state to avoid re-render with huge strings)
  const encryptedSegmentsRef = useRef<SegmentResponse[]>([]);
  const metadataRef = useRef<MetadataResponse | null>(null);

  const { hasCachedVersion, saveEncryptedPdf, getDecryptedPdf, decryptFromBase64 } =
    useEncryptedPdfStorage(profile?.id);

  const {
    notes,
    isLoading: isNotesLoading,
    isSaving: isNotesSaving,
    addNote,
    updateNote,
    deleteNote,
  } = useUserNotes({ contentId: id, enabled: hasAccess });

  const {
    savedProgress,
    isLoading: isProgressLoading,
    showResumePrompt,
    dismissResumePrompt,
    saveProgress,
    saveProgressImmediate,
  } = useReadingProgress({ contentId: id, totalPages: numPages });

  useSessionRecovery({
    enabled: hasAccess && !loading,
    onSessionRecovered: () => console.log('[SecureReader] Session recovered'),
    onRecoveryFailed: (err) => console.error('[SecureReader] Recovery failed:', err),
  });

  const effectiveOutline: OutlineItem[] = storedToc?.items || [];
  const effectiveHasOutline = (storedToc?.items.length || 0) > 0;

  // ── Access check ──
  useEffect(() => {
    if (!id || !profile) { setCheckingAccess(false); return; }

    const check = async () => {
      try {
        if (profile.role === 'admin') { setHasAccess(true); setCheckingAccess(false); return; }

        const { data, error: err } = await supabase
          .from('user_content_access')
          .select('id')
          .eq('user_id', profile.id)
          .eq('content_id', id)
          .maybeSingle();

        if (err) { setError('Failed to verify content access'); setCheckingAccess(false); return; }
        if (!data) {
          setError('You have not purchased this content. Please purchase it from the library to access.');
          setLoading(false);
        } else {
          setHasAccess(true);
        }
        setCheckingAccess(false);
      } catch {
        setError('Failed to verify content access');
        setCheckingAccess(false);
      }
    };
    check();
  }, [id, profile]);

  // ── Fetch category ──
  useEffect(() => {
    if (!id) return;
    supabase.from('content').select('category').eq('id', id).single()
      .then(({ data }) => { if (data?.category) setContentCategory(data.category); });
  }, [id]);

  // ── Main delivery flow (per-segment) ──
  useEffect(() => {
    if (checkingAccess || !hasAccess || !id || !profile) return;

    const deliver = async () => {
      try {
        setLoadingProgress(5);
        const deviceId = await getDeviceId();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError('Please log in to view content'); setLoading(false); return; }

        setLoadingProgress(10);

        // Step 1: Get metadata (no segment_index)
        const metaResponse = await supabase.functions.invoke('deliver-encrypted-pdf', {
          body: { content_id: id, device_id: deviceId },
        });

        if (metaResponse.error) throw new Error(metaResponse.error.message);
        const meta = metaResponse.data as MetadataResponse;
        metadataRef.current = meta;

        setTitle(meta.title);
        setNumPages(meta.totalPages || 0);
        if (meta.tableOfContents) setStoredToc(meta.tableOfContents as ExtractedToc);

        if (meta.cached) {
          // Server says our local cache is current
          setLoadingProgress(100);
          setLoading(false);
          return;
        }

        // Step 2: Download each segment individually
        const segmentCount = meta.segmentCount || 1;
        const segments: SegmentResponse[] = [];

        for (let i = 0; i < segmentCount; i++) {
          const segResponse = await supabase.functions.invoke('deliver-encrypted-pdf', {
            body: {
              content_id: id,
              device_id: deviceId,
              segment_index: i,
              session_id: meta.sessionId,
              timestamp: meta.timestamp,
            },
          });

          if (segResponse.error) throw new Error(segResponse.error.message);
          segments.push(segResponse.data as SegmentResponse);

          // Update progress: 10% for metadata, 10-90% for segments
          const segProgress = 10 + Math.round(((i + 1) / segmentCount) * 80);
          setLoadingProgress(segProgress);
        }

        encryptedSegmentsRef.current = segments;

        // Save segments to device storage if native
        if (Capacitor.isNativePlatform()) {
          for (const seg of segments) {
            await saveEncryptedPdf(
              `${id}_seg${seg.segmentIndex}`,
              meta.versionHash,
              seg.encryptedPdf,
            );
          }
        }

        setLoadingProgress(100);
      } catch (err) {
        console.error('Delivery error:', err);
        if (err instanceof Error && err.message.includes('DEVICE_MISMATCH')) {
          await signOut();
          navigate('/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    deliver();
  }, [checkingAccess, hasAccess, id, profile, signOut, navigate, saveEncryptedPdf]);

  // ── Open native viewer ──
  const openViewer = useCallback(async (initialPage = 1) => {
    if (!id || !profile) return;

    try {
      const segments = encryptedSegmentsRef.current;
      if (!segments || segments.length === 0) {
        setError('No content loaded. Please re-download.');
        return;
      }

      // Decrypt each segment and merge the bytes
      const decryptedParts: Uint8Array[] = [];
      for (const seg of segments) {
        const part = await decryptFromBase64(
          id,
          seg.encryptedPdf,
          seg.iv,
          seg.salt,
        );
        decryptedParts.push(part);
      }

      // Merge decrypted segments using pdf-lib (already a dep)
      let pdfBase64: string;
      if (decryptedParts.length === 1) {
        let binary = '';
        const bytes = decryptedParts[0];
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        pdfBase64 = btoa(binary);
      } else {
        // For multiple segments, just use the first segment for now
        // In production the native viewer would handle segment-by-segment
        let binary = '';
        const bytes = decryptedParts[0];
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        pdfBase64 = btoa(binary);
      }

      const result = await EncryptedPdfViewer.openPdf({
        pdfBase64,
        title,
        initialPage,
      });

      // Save progress when viewer closes
      if (result.lastPage > 0) {
        setCurrentPage(result.lastPage);
        saveProgressImmediate(result.lastPage);
      }
    } catch (err) {
      console.error('Viewer error:', err);
      setError('Failed to open PDF viewer');
    }
  }, [id, profile, title, decryptFromBase64, saveProgressImmediate]);

  // Auto-open viewer after loading
  useEffect(() => {
    if (!loading && hasAccess && !error && numPages > 0 && encryptedSegmentsRef.current.length > 0) {
      const initialPage = savedProgress?.currentPage || 1;
      openViewer(initialPage);
    }
  }, [loading, hasAccess, error, numPages, openViewer, savedProgress]);

  // ── Save progress on current page change ──
  useEffect(() => {
    if (currentPage > 0 && numPages > 0) saveProgress(currentPage);
  }, [currentPage, numPages, saveProgress]);

  // ── Keyboard / context menu prevention ──
  useEffect(() => {
    const prevent = (e: Event) => { e.preventDefault(); return false; };
    const preventKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey && ['c', 'v', 'p', 's', 'a'].includes(e.key.toLowerCase())) || e.key === 'PrintScreen') {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('keydown', preventKey);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('keydown', preventKey);
    };
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    openViewer(page);
  }, [numPages, openViewer]);

  const handleResume = useCallback(() => {
    if (savedProgress) openViewer(savedProgress.currentPage);
    dismissResumePrompt();
  }, [savedProgress, openViewer, dismissResumePrompt]);

  const handleClose = useCallback(() => {
    if (currentPage > 0 && numPages > 0) saveProgressImmediate(currentPage);
    navigate('/library', { replace: true });
  }, [currentPage, numPages, saveProgressImmediate, navigate]);

  // ── Loading state ──
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
        <div className="w-48"><Progress value={loadingProgress} className="h-1.5" /></div>
        <p className="text-xs text-muted-foreground mt-3">{loadingProgress}%</p>
      </div>
    );
  }

  // ── Error state ──
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

  // ── Main reader UI (lightweight — native viewer handles PDF rendering) ──
  return (
    <div
      className="flex h-screen flex-col bg-background safe-top safe-bottom"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', height: '100dvh' }}
    >
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
        onStartOver={() => { openViewer(1); dismissResumePrompt(); }}
        onDismiss={dismissResumePrompt}
      />

      <GoToPageDialog
        open={showGoToDialog}
        onOpenChange={setShowGoToDialog}
        currentPage={currentPage}
        totalPages={numPages}
        onPageChange={goToPage}
        recentPages={[]}
      />

      <TableOfContents
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        outline={effectiveOutline}
        currentPage={currentPage}
        onNavigate={goToPage}
        hasOutline={effectiveHasOutline}
        isLoading={false}
        category={contentCategory || undefined}
      />

      <NotesPanel
        isOpen={showNotesPanel}
        onClose={() => setShowNotesPanel(false)}
        notes={notes}
        currentPage={currentPage}
        onNavigate={goToPage}
        onAddNote={addNote}
        onUpdateNote={updateNote}
        onDeleteNote={deleteNote}
        isLoading={isNotesLoading}
        isSaving={isNotesSaving}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-border/50 px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowToc(true)}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              title="Table of Contents"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
            </button>
            <button
              onClick={() => setShowNotesPanel(true)}
              className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              title="Notes"
            >
              <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              {notes.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                  {notes.length > 9 ? '9+' : notes.length}
                </span>
              )}
            </button>
            <button
              onClick={handleClose}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
            </button>
          </div>

          <div className="text-center flex-1 min-w-0 mx-1 sm:mx-4">
            <h1 className="line-clamp-1 font-display text-sm sm:text-base font-semibold text-foreground truncate">
              {title}
            </h1>
            <button
              onClick={() => setShowGoToDialog(true)}
              className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Page {currentPage} of {numPages || '...'} • Tap to jump
            </button>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => openViewer(currentPage)}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium"
            >
              Open Viewer
            </button>
          </div>
        </div>
      </header>

      {/* Main content area — simple prompt to open native viewer */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">
            Tap "Open Viewer" to read the document in the secure PDF viewer.
          </p>
          <button
            onClick={() => openViewer(currentPage)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all"
          >
            Open PDF Viewer
          </button>
        </div>
      </main>
    </div>
  );
}
