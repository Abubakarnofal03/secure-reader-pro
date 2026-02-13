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
import type { CachedContentMeta } from '@/hooks/useEncryptedPdfStorage';
import { EncryptedPdfViewer } from '@/plugins/encrypted-pdf-viewer';
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
  const { user, profile, signOut } = useAuth();

  const { isRecording, screenshotDetected, clearScreenshotAlert } = useSecurityMonitor();
  usePrivacyScreen(true);

  const [title, setTitle] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Checking local cache...');
  const [error, setError] = useState<string | null>(null);
  const [showGoToDialog, setShowGoToDialog] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [storedToc, setStoredToc] = useState<OutlineItem[] | null>(null);
  const [contentCategory, setContentCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Track whether we have content ready to view (from cache or download)
  const [contentReady, setContentReady] = useState(false);

  // For web fallback: keep encrypted segments in memory
  const encryptedSegmentsRef = useRef<SegmentResponse[]>([]);
  const cachedMetaRef = useRef<CachedContentMeta | null>(null);

  const {
    getStoredContentMeta,
    saveSegment,
    saveContentMeta,
    getDecryptedPdf,
    decryptFromBase64,
    deleteContent,
    cleanupOldVersions,
  } = useEncryptedPdfStorage();

  const isLoggedIn = !!user && !!profile;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const {
    notes,
    isLoading: isNotesLoading,
    isSaving: isNotesSaving,
    addNote,
    updateNote,
    deleteNote,
  } = useUserNotes({ contentId: id, enabled: isLoggedIn && contentReady });

  const {
    savedProgress,
    isLoading: isProgressLoading,
    showResumePrompt,
    dismissResumePrompt,
    saveProgress,
    saveProgressImmediate,
  } = useReadingProgress({ contentId: id, totalPages: numPages });

  useSessionRecovery({
    enabled: isLoggedIn && contentReady && !loading,
    onSessionRecovered: () => console.log('[SecureReader] Session recovered'),
    onRecoveryFailed: (err) => console.error('[SecureReader] Recovery failed:', err),
  });

  const effectiveOutline: OutlineItem[] = storedToc || [];
  const effectiveHasOutline = (storedToc?.length || 0) > 0;

  // ── Main offline-first flow ──
  useEffect(() => {
    if (!id) return;

    const run = async () => {
      try {
        // Step 1: Check local cache
        setLoadingMessage('Checking local cache...');
        setLoadingProgress(5);

        const cachedMeta = await getStoredContentMeta(id);

        if (cachedMeta) {
          // We have a cached version
          cachedMetaRef.current = cachedMeta;
          setTitle(cachedMeta.title);
          setNumPages(cachedMeta.totalPages);
          if (cachedMeta.tableOfContents) setStoredToc(cachedMeta.tableOfContents);

          // Step 2a: If online AND logged in, verify access
          if (isOnline && isLoggedIn) {
            setLoadingMessage('Verifying access...');
            setLoadingProgress(15);

            const isAdmin = profile.role === 'admin';
            if (!isAdmin) {
              const { data: accessData } = await supabase
                .from('user_content_access')
                .select('id')
                .eq('user_id', profile.id)
                .eq('content_id', id)
                .maybeSingle();

              if (!accessData) {
                // Access revoked — delete cache
                await deleteContent(id);
                setError('Your access to this content has been revoked.');
                setLoading(false);
                return;
              }
            }
          }

          // Step 3: Content is cached and access is valid (or we're offline/logged-out)
          setLoadingProgress(100);
          setContentReady(true);
          setLoading(false);
          return;
        }

        // Step 4: NOT cached — require login
        if (!isLoggedIn) {
          navigate('/login', { state: { from: { pathname: `/reader/${id}` } }, replace: true });
          return;
        }

        // Step 4a: Download from server
        setLoadingMessage('Connecting to server...');
        setLoadingProgress(10);

        const deviceId = await getDeviceId();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Please log in to view content');
          setLoading(false);
          return;
        }

        // Get metadata
        const metaResponse = await supabase.functions.invoke('deliver-encrypted-pdf', {
          body: { content_id: id, device_id: deviceId },
        });

        if (metaResponse.error) throw new Error(metaResponse.error.message);
        const meta = metaResponse.data as MetadataResponse;

        setTitle(meta.title);
        setNumPages(meta.totalPages || 0);
        if (meta.tableOfContents) setStoredToc(meta.tableOfContents as OutlineItem[]);

        // Fetch category
        supabase.from('content').select('category').eq('id', id).single()
          .then(({ data }) => { if (data?.category) setContentCategory(data.category); });

        if (meta.cached) {
          // Server says our local cache is current — but we don't have it locally?
          // This means the cache record exists server-side but files were cleared.
          // Re-download by NOT returning.
        }

        // Download each segment
        const segmentCount = meta.segmentCount || 1;
        const segments: SegmentResponse[] = [];
        const segmentMetas: CachedContentMeta['segments'] = [];

        for (let i = 0; i < segmentCount; i++) {
          setLoadingMessage(`Downloading segment ${i + 1} of ${segmentCount}...`);

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
          const seg = segResponse.data as SegmentResponse;
          segments.push(seg);

          // Save to device storage (native only)
          if (Capacitor.isNativePlatform()) {
            const fileName = await saveSegment(id, meta.versionHash, seg.segmentIndex, seg.encryptedPdf);
            segmentMetas.push({
              segmentIndex: seg.segmentIndex,
              iv: seg.iv,
              salt: seg.salt,
              fileName,
            });
          }

          const segProgress = 10 + Math.round(((i + 1) / segmentCount) * 80);
          setLoadingProgress(segProgress);
        }

        encryptedSegmentsRef.current = segments;

        // Save full metadata (native only)
        if (Capacitor.isNativePlatform()) {
          const fullMeta: CachedContentMeta = {
            versionHash: meta.versionHash,
            contentId: id,
            userId: profile.id,
            title: meta.title,
            totalPages: meta.totalPages || 0,
            tableOfContents: (meta.tableOfContents as OutlineItem[]) || null,
            segments: segmentMetas,
          };
          await saveContentMeta(fullMeta);
          cachedMetaRef.current = fullMeta;

          // Clean up old version files
          await cleanupOldVersions(id, meta.versionHash);
        }

        setLoadingProgress(100);
        setContentReady(true);
      } catch (err) {
        console.error('Reader error:', err);
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

    run();
  }, [id, isLoggedIn, isOnline]);

  // ── Fetch category when logged in ──
  useEffect(() => {
    if (!id || !isLoggedIn) return;
    supabase.from('content').select('category').eq('id', id).single()
      .then(({ data }) => { if (data?.category) setContentCategory(data.category); });
  }, [id, isLoggedIn]);

  // ── Open native viewer ──
  const openViewer = useCallback(async (initialPage = 1) => {
    if (!id) return;

    try {
      let pdfBytes: Uint8Array | null = null;

      // Try loading from device cache first (native)
      if (Capacitor.isNativePlatform()) {
        pdfBytes = await getDecryptedPdf(id);
      }

      // Fallback: decrypt from in-memory segments (web or if cache read failed)
      if (!pdfBytes && encryptedSegmentsRef.current.length > 0) {
        const userId = cachedMetaRef.current?.userId || profile?.id;
        if (!userId) {
          setError('Cannot decrypt content — user identity unavailable.');
          return;
        }

        const decryptedParts: Uint8Array[] = [];
        for (const seg of encryptedSegmentsRef.current) {
          const part = await decryptFromBase64(
            id,
            userId,
            seg.encryptedPdf,
            seg.iv,
            seg.salt,
          );
          decryptedParts.push(part);
        }

        if (decryptedParts.length === 1) {
          pdfBytes = decryptedParts[0];
        } else {
          const totalLen = decryptedParts.reduce((sum, p) => sum + p.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const part of decryptedParts) {
            merged.set(part, offset);
            offset += part.length;
          }
          pdfBytes = merged;
        }
      }

      if (!pdfBytes) {
        setError('No content available. Please re-download.');
        return;
      }

      // Convert to base64 for the viewer
      let binary = '';
      for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
      const pdfBase64 = btoa(binary);

      const result = await EncryptedPdfViewer.openPdf({
        pdfBase64,
        title,
        initialPage,
      });

      if (result.lastPage > 0) {
        setCurrentPage(result.lastPage);
        if (isLoggedIn) saveProgressImmediate(result.lastPage);
      }
    } catch (err) {
      console.error('Viewer error:', err);
      setError('Failed to open PDF viewer');
    }
  }, [id, title, profile, getDecryptedPdf, decryptFromBase64, saveProgressImmediate, isLoggedIn]);

  // Auto-open viewer after content is ready
  useEffect(() => {
    if (contentReady && !error && numPages > 0) {
      const initialPage = savedProgress?.currentPage || 1;
      openViewer(initialPage);
    }
  }, [contentReady, error, numPages, openViewer, savedProgress]);

  // Save progress on page change (only when logged in)
  useEffect(() => {
    if (currentPage > 0 && numPages > 0 && isLoggedIn) saveProgress(currentPage);
  }, [currentPage, numPages, saveProgress, isLoggedIn]);

  // Keyboard / context menu prevention
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
    if (currentPage > 0 && numPages > 0 && isLoggedIn) saveProgressImmediate(currentPage);
    navigate('/library', { replace: true });
  }, [currentPage, numPages, saveProgressImmediate, navigate, isLoggedIn]);

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
        <p className="text-sm text-muted-foreground mb-6">{loadingMessage}</p>
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

  // ── Main reader UI ──
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

      {/* Main content area */}
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
