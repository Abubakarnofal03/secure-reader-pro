import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';

export interface UserHighlight {
  id: string;
  user_id: string;
  content_id: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  color: string;
  created_at: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; border: string; label: string }> = {
  yellow: { bg: 'rgba(250, 204, 21, 0.35)', border: 'rgb(250, 204, 21)', label: 'Yellow' },
  green: { bg: 'rgba(34, 197, 94, 0.35)', border: 'rgb(34, 197, 94)', label: 'Green' },
  blue: { bg: 'rgba(59, 130, 246, 0.35)', border: 'rgb(59, 130, 246)', label: 'Blue' },
  pink: { bg: 'rgba(236, 72, 153, 0.35)', border: 'rgb(236, 72, 153)', label: 'Pink' },
};

interface PendingHighlightOp {
  type: 'add' | 'delete';
  highlight: UserHighlight;
}

interface UseUserHighlightsOptions {
  contentId: string | undefined;
  enabled?: boolean;
}

const HIGHLIGHTS_CACHE_KEY = (contentId: string, userId: string) =>
  `secure_reader_highlights_${userId}_${contentId}`;
const HIGHLIGHTS_PENDING_KEY = (userId: string) =>
  `secure_reader_highlights_pending_${userId}`;

export function useUserHighlights({ contentId, enabled = true }: UseUserHighlightsOptions) {
  const { profile } = useAuth();
  const [highlights, setHighlights] = useState<UserHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const syncInProgress = useRef(false);

  // === Local cache helpers ===
  const saveToLocal = useCallback(async (data: UserHighlight[]) => {
    if (!contentId || !profile?.id) return;
    try {
      await storage.setItem(HIGHLIGHTS_CACHE_KEY(contentId, profile.id), JSON.stringify(data));
    } catch (e) {
      console.warn('[Highlights] Failed to cache locally:', e);
    }
  }, [contentId, profile?.id]);

  const loadFromLocal = useCallback(async (): Promise<UserHighlight[] | null> => {
    if (!contentId || !profile?.id) return null;
    try {
      const cached = await storage.getItem(HIGHLIGHTS_CACHE_KEY(contentId, profile.id));
      if (cached) return JSON.parse(cached) as UserHighlight[];
    } catch (e) {
      console.warn('[Highlights] Failed to load cache:', e);
    }
    return null;
  }, [contentId, profile?.id]);

  // === Pending operations queue ===
  const savePendingOps = useCallback(async (ops: PendingHighlightOp[]) => {
    if (!profile?.id) return;
    try {
      await storage.setItem(HIGHLIGHTS_PENDING_KEY(profile.id), JSON.stringify(ops));
    } catch (e) {
      console.warn('[Highlights] Failed to save pending ops:', e);
    }
  }, [profile?.id]);

  const loadPendingOps = useCallback(async (): Promise<PendingHighlightOp[]> => {
    if (!profile?.id) return [];
    try {
      const data = await storage.getItem(HIGHLIGHTS_PENDING_KEY(profile.id));
      if (data) return JSON.parse(data) as PendingHighlightOp[];
    } catch (e) {
      console.warn('[Highlights] Failed to load pending ops:', e);
    }
    return [];
  }, [profile?.id]);

  const addPendingOp = useCallback(async (op: PendingHighlightOp) => {
    const ops = await loadPendingOps();
    ops.push(op);
    await savePendingOps(ops);
  }, [loadPendingOps, savePendingOps]);

  // === Sync pending ops to Supabase (returns remaining failed ops) ===
  const syncPendingOps = useCallback(async (): Promise<PendingHighlightOp[]> => {
    if (!profile?.id || !navigator.onLine) return await loadPendingOps();
    if (syncInProgress.current) return await loadPendingOps();

    const ops = await loadPendingOps();
    if (ops.length === 0) return [];

    syncInProgress.current = true;
    console.log(`[Highlights] Syncing ${ops.length} pending operations...`);
    const failedOps: PendingHighlightOp[] = [];

    for (const op of ops) {
      try {
        if (op.type === 'add') {
          const { error } = await supabase
            .from('user_highlights')
            .upsert({
              id: op.highlight.id,
              content_id: op.highlight.content_id,
              user_id: op.highlight.user_id,
              page_number: op.highlight.page_number,
              x_percent: op.highlight.x_percent,
              y_percent: op.highlight.y_percent,
              width_percent: op.highlight.width_percent,
              height_percent: op.highlight.height_percent,
              color: op.highlight.color,
            });
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await supabase
            .from('user_highlights')
            .delete()
            .eq('id', op.highlight.id)
            .eq('user_id', profile.id);
          if (error) throw error;
        }
      } catch (err) {
        console.error('[Highlights] Failed to sync op:', op.type, err);
        failedOps.push(op);
      }
    }

    await savePendingOps(failedOps);
    syncInProgress.current = false;

    if (failedOps.length === 0) {
      console.log('[Highlights] All pending operations synced successfully');
    }

    return failedOps;
  }, [profile?.id, loadPendingOps, savePendingOps]);

  // === Merge remaining failed ops into server data ===
  const mergeWithPendingOps = (serverData: UserHighlight[], pendingOps: PendingHighlightOp[]): UserHighlight[] => {
    let merged = [...serverData];

    for (const op of pendingOps) {
      if (op.type === 'add') {
        if (!merged.find(h => h.id === op.highlight.id)) {
          merged.push(op.highlight);
        }
      } else if (op.type === 'delete') {
        merged = merged.filter(h => h.id !== op.highlight.id);
      }
    }

    return merged;
  };

  // === Fetch highlights (sync first when online) ===
  const fetchHighlights = useCallback(async () => {
    if (!contentId || !profile?.id || !enabled) return;

    setIsLoading(true);
    try {
      if (!navigator.onLine) {
        const cached = await loadFromLocal();
        if (cached) setHighlights(cached);
        setIsLoading(false);
        return;
      }

      // Online: sync pending ops FIRST, then fetch
      const remainingOps = await syncPendingOps();

      const { data, error } = await supabase
        .from('user_highlights')
        .select('*')
        .eq('content_id', contentId)
        .eq('user_id', profile.id)
        .order('page_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const serverData = data || [];
      const finalData = remainingOps.length > 0
        ? mergeWithPendingOps(serverData, remainingOps)
        : serverData;

      setHighlights(finalData);
      await saveToLocal(finalData);
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
      const cached = await loadFromLocal();
      if (cached) setHighlights(cached);
    } finally {
      setIsLoading(false);
    }
  }, [contentId, profile?.id, enabled, loadFromLocal, saveToLocal, syncPendingOps]);

  // Fetch on mount
  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  // Sync when coming back online (sync + re-fetch merged data)
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Highlights] Back online — syncing and refreshing...');
      fetchHighlights();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchHighlights]);

  // === Add highlight ===
  const addHighlight = useCallback(async (
    pageNumber: number,
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number,
    color: HighlightColor = 'yellow'
  ) => {
    if (!contentId || !profile?.id) return null;

    if (widthPercent < 1 || heightPercent < 0.5) return null;

    setIsSaving(true);
    try {
      const tempId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const localHighlight: UserHighlight = {
        id: tempId,
        user_id: profile.id,
        content_id: contentId,
        page_number: pageNumber,
        x_percent: xPercent,
        y_percent: yPercent,
        width_percent: widthPercent,
        height_percent: heightPercent,
        color,
        created_at: now,
      };

      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('user_highlights')
          .insert({
            content_id: contentId,
            user_id: profile.id,
            page_number: pageNumber,
            x_percent: xPercent,
            y_percent: yPercent,
            width_percent: widthPercent,
            height_percent: heightPercent,
            color,
          })
          .select()
          .single();

        if (error) throw error;

        const newHighlights = [...highlights, data];
        setHighlights(newHighlights);
        await saveToLocal(newHighlights);
        return data;
      } else {
        const newHighlights = [...highlights, localHighlight];
        setHighlights(newHighlights);
        await saveToLocal(newHighlights);
        await addPendingOp({ type: 'add', highlight: localHighlight });
        return localHighlight;
      }
    } catch (err) {
      console.error('Failed to add highlight:', err);
      toast.error('Failed to save highlight');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [contentId, profile?.id, highlights, saveToLocal, addPendingOp]);

  // === Delete highlight ===
  const deleteHighlight = useCallback(async (highlightId: string) => {
    if (!profile?.id) return false;

    try {
      const existing = highlights.find(h => h.id === highlightId);
      if (!existing) return false;

      if (navigator.onLine) {
        const { error } = await supabase
          .from('user_highlights')
          .delete()
          .eq('id', highlightId)
          .eq('user_id', profile.id);

        if (error) throw error;
      } else {
        await addPendingOp({ type: 'delete', highlight: existing });
      }

      const newHighlights = highlights.filter(h => h.id !== highlightId);
      setHighlights(newHighlights);
      await saveToLocal(newHighlights);
      return true;
    } catch (err) {
      console.error('Failed to delete highlight:', err);
      toast.error('Failed to delete highlight');
      return false;
    }
  }, [profile?.id, highlights, saveToLocal, addPendingOp]);

  // === Derived data ===
  const highlightsByPage = useMemo(() => {
    const grouped: Map<number, UserHighlight[]> = new Map();
    highlights.forEach((highlight) => {
      const pageHighlights = grouped.get(highlight.page_number) || [];
      pageHighlights.push(highlight);
      grouped.set(highlight.page_number, pageHighlights);
    });
    return grouped;
  }, [highlights]);

  const getHighlightsForPage = useCallback((pageNumber: number) => {
    return highlightsByPage.get(pageNumber) || [];
  }, [highlightsByPage]);

  const pagesWithHighlights = useMemo(() => {
    return new Set(highlights.map((h) => h.page_number));
  }, [highlights]);

  return {
    highlights,
    highlightsByPage,
    pagesWithHighlights,
    isLoading,
    isSaving,
    addHighlight,
    deleteHighlight,
    getHighlightsForPage,
    refetch: fetchHighlights,
  };
}
