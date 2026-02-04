import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionInvalidatedDialog } from "@/components/SessionInvalidatedDialog";
import { DeviceConflictDialog } from "@/components/DeviceConflictDialog";
import { TermsAndConditionsDialog } from "@/components/TermsAndConditionsDialog";
import { DeepLinkHandler } from "@/components/DeepLinkHandler";
import { FCMHandler } from "@/components/FCMHandler";
import { useTermsAcceptance } from "@/hooks/useTermsAcceptance";
import { ThemeProvider } from "next-themes";
import { LoadingScreen } from "@/components/LoadingScreen";
import { initializePushNotifications } from "@/services/pushNotifications";
import { useEffect } from "react";

import SplashScreen from "./pages/SplashScreen";
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";
import ForgotPasswordScreen from "./pages/ForgotPasswordScreen";
import ResetPasswordScreen from "./pages/ResetPasswordScreen";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import EmailConfirmationPendingScreen from "./pages/EmailConfirmationPendingScreen";
import AccessPendingScreen from "./pages/AccessPendingScreen";
import ContentListScreen from "./pages/ContentListScreen";
import SecureReaderScreen from "./pages/SecureReaderScreen";
import ProfileScreen from "./pages/ProfileScreen";
import AdminScreen from "./pages/AdminScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const { hasAcceptedTerms, isLoading, acceptTerms } = useTermsAcceptance();

  // Initialize push notifications on app start
  useEffect(() => {
    initializePushNotifications().catch(console.error);
  }, []);

  const handleDeclineTerms = () => {
    // Close the app or show blocked state
    // On web, we can't really close the tab, so we show a blocked message
    window.location.href = 'about:blank';
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      {/* Terms dialog - blocks app usage until accepted */}
      <TermsAndConditionsDialog
        isOpen={!hasAcceptedTerms}
        onAccept={acceptTerms}
        onDecline={handleDeclineTerms}
      />

      {/* Only render app content if terms accepted */}
      {hasAcceptedTerms && (
        <BrowserRouter>
          <AuthProvider>
            <SessionInvalidatedDialog />
            <DeviceConflictDialog />
            <DeepLinkHandler />
            <FCMHandler />
            <Routes>
              <Route path="/" element={<SplashScreen />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
              <Route path="/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/auth-callback" element={<AuthCallbackPage />} />
              <Route path="/confirm-email-pending" element={<EmailConfirmationPendingScreen />} />
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
      )}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
