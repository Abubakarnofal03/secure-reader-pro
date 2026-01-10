import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionInvalidatedDialog } from "@/components/SessionInvalidatedDialog";

import SplashScreen from "./pages/SplashScreen";
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";
import AccessPendingScreen from "./pages/AccessPendingScreen";
import ContentListScreen from "./pages/ContentListScreen";
import SecureReaderScreen from "./pages/SecureReaderScreen";
import ProfileScreen from "./pages/ProfileScreen";
import AdminScreen from "./pages/AdminScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SessionInvalidatedDialog />
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/access-pending" element={
              <ProtectedRoute requireAccess={false}>
                <AccessPendingScreen />
              </ProtectedRoute>
            } />
            <Route path="/library" element={
              <ProtectedRoute>
                <ContentListScreen />
              </ProtectedRoute>
            } />
            <Route path="/reader/:id" element={
              <ProtectedRoute>
                <SecureReaderScreen />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute requireAccess={false}>
                <ProfileScreen />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminScreen />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
