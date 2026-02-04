import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to get all user FCM tokens
async function getAllUserTokens(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('fcm_token')
      .not('fcm_token', 'is', null);

    return data?.map(p => p.fcm_token).filter(Boolean) || [];
  } catch (error) {
    console.error('Error fetching user tokens:', error);
    return [];
  }
}

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: 'news' | 'blog' | 'highlight';
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
}

export interface CreatePostData {
  title: string;
  content: string;
  excerpt?: string;
  cover_image_url?: string;
  category: 'news' | 'blog' | 'highlight';
  is_published?: boolean;
}

export interface UpdatePostData extends Partial<CreatePostData> {
  id: string;
}

export function usePostManagement() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts((data as Post[]) || []);
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPost = useCallback(async (data: CreatePostData): Promise<Post | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const postData = {
        ...data,
        author_id: userData.user.id,
        published_at: data.is_published ? new Date().toISOString() : null,
      };

      const { data: newPost, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (error) throw error;

      // Send push notification to all users if published
      if (data.is_published) {
        try {
          const { data: notifData } = await supabase.functions.invoke('send-push-notification', {
            body: {
              title: `New ${data.category === 'news' ? 'News' : data.category === 'blog' ? 'Blog Post' : 'Highlight'}`,
              body: data.title,
              data: {
                type: 'new_post',
                post_id: newPost.id,
                category: data.category,
              },
              // Send to all non-admin users with FCM tokens
              fcmTokens: await getAllUserTokens(),
            },
          });
          console.log('Push notification sent:', notifData);
        } catch (notifError) {
          console.log('Push notification failed (non-critical):', notifError);
        }
      }

      toast.success('Post created successfully');
      await fetchPosts();
      return newPost as Post;
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
      return null;
    }
  }, [fetchPosts]);

  const updatePost = useCallback(async (data: UpdatePostData): Promise<Post | null> => {
    try {
      const { id, ...updateData } = data;

      // If publishing for the first time, set published_at
      if (updateData.is_published) {
        const existingPost = posts.find(p => p.id === id);
        if (existingPost && !existingPost.published_at) {
          (updateData as any).published_at = new Date().toISOString();
        }
      }

      const { data: updatedPost, error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Post updated successfully');
      await fetchPosts();
      return updatedPost as Post;
    } catch (error: any) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
      return null;
    }
  }, [fetchPosts, posts]);

  const deletePost = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Post deleted successfully');
      await fetchPosts();
      return true;
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
      return false;
    }
  }, [fetchPosts]);

  const togglePublish = useCallback(async (id: string, isPublished: boolean): Promise<boolean> => {
    try {
      const updateData: any = { is_published: isPublished };
      const existingPost = posts.find(p => p.id === id);

      if (isPublished) {
        if (existingPost && !existingPost.published_at) {
          updateData.published_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Send push notification to all users if publishing
      if (isPublished && existingPost) {
        try {
          const tokens = await getAllUserTokens();
          if (tokens.length > 0) {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                title: `New ${existingPost.category === 'news' ? 'News' : existingPost.category === 'blog' ? 'Blog Post' : 'Highlight'}`,
                body: existingPost.title,
                data: {
                  type: 'new_post',
                  post_id: id,
                  category: existingPost.category,
                },
                fcmTokens: tokens,
              },
            });
            console.log('Push notification sent for published post');
          }
        } catch (notifError) {
          console.log('Push notification failed (non-critical):', notifError);
        }
      }

      toast.success(isPublished ? 'Post published' : 'Post unpublished');
      await fetchPosts();
      return true;
    } catch (error: any) {
      console.error('Error toggling publish:', error);
      toast.error('Failed to update post');
      return false;
    }
  }, [fetchPosts, posts]);

  const uploadCoverImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('post-covers')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-covers')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading cover image:', error);
      toast.error('Failed to upload image');
      return null;
    }
  }, []);

  return {
    posts,
    loading,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    togglePublish,
    uploadCoverImage,
  };
}
