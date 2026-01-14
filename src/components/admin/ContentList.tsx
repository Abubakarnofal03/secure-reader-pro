import { useState, useEffect, useRef } from 'react';
import { ToggleLeft, ToggleRight, Trash2, Users, Loader2, RefreshCw, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BookCover } from '@/components/library/BookCover';

interface Content {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  is_active: boolean;
  created_at: string;
  price: number;
  cover_url: string | null;
}

interface ContentListProps {
  onManageAccess: (content: Content) => void;
  refreshTrigger: number;
}

export function ContentList({ onManageAccess, refreshTrigger }: ContentListProps) {
  const { toast } = useToast();
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteContent, setDeleteContent] = useState<Content | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceContentId, setReplaceContentId] = useState<string | null>(null);

  useEffect(() => {
    fetchContents();
  }, [refreshTrigger]);

  const fetchContents = async () => {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contents:', error);
      toast({ title: 'Error', description: 'Failed to load content', variant: 'destructive' });
    } else {
      setContents(data || []);
    }
    setLoading(false);
  };

  const toggleActive = async (content: Content) => {
    const { error } = await supabase
      .from('content')
      .update({ is_active: !content.is_active })
      .eq('id', content.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Content ${!content.is_active ? 'activated' : 'deactivated'}` });
      fetchContents();
    }
  };

  const handleDelete = async () => {
    if (!deleteContent) return;
    
    setDeleting(true);
    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('content-files')
        .remove([deleteContent.file_path]);

      if (storageError) {
        console.warn('Storage delete warning:', storageError);
      }

      // Delete access records
      await supabase
        .from('user_content_access')
        .delete()
        .eq('content_id', deleteContent.id);

      // Delete content record
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', deleteContent.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Content deleted successfully' });
      fetchContents();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteContent(null);
    }
  };

  const handleReplaceClick = (contentId: string) => {
    setReplaceContentId(contentId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceContentId) return;

    const content = contents.find(c => c.id === replaceContentId);
    if (!content) return;

    if (file.type !== 'application/pdf') {
      toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
      return;
    }

    setReplacing(replaceContentId);
    try {
      // Generate new file path
      const fileExt = file.name.split('.').pop();
      const newFilePath = `${crypto.randomUUID()}.${fileExt}`;

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('content-files')
        .upload(newFilePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      // Update content record with new file path
      const { error: updateError } = await supabase
        .from('content')
        .update({ file_path: newFilePath })
        .eq('id', replaceContentId);

      if (updateError) throw updateError;

      // Delete old file from storage (non-blocking)
      supabase.storage
        .from('content-files')
        .remove([content.file_path])
        .then(({ error }) => {
          if (error) console.warn('Old file cleanup warning:', error);
        });

      toast({ title: 'Success', description: 'File replaced successfully' });
      fetchContents();
    } catch (error) {
      console.error('Replace error:', error);
      toast({
        title: 'Replace Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setReplacing(null);
      setReplaceContentId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (contentId: string, file: File) => {
    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('content-covers')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content-covers')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('content')
        .update({ cover_url: publicUrl })
        .eq('id', contentId);

      if (updateError) throw updateError;

      toast({ title: 'Success', description: 'Cover updated' });
      fetchContents();
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload cover',
        variant: 'destructive',
      });
    }
  };

  const handleCoverClick = (contentId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: 'Error', description: 'Image must be less than 5MB', variant: 'destructive' });
          return;
        }
        handleCoverUpload(contentId, file);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 p-8 text-center">
        <BookCover coverUrl={null} title="" size="lg" className="mb-4 opacity-50" />
        <p className="text-muted-foreground font-display">No publications yet</p>
        <p className="text-sm text-muted-foreground">Upload your first PDF above</p>
      </div>
    );
  }

  return (
    <>
      {/* Hidden file input for replace functionality */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />
      
      <div className="space-y-3">
        {contents.map((content) => (
          <div
            key={content.id}
            className="flex items-center gap-4 rounded-xl bg-card p-4 border border-border"
          >
            {/* Cover with edit option */}
            <button
              onClick={() => handleCoverClick(content.id)}
              className="relative group flex-shrink-0"
              title="Click to change cover"
            >
              <BookCover coverUrl={content.cover_url} title={content.title} size="sm" />
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>

            <div className="min-w-0 flex-1">
              <h4 className="font-display font-semibold truncate">{content.title}</h4>
              {content.description && (
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                  {content.description}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  ₹{content.price}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    content.is_active
                      ? 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {content.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(content.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onManageAccess(content)}
                title="Manage user access"
              >
                <Users className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReplaceClick(content.id)}
                disabled={replacing === content.id}
                title="Replace file"
              >
                {replacing === content.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleActive(content)}
                title={content.is_active ? 'Deactivate' : 'Activate'}
              >
                {content.is_active ? (
                  <ToggleRight className="h-4 w-4 text-success" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteContent(content)}
                title="Delete content"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteContent} onOpenChange={() => setDeleteContent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteContent?.title}"? This will remove the file
              and all user access records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
