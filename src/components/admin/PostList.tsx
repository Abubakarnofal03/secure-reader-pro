import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Post, usePostManagement } from '@/hooks/usePostManagement';
import { PostEditor } from './PostEditor';
import { format } from 'date-fns';

export function PostList() {
  const { posts, loading, fetchPosts, deletePost, togglePublish } = usePostManagement();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreate = () => {
    setSelectedPost(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (post: Post) => {
    setSelectedPost(post);
    setIsEditorOpen(true);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deletePost(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'news':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'blog':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'highlight':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleCreate} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Create Post
      </Button>

      {posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No posts yet. Create your first post!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl border border-border bg-card"
            >
              <div className="flex items-start gap-3">
                {post.cover_image_url && (
                  <img
                    src={post.cover_image_url}
                    alt=""
                    className="h-16 w-16 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate flex-1 min-w-0">{post.title}</h4>
                    <Badge 
                      variant="outline" 
                      className={`${getCategoryColor(post.category)} flex-shrink-0 text-xs`}
                    >
                      {post.category}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                    {post.excerpt || 'No excerpt'}
                  </p>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-shrink">
                      {post.is_published ? (
                        <>
                          <Eye className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : 'Published'}</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 flex-shrink-0" />
                          <span>Draft</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Switch
                        checked={post.is_published}
                        onCheckedChange={(checked) => togglePublish(post.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(post)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteTarget(post)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <PostEditor
        post={selectedPost}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSaved={fetchPosts}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
