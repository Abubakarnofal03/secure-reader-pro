import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, BookOpen, LogOut, Settings, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ContentUpload } from '@/components/admin/ContentUpload';
import { ContentList } from '@/components/admin/ContentList';
import { ContentAssignment } from '@/components/admin/ContentAssignment';
import { UserManagement } from '@/components/admin/UserManagement';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { PurchaseApprovals } from '@/components/admin/PurchaseApprovals';
import { supabase } from '@/integrations/supabase/client';

interface Content {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminScreen() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('content');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();
    // Subscribe to purchase_requests changes
    const channel = supabase
      .channel('purchase_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requests' },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('purchase_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };
  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleContentUploaded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleManageAccess = (content: Content) => {
    setSelectedContent(content);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="content" className="flex items-center gap-1 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Content</span>
              </TabsTrigger>
              <TabsTrigger value="approvals" className="flex items-center gap-1 text-xs sm:text-sm relative">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Approvals</span>
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6">
              {/* Upload Section */}
              <ContentUpload onSuccess={handleContentUploaded} />
              
              {/* Content List */}
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-4">
                  <BookOpen className="h-5 w-5" />
                  All Content
                </h3>
                <ContentList 
                  onManageAccess={handleManageAccess}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </TabsContent>

            <TabsContent value="approvals" className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShoppingCart className="h-5 w-5" />
                Purchase Approvals
              </h3>
              <PurchaseApprovals />
            </TabsContent>

            <TabsContent value="users">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <Users className="h-5 w-5" />
                User Management
              </h3>
              <UserManagement />
            </TabsContent>

            <TabsContent value="settings">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <Settings className="h-5 w-5" />
                Settings
              </h3>
              <AdminSettings />
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* Content Assignment Sheet */}
      <ContentAssignment 
        content={selectedContent}
        onClose={() => setSelectedContent(null)}
      />
    </div>
  );
}
