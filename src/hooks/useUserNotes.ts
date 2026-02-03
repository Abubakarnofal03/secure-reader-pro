import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

interface UseUserNotesOptions {
  contentId: string | undefined;
  enabled?: boolean;
}

export function useUserNotes({ contentId, enabled = true }: UseUserNotesOptions) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all notes for the content
  const fetchNotes = useCallback(async () => {
    if (!contentId || !profile?.id || !enabled) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('content_id', contentId)
        .eq('user_id', profile.id)
        .order('page_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [contentId, profile?.id, enabled]);

  // Fetch on mount / when contentId changes
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Add a new note
  const addNote = useCallback(async (pageNumber: number, noteText: string) => {
    if (!contentId || !profile?.id) return null;

    setIsSaving(true);
    try {
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
      
      setNotes((prev) => [...prev, data].sort((a, b) => {
        if (a.page_number !== b.page_number) return a.page_number - b.page_number;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }));
      
      toast.success('Note added');
      return data;
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add note');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [contentId, profile?.id]);

  // Update an existing note
  const updateNote = useCallback(async (noteId: string, noteText: string) => {
    if (!profile?.id) return false;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
        .eq('user_id', profile.id)
        .select()
        .single();

      if (error) throw error;
      
      setNotes((prev) => prev.map((n) => n.id === noteId ? data : n));
      toast.success('Note updated');
      return true;
    } catch (err) {
      console.error('Failed to update note:', err);
      toast.error('Failed to update note');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [profile?.id]);

  // Delete a note
  const deleteNote = useCallback(async (noteId: string) => {
    if (!profile?.id) return false;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', profile.id);

      if (error) throw error;
      
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Note deleted');
      return true;
    } catch (err) {
      console.error('Failed to delete note:', err);
      toast.error('Failed to delete note');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [profile?.id]);

  // Get notes grouped by page
  const notesByPage = useMemo(() => {
    const grouped: Map<number, UserNote[]> = new Map();
    notes.forEach((note) => {
      const pageNotes = grouped.get(note.page_number) || [];
      pageNotes.push(note);
      grouped.set(note.page_number, pageNotes);
    });
    return grouped;
  }, [notes]);

  // Get pages that have notes
  const pagesWithNotes = useMemo(() => {
    return new Set(notes.map((n) => n.page_number));
  }, [notes]);

  // Get notes for a specific page
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
