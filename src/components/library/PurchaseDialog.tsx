import { useState, useEffect, useRef } from 'react';
import { Upload, Loader2, ImageIcon, X, CreditCard, CheckCircle } from 'lucide-react';
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

interface ContentItem {
  id: string;
  title: string;
  price: number;
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
      // Upload payment proof
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${content.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Create purchase request
      const { error: requestError } = await supabase
        .from('purchase_requests')
        .insert({
          user_id: user.id,
          content_id: content.id,
          payment_proof_path: fileName,
        });

      if (requestError) {
        // If insert fails, clean up uploaded file
        await supabase.storage.from('payment-proofs').remove([fileName]);
        throw requestError;
      }

      setSubmitted(true);
      toast({ title: 'Success', description: 'Purchase request submitted! Waiting for admin approval.' });
      
      // Close after a short delay
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Purchase Book
          </DialogTitle>
          <DialogDescription>
            Complete the payment to access "{content.title}"
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Request Submitted!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your purchase request has been sent to the admin for approval.
              You'll be notified once it's approved.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Price */}
            <div className="rounded-lg bg-primary/10 p-4 text-center">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-3xl font-bold text-primary">₹{content.price}</p>
            </div>

            {/* Bank Details */}
            <div>
              <h4 className="text-sm font-medium mb-2">Bank Details</h4>
              {loading ? (
                <div className="rounded-lg bg-muted p-4">
                  <div className="h-4 bg-muted-foreground/20 rounded animate-pulse mb-2" />
                  <div className="h-4 bg-muted-foreground/20 rounded animate-pulse w-3/4" />
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">
                    {bankDetails}
                  </pre>
                </div>
              )}
            </div>

            {/* Payment Proof Upload */}
            <div>
              <h4 className="text-sm font-medium mb-2">Upload Payment Screenshot</h4>
              <p className="text-xs text-muted-foreground mb-2">
                After making the payment, upload a screenshot as proof
              </p>
              
              {selectedFile ? (
                <div className="relative rounded-lg border border-border overflow-hidden">
                  <img
                    src={previewUrl!}
                    alt="Payment proof preview"
                    className="w-full h-48 object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 hover:border-primary hover:bg-secondary/50 transition-colors"
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload payment screenshot</span>
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
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Purchase Request
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your request will be reviewed by an admin within 24 hours
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
