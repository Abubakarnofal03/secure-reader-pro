import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, User, ChevronRight, Library, Lock, Clock, CheckCircle, Store, ShoppingBag, RefreshCw } from 'lucide-react';
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

type TabType = 'my-books' | 'store';

export default function ContentListScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({});
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('my-books');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80;

  useEffect(() => {
    fetchContent();
  }, [user]);

  const fetchContent = useCallback(async (showRefreshIndicator = false) => {
    if (!user) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    
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
    setIsRefreshing(false);
  }, [user]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = mainRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    
    const scrollTop = mainRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    const dampedDistance = Math.min(distance * 0.5, 120);
    setPullDistance(dampedDistance);
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      fetchContent(true);
    }
    isPulling.current = false;
    setPullDistance(0);
  }, [pullDistance, isRefreshing, fetchContent]);

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

  // Filter content based on active tab
  const myBooks = content.filter((item) => purchaseStatus[item.id] === 'purchased');
  const storeBooks = content;
  const pendingCount = Object.values(purchaseStatus).filter((s) => s === 'pending').length;

  const displayedContent = activeTab === 'my-books' ? myBooks : storeBooks;

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Library</h1>
              <p className="text-xs text-muted-foreground">
                {myBooks.length} owned • {storeBooks.length} available
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

        {/* Tab Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('my-books')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'my-books'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            My Books
            {myBooks.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'my-books' ? 'bg-primary-foreground/20' : 'bg-background'
              }`}>
                {myBooks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'store'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Store className="h-4 w-4" />
            Store
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-500 text-yellow-950">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Pull to Refresh Indicator */}
      <div 
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        <motion.div
          animate={{ 
            rotate: isRefreshing ? 360 : (pullDistance / PULL_THRESHOLD) * 180,
            scale: Math.min(pullDistance / PULL_THRESHOLD, 1)
          }}
          transition={{ 
            rotate: isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }
          }}
        >
          <RefreshCw className={`h-6 w-6 ${pullDistance >= PULL_THRESHOLD ? 'text-primary' : 'text-muted-foreground'}`} />
        </motion.div>
      </div>

      {/* Content */}
      <main 
        ref={mainRef}
        className="flex-1 px-4 py-6 overflow-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : displayedContent.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              {activeTab === 'my-books' ? (
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Library className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {activeTab === 'my-books' ? 'No Books Yet' : 'Store Empty'}
            </h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {activeTab === 'my-books'
                ? "You haven't purchased any books yet. Check out the Store to find great reads!"
                : 'New books will appear here when published.'}
            </p>
            {activeTab === 'my-books' && storeBooks.length > 0 && (
              <button
                onClick={() => setActiveTab('store')}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Browse Store
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === 'my-books' ? -20 : 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-3"
          >
            {displayedContent.map((item, index) => {
              const status = purchaseStatus[item.id];
              const isPurchased = status === 'purchased';
              const isPending = status === 'pending';
              
              // In My Books tab, only show purchased - skip if not purchased
              if (activeTab === 'my-books' && !isPurchased) return null;
              
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
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
                      {activeTab === 'store' && getStatusBadge(item.id)}
                      {activeTab === 'store' && !status && (
                        <span className="text-sm font-semibold text-primary">₹{item.price}</span>
                      )}
                      {activeTab === 'my-books' && (
                        <span className="text-xs text-muted-foreground">Tap to read</span>
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
