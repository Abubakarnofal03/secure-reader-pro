import { useState, useEffect } from 'react';
import { Clock, Check, X, Eye, Loader2, ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useAuth } from '@/contexts/AuthContext';

interface PurchaseRequest {
  id: string;
  user_id: string;
  content_id: string;
  payment_proof_path: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles: {
    name: string | null;
    email: string;
  };
  content: {
    title: string;
    price: number;
  };
}

export function PurchaseApprovals() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [rejectRequest, setRejectRequest] = useState<PurchaseRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('purchase_requests')
      .select(`
        *,
        profiles!purchase_requests_user_id_fkey (name, email),
        content!purchase_requests_content_id_fkey (title, price)
      `)
      .order('created_at', { ascending: false });

    if (filter === 'pending') {
      query = query.eq('status', 'pending');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching requests:', error);
      toast({ title: 'Error', description: 'Failed to load requests', variant: 'destructive' });
    } else {
      setRequests((data as unknown as PurchaseRequest[]) || []);
    }
    setLoading(false);
  };

  const handleViewProof = async (path: string) => {
    setImageLoading(true);
    setViewImage('loading');
    
    try {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(path, 300); // 5 minute expiry

      if (error) throw error;
      setViewImage(data.signedUrl);
    } catch (error) {
      console.error('Error loading image:', error);
      toast({ title: 'Error', description: 'Failed to load payment proof', variant: 'destructive' });
      setViewImage(null);
    } finally {
      setImageLoading(false);
    }
  };

  const handleApprove = async (request: PurchaseRequest) => {
    setProcessing(request.id);
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.id,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Grant access to content
      const { error: accessError } = await supabase
        .from('user_content_access')
        .upsert(
          { user_id: request.user_id, content_id: request.content_id },
          { onConflict: 'user_id,content_id' }
        );

      if (accessError) throw accessError;

      // Send push notification to the user
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('fcm_token')
          .eq('id', request.user_id)
          .single();

        if (userProfile?.fcm_token) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              title: 'Purchase Approved! 🎉',
              body: `You now have access to "${request.content.title}"`,
              data: {
                type: 'purchase_approved',
                content_id: request.content_id,
              },
              fcmTokens: [userProfile.fcm_token],
            },
          });
          console.log('Approval notification sent to user');
        }
      } catch (notifError) {
        console.log('Push notification failed (non-critical):', notifError);
      }

      toast({ title: 'Approved', description: 'User now has access to the content' });
      fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectRequest) return;
    
    setProcessing(rejectRequest.id);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.id,
        })
        .eq('id', rejectRequest.id);

      if (error) throw error;

      toast({ title: 'Rejected', description: 'Purchase request has been rejected' });
      setRejectRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant={filter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('pending')}
        >
          Pending
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All Requests
        </Button>
        <Button variant="ghost" size="sm" onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {filter === 'pending' ? 'No pending requests' : 'No purchase requests yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl bg-card p-4 border border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{request.profiles.name || 'Unknown User'}</span>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{request.profiles.email}</p>
                  <p className="text-sm mt-1">
                    <span className="text-muted-foreground">Requesting:</span>{' '}
                    <span className="font-medium">{request.content.title}</span>
                    <span className="text-primary ml-2">₹{request.content.price}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {new Date(request.created_at).toLocaleString()}
                  </p>
                  {request.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">
                      Reason: {request.rejection_reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewProof(request.payment_proof_path)}
                    title="View payment proof"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {request.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(request)}
                        disabled={processing === request.id}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Approve"
                      >
                        {processing === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRejectRequest(request)}
                        disabled={processing === request.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Image Dialog */}
      <Dialog open={viewImage !== null} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          <div className="relative min-h-[200px] flex items-center justify-center">
            {imageLoading || viewImage === 'loading' ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : viewImage ? (
              <img
                src={viewImage}
                alt="Payment proof"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-2" />
                <p>Failed to load image</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={!!rejectRequest} onOpenChange={() => setRejectRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Purchase Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this request from {rejectRequest?.profiles.name || rejectRequest?.profiles.email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
