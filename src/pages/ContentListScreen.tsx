import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, User, ChevronRight, Library, Lock, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseDialog } from '@/components/library/PurchaseDialog';
import { Badge } from '@/components/ui/badge';

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  price: number;
}

interface PurchaseStatus {
  [contentId: string]: 'purchased' | 'pending' | 'rejected' | null;
}

export default function ContentListScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({});
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  useEffect(() => {
    fetchContent();
  }, [user]);

  const fetchContent = async () => {
    if (!user) return;
    
    // Fetch all active content
    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .select('id, title, description, file_path, price')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (contentError) {
      console.error('Error fetching content:', contentError);
    } else {
      setContent(contentData || []);
    }

    // Fetch user's purchased content
    const { data: accessData } = await supabase
      .from('user_content_access')
      .select('content_id')
      .eq('user_id', user.id);

    // Fetch user's pending/rejected requests
    const { data: requestData } = await supabase
      .from('purchase_requests')
      .select('content_id, status')
      .eq('user_id', user.id);

    // Build status map
    const statusMap: PurchaseStatus = {};
    accessData?.forEach((item) => {
      statusMap[item.content_id] = 'purchased';
    });
    requestData?.forEach((item) => {
      if (!statusMap[item.content_id]) {
        statusMap[item.content_id] = item.status as 'pending' | 'rejected';
      }
    });
    setPurchaseStatus(statusMap);
    setLoading(false);
  };

  const handleContentClick = (item: ContentItem) => {
    const status = purchaseStatus[item.id];
    if (status === 'purchased') {
      navigate(`/reader/${item.id}`);
    } else if (status !== 'pending') {
      setSelectedContent(item);
    }
  };

  const getStatusBadge = (contentId: string) => {
    const status = purchaseStatus[contentId];
    switch (status) {
      case 'purchased':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Purchased</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Book Store</h1>
              <p className="text-xs text-muted-foreground">
                {content.length} {content.length === 1 ? 'book' : 'books'} available
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
          >
            <User className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : content.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Library className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No Books Yet</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              New books will appear here when published.
            </p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {content.map((item, index) => {
              const status = purchaseStatus[item.id];
              const isPurchased = status === 'purchased';
              const isPending = status === 'pending';
              
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleContentClick(item)}
                  disabled={isPending}
                  className={`flex w-full items-center gap-4 rounded-xl bg-card p-4 text-left transition-colors ${
                    isPending ? 'opacity-70 cursor-not-allowed' : 'hover:bg-secondary'
                  }`}
                >
                  <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg ${
                    isPurchased ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    {isPurchased ? (
                      <BookOpen className="h-6 w-6 text-primary" />
                    ) : (
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-foreground">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      {getStatusBadge(item.id) || (
                        <span className="text-sm font-semibold text-primary">₹{item.price}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Purchase Dialog */}
      <PurchaseDialog
        content={selectedContent}
        onClose={() => setSelectedContent(null)}
        onPurchaseSubmitted={fetchContent}
      />
    </div>
  );
}
