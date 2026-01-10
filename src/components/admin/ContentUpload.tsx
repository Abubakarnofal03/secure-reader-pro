import { useState, useRef } from 'react';
import { Upload, FileUp, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContentUploadProps {
  onSuccess: () => void;
}

export function ContentUpload({ onSuccess }: ContentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace('.pdf', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast({ title: 'Error', description: 'Please select a file and enter a title', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Generate unique file path
      const timestamp = Date.now();
      const fileName = `${timestamp}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `content/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('content-files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Create content record
      const { error: insertError } = await supabase
        .from('content')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_path: filePath,
          is_active: true,
        });

      if (insertError) {
        // If insert fails, try to delete the uploaded file
        await supabase.storage.from('content-files').remove([filePath]);
        throw new Error(`Failed to create content record: ${insertError.message}`);
      }

      toast({ title: 'Success', description: 'Content uploaded successfully' });
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-card p-4 border border-border">
      <h3 className="flex items-center gap-2 font-semibold">
        <Upload className="h-5 w-5" />
        Upload New Content
      </h3>

      <div className="space-y-3">
        {/* File Selection */}
        <div>
          <Label htmlFor="file">PDF File</Label>
          <div className="mt-1.5">
            {selectedFile ? (
              <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileUp className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="truncate text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 hover:border-primary hover:bg-secondary/50 transition-colors"
              >
                <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to select PDF file</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter content title"
            className="mt-1.5"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description"
            rows={2}
            className="mt-1.5"
          />
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !title.trim() || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Content
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
