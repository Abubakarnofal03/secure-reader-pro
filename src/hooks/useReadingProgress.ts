import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ReadingProgress {
  currentPage: number;
  totalPages: number | null;
  updatedAt: string | null;
}

interface UseReadingProgressOptions {
  contentId: string | undefined;
  totalPages: number;
  debounceMs?: number;
}

export function useReadingProgress({
  contentId,
  totalPages,
  debounceMs = 3000,
}: UseReadingProgressOptions) {
  const { profile } = useAuth();
  const [savedProgress, setSavedProgress] = useState<ReadingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPageRef = useRef<number>(1);
  const isMountedRef = useRef(true);

  // Fetch saved progress on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchProgress = async () => {
      if (!contentId || !profile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('reading_progress')
          .select('current_page, total_pages, updated_at')
          .eq('user_id', profile.id)
          .eq('content_id', contentId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching reading progress:', error);
          setIsLoading(false);
          return;
        }

        if (data && isMountedRef.current) {
          setSavedProgress({
            currentPage: data.current_page,
            totalPages: data.total_pages,
            updatedAt: data.updated_at,
          });
          lastSavedPageRef.current = data.current_page;
          
          // Show resume prompt if not on page 1
          if (data.current_page > 1) {
            setShowResumePrompt(true);
          }
        }
      } catch (err) {
        console.error('Error fetching reading progress:', err);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchProgress();

    return () => {
      isMountedRef.current = false;
    };
  }, [contentId, profile?.id]);

  // Save progress function (debounced)
  const saveProgress = useCallback(
    (page: number) => {
      if (!contentId || !profile?.id || page === lastSavedPageRef.current) {
        return;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce the save
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('reading_progress')
            .upsert(
              {
                user_id: profile.id,
                content_id: contentId,
                current_page: page,
                total_pages: totalPages || null,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'user_id,content_id',
              }
            );

          if (error) {
            console.error('Error saving reading progress:', error);
          } else {
            lastSavedPageRef.current = page;
          }
        } catch (err) {
          console.error('Error saving reading progress:', err);
        }
      }, debounceMs);
    },
    [contentId, profile?.id, totalPages, debounceMs]
  );

  // Immediate save (for page changes and on unmount)
  const saveProgressImmediate = useCallback(
    async (page: number) => {
      if (!contentId || !profile?.id) {
        return;
      }

      // Clear any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      try {
        const { error } = await supabase
          .from('reading_progress')
          .upsert(
            {
              user_id: profile.id,
              content_id: contentId,
              current_page: page,
              total_pages: totalPages || null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,content_id',
            }
          );

        if (error) {
          console.error('Error saving reading progress:', error);
        } else {
          lastSavedPageRef.current = page;
        }
      } catch (err) {
        console.error('Error saving reading progress:', err);
      }
    },
    [contentId, profile?.id, totalPages]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const dismissResumePrompt = useCallback(() => {
    setShowResumePrompt(false);
  }, []);

  return {
    savedProgress,
    isLoading,
    showResumePrompt,
    dismissResumePrompt,
    saveProgress,
    saveProgressImmediate,
    initialPage: savedProgress?.currentPage ?? 1,
  };
}
