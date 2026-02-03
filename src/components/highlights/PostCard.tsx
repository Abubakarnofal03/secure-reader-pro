import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PublishedPost } from '@/hooks/usePublishedPosts';
import { format } from 'date-fns';

interface PostCardProps {
  post: PublishedPost;
  onClick: () => void;
  index: number;
}

export function PostCard({ post, onClick, index }: PostCardProps) {
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

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors active:scale-[0.98]"
    >
      <div className="flex gap-4">
        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt=""
            className="h-20 w-28 object-cover rounded-lg flex-shrink-0"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge 
              variant="outline" 
              className={`${getCategoryColor(post.category)} text-xs`}
            >
              {post.category}
            </Badge>
          </div>
          
          <h3 className="font-semibold text-foreground line-clamp-2 mb-1">
            {post.title}
          </h3>
          
          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {post.excerpt}
            </p>
          )}
          
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(post.published_at), 'MMM d, yyyy')}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
