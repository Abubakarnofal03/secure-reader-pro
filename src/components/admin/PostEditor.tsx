import { useState, useEffect } from 'react';
import { X, Upload, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RichTextEditor } from './RichTextEditor';
import { Post, CreatePostData, usePostManagement } from '@/hooks/usePostManagement';

interface PostEditorProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function PostEditor({ post, isOpen, onClose, onSaved }: PostEditorProps) {
  const { createPost, updatePost, uploadCoverImage } = usePostManagement();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState<'news' | 'blog' | 'highlight'>('news');
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setExcerpt(post.excerpt || '');
      setCategory(post.category);
      setCoverUrl(post.cover_image_url || '');
    } else {
      setTitle('');
      setContent('');
      setExcerpt('');
      setCategory('news');
      setCoverUrl('');
    }
  }, [post, isOpen]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadCoverImage(file);
    if (url) {
      setCoverUrl(url);
    }
    setUploading(false);
  };

  const generateExcerpt = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.slice(0, 150).trim() + (text.length > 150 ? '...' : '');
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) {
      return;
    }

    setSaving(true);
    
    const postData: CreatePostData = {
      title: title.trim(),
      content,
      excerpt: excerpt.trim() || generateExcerpt(content),
      cover_image_url: coverUrl || undefined,
      category,
      is_published: publish,
    };

    let success: Post | null;
    
    if (post) {
      success = await updatePost({ id: post.id, ...postData });
    } else {
      success = await createPost(postData);
    }

    setSaving(false);

    if (success) {
      onSaved();
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle>{post ? 'Edit Post' : 'Create Post'}</SheetTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter post title..."
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="highlight">Highlight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image (Optional)</Label>
            <div className="flex items-center gap-3">
              {coverUrl ? (
                <div className="relative">
                  <img 
                    src={coverUrl} 
                    alt="Cover" 
                    className="h-20 w-32 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0"
                    onClick={() => setCoverUrl('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Content</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your post content..."
            />
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (Optional)</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief summary (auto-generated if empty)..."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-generate from content
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || !title.trim()}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || !title.trim()}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {post?.is_published ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
