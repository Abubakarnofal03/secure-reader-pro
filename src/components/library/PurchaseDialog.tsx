import { useState, useEffect, useRef } from 'react';
import { Upload, Loader2, ImageIcon, X, CheckCircle, CreditCard, Shield, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BookCover } from './BookCover';

interface ContentItem {
  id: string;
  title: string;
  price: number;
  cover_url?: string | null;
}

interface PurchaseDialogProps {
  content: ContentItem | null;
  onClose: () => void;
  onPurchaseSubmitted: () => void;
}

export function PurchaseDialog({ content, onClose, onPurchaseSubmitted }: PurchaseDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bankDetails, setBankDetails] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (content) {
      fetchBankDetails();
      setSelectedFile(null);
      setPreviewUrl(null);
      setSubmitted(false);
    }
  }, [content]);

  const fetchBankDetails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'bank_details')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching bank details:', error);
    }
    setBankDetails(data?.value || 'Bank details not configured. Please contact admin.');
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Error', description: 'Image size must be less than 10MB', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !content || !user) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${content.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: requestData, error: requestError } = await supabase
        .from('purchase_requests')
        .insert({
          user_id: user.id,
          content_id: content.id,
          payment_proof_path: fileName,
        })
        .select('id')
        .single();

      if (requestError) {
        await supabase.storage.from('payment-proofs').remove([fileName]);
        throw requestError;
      }

      try {
        const { data: userData } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single();

        const userName = userData?.name || userData?.email || 'A user';

        await supabase.functions.invoke('send-push-notification', {
          body: {
            title: 'New Purchase Request',
            body: `${userName} requested "${content.title}"`,
            data: {
              type: 'purchase_request',
              request_id: requestData?.id || '',
            },
          },
        });
      } catch (notifError) {
        console.log('Push notification failed (non-critical):', notifError);
      }

      setSubmitted(true);
      toast({ title: 'Success', description: 'Purchase request submitted! Waiting for admin approval.' });
      
      setTimeout(() => {
        onPurchaseSubmitted();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error submitting purchase:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit purchase request',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    clearFile();
    onClose();
  };

  if (!content) return null;

  return (
    <Dialog open={!!content} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 shadow-[var(--shadow-xl)] p-0">
        {/* Premium Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(38_72%_55%)]" />
          <DialogHeader>
            <div className="flex items-start gap-4">
              <BookCover coverUrl={content.cover_url} title={content.title} size="sm" />
              <div className="flex-1 min-w-0">
                <DialogTitle className="font-display text-lg leading-tight line-clamp-2">
                  {content.title}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1 text-sm">
                  Acquire this publication
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center py-12 px-6 text-center">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[hsl(var(--success)/0.15)] to-[hsl(var(--success)/0.05)] flex items-center justify-center border border-[hsl(var(--success)/0.3)]">
                <CheckCircle className="h-10 w-10 text-[hsl(var(--success))]" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-[hsl(43_74%_49%)]" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground">Request Submitted</h3>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs">
              Your acquisition request has been sent for review. You'll be notified once approved.
            </p>
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-5">
            {/* Premium Price Display */}
            <div className="relative rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-5 text-center overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[hsl(43_74%_49%/0.1)] to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount</p>
              <p className="text-4xl font-display font-bold text-foreground mt-1">
                ₹{content.price.toLocaleString()}
              </p>
            </div>

            {/* Bank Details */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Payment Details
              </h4>
              {loading ? (
                <div className="rounded-xl bg-muted/50 p-4 border border-border/50">
                  <div className="h-4 bg-muted rounded animate-shimmer mb-2" />
                  <div className="h-4 bg-muted rounded animate-shimmer w-3/4" />
                </div>
              ) : (
                <div className="rounded-xl bg-muted/50 p-4 border border-border/50">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-foreground leading-relaxed">
                    {bankDetails}
                  </pre>
                </div>
              )}
            </div>

            {/* Payment Proof Upload */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Payment Confirmation</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Upload a screenshot of your completed payment
              </p>
              
              {selectedFile ? (
                <div className="relative rounded-xl border border-border/80 overflow-hidden shadow-[var(--shadow-sm)]">
                  <img
                    src={previewUrl!}
                    alt="Payment proof preview"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="absolute top-3 right-3 h-8 w-8 p-0 bg-card/90 hover:bg-card rounded-lg shadow-[var(--shadow-md)]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-xs text-white/90 truncate font-medium">{selectedFile.name}</p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 p-8 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Upload Screenshot</span>
                  <span className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!selectedFile || uploading}
              className="w-full h-12 rounded-xl text-base"
              variant={selectedFile ? "premium" : "default"}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Requests are typically reviewed within 24 hours
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
