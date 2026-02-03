import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublishedPost {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: 'news' | 'blog' | 'highlight';
  published_at: string;
  created_at: string;
}

export function usePublishedPosts() {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('id, title, content, excerpt, cover_image_url, category, published_at, created_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPosts((data as PublishedPost[]) || []);
    } catch (err: any) {
      console.error('Error fetching published posts:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
  };
}
