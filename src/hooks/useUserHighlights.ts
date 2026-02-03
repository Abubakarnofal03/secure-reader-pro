import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

interface UseUserHighlightsOptions {
  contentId: string | undefined;
  enabled?: boolean;
}

export function useUserHighlights({ contentId, enabled = true }: UseUserHighlightsOptions) {
  const { profile } = useAuth();
  const [highlights, setHighlights] = useState<UserHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all highlights for the content
  const fetchHighlights = useCallback(async () => {
    if (!contentId || !profile?.id || !enabled) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_highlights')
        .select('*')
        .eq('content_id', contentId)
        .eq('user_id', profile.id)
        .order('page_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setHighlights(data || []);
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contentId, profile?.id, enabled]);

  // Fetch on mount / when contentId changes
  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  // Add a new highlight
  const addHighlight = useCallback(async (
    pageNumber: number,
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number,
    color: HighlightColor = 'yellow'
  ) => {
    if (!contentId || !profile?.id) return null;

    // Minimum size threshold (1% of page dimension)
    if (widthPercent < 1 || heightPercent < 0.5) {
      return null;
    }

    setIsSaving(true);
    try {
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
      
      setHighlights((prev) => [...prev, data]);
      return data;
    } catch (err) {
      console.error('Failed to add highlight:', err);
      toast.error('Failed to save highlight');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [contentId, profile?.id]);

  // Delete a highlight
  const deleteHighlight = useCallback(async (highlightId: string) => {
    if (!profile?.id) return false;

    try {
      const { error } = await supabase
        .from('user_highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', profile.id);

      if (error) throw error;
      
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      return true;
    } catch (err) {
      console.error('Failed to delete highlight:', err);
      toast.error('Failed to delete highlight');
      return false;
    }
  }, [profile?.id]);

  // Get highlights grouped by page
  const highlightsByPage = useMemo(() => {
    const grouped: Map<number, UserHighlight[]> = new Map();
    highlights.forEach((highlight) => {
      const pageHighlights = grouped.get(highlight.page_number) || [];
      pageHighlights.push(highlight);
      grouped.set(highlight.page_number, pageHighlights);
    });
    return grouped;
  }, [highlights]);

  // Get highlights for a specific page
  const getHighlightsForPage = useCallback((pageNumber: number) => {
    return highlightsByPage.get(pageNumber) || [];
  }, [highlightsByPage]);

  // Get pages that have highlights
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
