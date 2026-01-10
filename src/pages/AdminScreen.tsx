import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, BookOpen, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentUpload } from '@/components/admin/ContentUpload';
import { ContentList } from '@/components/admin/ContentList';
import { ContentAssignment } from '@/components/admin/ContentAssignment';
import { UserManagement } from '@/components/admin/UserManagement';

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
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="content" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
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

            <TabsContent value="users">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <Users className="h-5 w-5" />
                User Management
              </h3>
              <UserManagement />
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
