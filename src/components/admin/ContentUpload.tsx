import { useState, useRef } from 'react';
import { Upload, FileUp, X, Loader2, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CoverUpload } from './CoverUpload';

interface ContentUploadProps {
  onSuccess: () => void;
}

export function ContentUpload({ onSuccess }: ContentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        return;
      }
      // Warn for very large files but don't prevent
      if (file.size > 100 * 1024 * 1024) { // 100MB
        toast({ 
          title: 'Large File', 
          description: 'This is a large file. Upload may take a while.', 
        });
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace('.pdf', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim() || !price.trim()) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({ title: 'Error', description: 'Please enter a valid price', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Generate unique file path
      const timestamp = Date.now();
      const fileName = `${timestamp}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `content/${fileName}`;

      // For large files, we'll use chunked upload simulation with progress
      const totalSize = selectedFile.size;
      const chunkSize = 1024 * 1024; // 1MB chunks for progress tracking
      let uploadedBytes = 0;

      // Create a custom upload with progress tracking using XMLHttpRequest
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('', selectedFile);

      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const response = JSON.parse(xhr.responseText);
              reject(new Error(response.message || response.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/content-files/${filePath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.send(selectedFile);

      await uploadPromise;

      // Create content record
      setUploadProgress(100);
      
      const { error: insertError } = await supabase
        .from('content')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_path: filePath,
          is_active: true,
          price: priceValue,
          cover_url: coverUrl,
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
      setPrice('');
      setCoverUrl(null);
      setUploadProgress(0);
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
      setUploadProgress(0);
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
      <h3 className="flex items-center gap-2 font-semibold font-display">
        <Upload className="h-5 w-5" />
        Upload New Publication
      </h3>

      <div className="grid grid-cols-[auto_1fr] gap-4">

        {/* Cover Upload */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Cover Image</Label>
          <CoverUpload coverUrl={coverUrl} onCoverChange={setCoverUrl} disabled={uploading} />
        </div>

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
                <Button variant="ghost" size="sm" onClick={clearSelection} disabled={uploading}>
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
            disabled={uploading}
          />
        </div>

        {/* Price */}
        <div>
          <Label htmlFor="price">Price (₹) *</Label>
          <div className="relative mt-1.5">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price"
              className="pl-9"
              disabled={uploading}
            />
          </div>
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
            disabled={uploading}
          />
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !title.trim() || !price.trim() || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading... {uploadProgress}%
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
    </div>
  );
}
