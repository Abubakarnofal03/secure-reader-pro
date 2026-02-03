import { ArrowLeft, Calendar, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PublishedPost } from '@/hooks/usePublishedPosts';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PostViewDialogProps {
  post: PublishedPost | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PostViewDialog({ post, isOpen, onClose }: PostViewDialogProps) {
  if (!post) return null;

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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.excerpt || '',
        });
      } else {
        await navigator.clipboard.writeText(post.title);
        toast.success('Title copied to clipboard');
      }
    } catch (error) {
      // User cancelled sharing
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[95vh] rounded-t-2xl p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Cover Image */}
            {post.cover_image_url && (
              <div className="relative h-48 w-full">
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
            )}

            <div className="p-5 space-y-4">
              {/* Category & Date */}
              <div className="flex items-center gap-3">
                <Badge 
                  variant="outline" 
                  className={getCategoryColor(post.category)}
                >
                  {post.category}
                </Badge>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(post.published_at), 'MMMM d, yyyy')}</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                {post.title}
              </h1>

              {/* Content */}
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
