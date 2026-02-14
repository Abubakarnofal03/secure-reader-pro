import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';

export interface UserNote {
  id: string;
  user_id: string;
  content_id: string;
  page_number: number;
  note_text: string;
  created_at: string;
  updated_at: string;
}

interface PendingNoteOp {
  type: 'add' | 'update' | 'delete';
  note: UserNote;
  previousText?: string;
}

interface UseUserNotesOptions {
  contentId: string | undefined;
  enabled?: boolean;
}

const NOTES_CACHE_KEY = (contentId: string, userId: string) =>
  `secure_reader_notes_${userId}_${contentId}`;
const NOTES_PENDING_KEY = (userId: string) =>
  `secure_reader_notes_pending_${userId}`;

export function useUserNotes({ contentId, enabled = true }: UseUserNotesOptions) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const syncInProgress = useRef(false);

  // === Local cache helpers ===
  const saveToLocal = useCallback(async (notesData: UserNote[]) => {
    if (!contentId || !profile?.id) return;
    try {
      await storage.setItem(NOTES_CACHE_KEY(contentId, profile.id), JSON.stringify(notesData));
    } catch (e) {
      console.warn('[Notes] Failed to cache locally:', e);
    }
  }, [contentId, profile?.id]);

  const loadFromLocal = useCallback(async (): Promise<UserNote[] | null> => {
    if (!contentId || !profile?.id) return null;
    try {
      const cached = await storage.getItem(NOTES_CACHE_KEY(contentId, profile.id));
      if (cached) return JSON.parse(cached) as UserNote[];
    } catch (e) {
      console.warn('[Notes] Failed to load cache:', e);
    }
    return null;
  }, [contentId, profile?.id]);

  // === Pending operations queue ===
  const savePendingOps = useCallback(async (ops: PendingNoteOp[]) => {
    if (!profile?.id) return;
    try {
      await storage.setItem(NOTES_PENDING_KEY(profile.id), JSON.stringify(ops));
    } catch (e) {
      console.warn('[Notes] Failed to save pending ops:', e);
    }
  }, [profile?.id]);

  const loadPendingOps = useCallback(async (): Promise<PendingNoteOp[]> => {
    if (!profile?.id) return [];
    try {
      const data = await storage.getItem(NOTES_PENDING_KEY(profile.id));
      if (data) return JSON.parse(data) as PendingNoteOp[];
    } catch (e) {
      console.warn('[Notes] Failed to load pending ops:', e);
    }
    return [];
  }, [profile?.id]);

  const addPendingOp = useCallback(async (op: PendingNoteOp) => {
    const ops = await loadPendingOps();
    ops.push(op);
    await savePendingOps(ops);
  }, [loadPendingOps, savePendingOps]);

  // === Sync pending ops to Supabase (returns remaining failed ops) ===
  const syncPendingOps = useCallback(async (): Promise<PendingNoteOp[]> => {
    if (!profile?.id || !navigator.onLine) return await loadPendingOps();
    if (syncInProgress.current) return await loadPendingOps();

    const ops = await loadPendingOps();
    if (ops.length === 0) return [];

    syncInProgress.current = true;
    console.log(`[Notes] Syncing ${ops.length} pending operations...`);
    const failedOps: PendingNoteOp[] = [];

    for (const op of ops) {
      try {
        if (op.type === 'add') {
          const { error } = await supabase
            .from('user_notes')
            .upsert({
              id: op.note.id,
              content_id: op.note.content_id,
              user_id: op.note.user_id,
              page_number: op.note.page_number,
              note_text: op.note.note_text,
            });
          if (error) throw error;
        } else if (op.type === 'update') {
          const { error } = await supabase
            .from('user_notes')
            .update({ note_text: op.note.note_text })
            .eq('id', op.note.id)
            .eq('user_id', profile.id);
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await supabase
            .from('user_notes')
            .delete()
            .eq('id', op.note.id)
            .eq('user_id', profile.id);
          if (error) throw error;
        }
      } catch (err) {
        console.error('[Notes] Failed to sync op:', op.type, err);
        failedOps.push(op);
      }
    }

    await savePendingOps(failedOps);
    syncInProgress.current = false;

    if (failedOps.length === 0) {
      console.log('[Notes] All pending operations synced successfully');
    } else {
      console.warn(`[Notes] ${failedOps.length} operations still pending`);
    }

    return failedOps;
  }, [profile?.id, loadPendingOps, savePendingOps]);

  // === Apply remaining failed ops to Supabase data (merge) ===
  const mergeWithPendingOps = (serverNotes: UserNote[], pendingOps: PendingNoteOp[]): UserNote[] => {
    let merged = [...serverNotes];

    for (const op of pendingOps) {
      if (op.type === 'add') {
        // Only add if not already in server data
        if (!merged.find(n => n.id === op.note.id)) {
          merged.push(op.note);
        }
      } else if (op.type === 'update') {
        merged = merged.map(n => n.id === op.note.id ? { ...n, note_text: op.note.note_text } : n);
      } else if (op.type === 'delete') {
        merged = merged.filter(n => n.id !== op.note.id);
      }
    }

    return merged.sort((a, b) => {
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  // === Fetch notes (sync first when online) ===
  const fetchNotes = useCallback(async () => {
    if (!contentId || !profile?.id || !enabled) return;

    setIsLoading(true);
    try {
      if (!navigator.onLine) {
        // Offline: load from local cache
        const cached = await loadFromLocal();
        if (cached) setNotes(cached);
        setIsLoading(false);
        return;
      }

      // Online: sync pending ops FIRST, then fetch
      const remainingOps = await syncPendingOps();

      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('content_id', contentId)
        .eq('user_id', profile.id)
        .order('page_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Merge any remaining failed ops into server data
      const serverNotes = data || [];
      const finalNotes = remainingOps.length > 0
        ? mergeWithPendingOps(serverNotes, remainingOps)
        : serverNotes;

      setNotes(finalNotes);
      await saveToLocal(finalNotes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      // Fall back to local cache
      const cached = await loadFromLocal();
      if (cached) {
        setNotes(cached);
      } else {
        toast.error('Failed to load notes');
      }
    } finally {
      setIsLoading(false);
    }
  }, [contentId, profile?.id, enabled, loadFromLocal, saveToLocal, syncPendingOps]);

  // Fetch on mount / when contentId changes
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Sync when coming back online (then re-fetch to get merged data)
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Notes] Back online — syncing and refreshing...');
      fetchNotes();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchNotes]);

  // === Add note ===
  const addNote = useCallback(async (pageNumber: number, noteText: string) => {
    if (!contentId || !profile?.id) return null;

    setIsSaving(true);
    try {
      const tempId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const localNote: UserNote = {
        id: tempId,
        user_id: profile.id,
        content_id: contentId,
        page_number: pageNumber,
        note_text: noteText,
        created_at: now,
        updated_at: now,
      };

      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('user_notes')
          .insert({
            content_id: contentId,
            user_id: profile.id,
            page_number: pageNumber,
            note_text: noteText,
          })
          .select()
          .single();

        if (error) throw error;

        const newNotes = [...notes, data].sort((a, b) => {
          if (a.page_number !== b.page_number) return a.page_number - b.page_number;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setNotes(newNotes);
        await saveToLocal(newNotes);
        toast.success('Note added');
        return data;
      } else {
        const newNotes = [...notes, localNote].sort((a, b) => {
          if (a.page_number !== b.page_number) return a.page_number - b.page_number;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setNotes(newNotes);
        await saveToLocal(newNotes);
        await addPendingOp({ type: 'add', note: localNote });
        toast.success('Note saved offline');
        return localNote;
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add note');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [contentId, profile?.id, notes, saveToLocal, addPendingOp]);

  // === Update note ===
  const updateNote = useCallback(async (noteId: string, noteText: string) => {
    if (!profile?.id) return false;

    setIsSaving(true);
    try {
      const existingNote = notes.find(n => n.id === noteId);
      if (!existingNote) return false;

      const updatedNote = { ...existingNote, note_text: noteText, updated_at: new Date().toISOString() };

      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('user_notes')
          .update({ note_text: noteText })
          .eq('id', noteId)
          .eq('user_id', profile.id)
          .select()
          .single();

        if (error) throw error;

        const newNotes = notes.map(n => n.id === noteId ? data : n);
        setNotes(newNotes);
        await saveToLocal(newNotes);
        toast.success('Note updated');
      } else {
        const newNotes = notes.map(n => n.id === noteId ? updatedNote : n);
        setNotes(newNotes);
        await saveToLocal(newNotes);
        await addPendingOp({ type: 'update', note: updatedNote, previousText: existingNote.note_text });
        toast.success('Note updated offline');
      }
      return true;
    } catch (err) {
      console.error('Failed to update note:', err);
      toast.error('Failed to update note');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [profile?.id, notes, saveToLocal, addPendingOp]);

  // === Delete note ===
  const deleteNote = useCallback(async (noteId: string) => {
    if (!profile?.id) return false;

    setIsSaving(true);
    try {
      const existingNote = notes.find(n => n.id === noteId);
      if (!existingNote) return false;

      if (navigator.onLine) {
        const { error } = await supabase
          .from('user_notes')
          .delete()
          .eq('id', noteId)
          .eq('user_id', profile.id);

        if (error) throw error;
      } else {
        await addPendingOp({ type: 'delete', note: existingNote });
      }

      const newNotes = notes.filter(n => n.id !== noteId);
      setNotes(newNotes);
      await saveToLocal(newNotes);
      toast.success(navigator.onLine ? 'Note deleted' : 'Note deleted offline');
      return true;
    } catch (err) {
      console.error('Failed to delete note:', err);
      toast.error('Failed to delete note');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [profile?.id, notes, saveToLocal, addPendingOp]);

  // === Derived data ===
  const notesByPage = useMemo(() => {
    const grouped: Map<number, UserNote[]> = new Map();
    notes.forEach((note) => {
      const pageNotes = grouped.get(note.page_number) || [];
      pageNotes.push(note);
      grouped.set(note.page_number, pageNotes);
    });
    return grouped;
  }, [notes]);

  const pagesWithNotes = useMemo(() => {
    return new Set(notes.map((n) => n.page_number));
  }, [notes]);

  const getNotesForPage = useCallback((pageNumber: number) => {
    return notesByPage.get(pageNumber) || [];
  }, [notesByPage]);

  return {
    notes,
    notesByPage,
    pagesWithNotes,
    isLoading,
    isSaving,
    addNote,
    updateNote,
    deleteNote,
    getNotesForPage,
    refetch: fetchNotes,
  };
}
