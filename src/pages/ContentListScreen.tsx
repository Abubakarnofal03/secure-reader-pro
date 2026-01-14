import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, User, ChevronRight, Library, Clock, CheckCircle, Store, RefreshCw, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseDialog } from '@/components/library/PurchaseDialog';
import { BookCover } from '@/components/library/BookCover';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatPrice } from '@/lib/currency';

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  price: number;
  currency: string;
  cover_url: string | null;
}

interface PurchaseStatus {
  [contentId: string]: 'purchased' | 'pending' | 'rejected' | null;
}

interface ReadingProgress {
  [contentId: string]: number; // percentage 0-100
}

type TabType = 'my-books' | 'store';

export default function ContentListScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({});
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>({});
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
    
    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .select('id, title, description, file_path, price, currency, cover_url')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (contentError) {
      console.error('Error fetching content:', contentError);
    } else {
      setContent(contentData || []);
    }

    const { data: accessData } = await supabase
      .from('user_content_access')
      .select('content_id')
      .eq('user_id', user.id);

    const { data: requestData } = await supabase
      .from('purchase_requests')
      .select('content_id, status')
      .eq('user_id', user.id);

    // Fetch reading progress
    const { data: progressData } = await supabase
      .from('reading_progress')
      .select('content_id, current_page, total_pages')
      .eq('user_id', user.id);

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

    // Calculate reading progress percentages
    const progressMap: ReadingProgress = {};
    progressData?.forEach((item) => {
      if (item.total_pages && item.total_pages > 0) {
        progressMap[item.content_id] = Math.round((item.current_page / item.total_pages) * 100);
      }
    });
    setReadingProgress(progressMap);

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
        return (
          <span className="badge-owned">
            <CheckCircle className="h-3 w-3" />
            Owned
          </span>
        );
      case 'pending':
        return (
          <span className="badge-pending">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const myBooks = content.filter((item) => purchaseStatus[item.id] === 'purchased');
  const storeBooks = content;
  const pendingCount = Object.values(purchaseStatus).filter((s) => s === 'pending').length;

  const displayedContent = activeTab === 'my-books' ? myBooks : storeBooks;

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Premium Header */}
      <header className="sticky top-0 z-10 glass border-b border-border/50">
        <div className="px-5 pt-5 pb-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-[var(--shadow-md)]">
                  <BookOpen className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-md bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)]" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-foreground">Library</h1>
                <p className="text-sm text-muted-foreground">
                  {myBooks.length} publication{myBooks.length !== 1 ? 's' : ''} owned
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary border border-border/50 transition-all hover:bg-secondary/80"
            >
              {profile?.role === 'admin' ? (
                <Crown className="h-5 w-5 text-[hsl(var(--gold))]" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <ThemeToggle />
          </div>

          {/* Premium Tab Switcher */}
          <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
            <button
              onClick={() => setActiveTab('my-books')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === 'my-books'
                  ? 'bg-card text-foreground shadow-[var(--shadow-md)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              My Publications
              {myBooks.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === 'my-books' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {myBooks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === 'store'
                  ? 'bg-card text-foreground shadow-[var(--shadow-md)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Store className="h-4 w-4" />
              Catalogue
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--warning))] text-[hsl(222_47%_11%)]">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
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
        className="flex-1 px-5 py-6 overflow-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-shimmer rounded-2xl" />
            ))}
          </div>
        ) : displayedContent.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                {activeTab === 'my-books' ? (
                  <Library className="h-10 w-10 text-muted-foreground" />
                ) : (
                  <Sparkles className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {activeTab === 'my-books' ? 'No Publications Yet' : 'Coming Soon'}
            </h2>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground leading-relaxed">
              {activeTab === 'my-books'
                ? "You haven't acquired any publications yet. Browse the catalogue to discover valuable medical resources."
                : 'New publications will appear here when available.'}
            </p>
            {activeTab === 'my-books' && storeBooks.length > 0 && (
              <button
                onClick={() => setActiveTab('store')}
                className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all"
              >
                Browse Catalogue
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {displayedContent.map((item, index) => {
                const status = purchaseStatus[item.id];
                const isPurchased = status === 'purchased';
                const isPending = status === 'pending';
                
                if (activeTab === 'my-books' && !isPurchased) return null;
                
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleContentClick(item)}
                    disabled={isPending}
                    className={`group flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left transition-all duration-300 ${
                      isPending 
                        ? 'opacity-60 cursor-not-allowed border-border/50' 
                        : isPurchased
                          ? 'border-[hsl(var(--success)/0.2)] hover:border-[hsl(var(--success)/0.4)] hover:shadow-[var(--shadow-lg)]'
                          : 'border-border/80 hover:border-primary/30 hover:shadow-[var(--shadow-lg)]'
                    }`}
                  >
                    {/* Book Cover */}
                    <BookCover 
                      coverUrl={item.cover_url} 
                      title={item.title} 
                      isOwned={isPurchased}
                      progress={readingProgress[item.id]}
                      size="md"
                    />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        {activeTab === 'store' && getStatusBadge(item.id)}
                        {activeTab === 'store' && !status && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
                            {formatPrice(item.price, item.currency)}
                          </span>
                        )}
                        {activeTab === 'my-books' && (
                          <span className="text-xs font-medium text-muted-foreground">
                            Tap to read
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className={`h-5 w-5 flex-shrink-0 transition-all ${
                      isPurchased 
                        ? 'text-primary group-hover:translate-x-1' 
                        : 'text-muted-foreground group-hover:text-foreground group-hover:translate-x-1'
                    }`} />
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
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
