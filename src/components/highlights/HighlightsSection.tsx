import { useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublishedPosts, PublishedPost } from '@/hooks/usePublishedPosts';
import { PostCard } from './PostCard';
import { PostViewDialog } from './PostViewDialog';

export default function HighlightsSection() {
  const { posts, loading, error, refetch } = usePublishedPosts();
  const [selectedPost, setSelectedPost] = useState<PublishedPost | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 px-6 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-5">
          <Newspaper className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">
          No Updates Yet
        </h2>
        <p className="mt-2 max-w-[280px] text-sm text-muted-foreground leading-relaxed">
          Check back soon for news, highlights, and blog posts.
        </p>
      </motion.div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-3">
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            onClick={() => setSelectedPost(post)}
            index={index}
          />
        ))}
      </div>

      <PostViewDialog
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
      />
    </>
  );
}
