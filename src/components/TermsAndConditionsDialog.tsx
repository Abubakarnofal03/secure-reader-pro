import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, X, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TermsAndConditionsDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline?: () => void;
  viewOnly?: boolean;
  onClose?: () => void;
}

export function TermsAndConditionsDialog({
  isOpen,
  onAccept,
  onDecline,
  viewOnly = false,
  onClose,
}: TermsAndConditionsDialogProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      // Reset scroll position when dialog opens
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
      if (isAtBottom) {
        setHasScrolledToBottom(true);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg max-h-[90vh] bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <ScrollText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold">Terms & Conditions</h2>
                  <p className="text-xs text-muted-foreground">Please read carefully</p>
                </div>
              </div>
              {viewOnly && onClose && (
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Content - Native scrollable div */}
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 overscroll-contain"
              style={{ minHeight: 0 }}
            >
              <div className="py-5 space-y-5 text-sm leading-relaxed font-body">
                {/* Main Policy - Bold and prominent */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <h3 className="font-display font-bold text-base text-primary mb-2">
                    Intellectual Property Rights
                  </h3>
                  <p className="font-semibold text-foreground">
                    All publications, content, and materials available through this application are the 
                    exclusive intellectual property of <strong>Dr. Hafiz Muhammad Usama Zuhair</strong> and 
                    are associated with{' '}
                    <a 
                      href="https://mycalorics.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 inline-flex items-center gap-1 hover:text-primary/80 transition-colors"
                    >
                      mycalorics.com
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    . Unauthorized reproduction, distribution, or commercial use of any content is 
                    strictly prohibited and may result in legal action.
                  </p>
                </div>

                <div className="divider-premium" />

                <section>
                  <h4 className="font-display font-semibold mb-2">1. Acceptance of Terms</h4>
                  <p className="text-muted-foreground">
                    By accessing and using SecureReader, you acknowledge that you have read, understood, 
                    and agree to be bound by these Terms and Conditions. If you do not agree to these 
                    terms, you must not use this application.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">2. License and Access</h4>
                  <p className="text-muted-foreground">
                    You are granted a limited, non-exclusive, non-transferable license to access and 
                    view the content available through SecureReader solely for personal, non-commercial 
                    purposes. This license does not include the right to:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-2">
                    <li>Modify, copy, or reproduce any content</li>
                    <li>Distribute, publish, or transmit content to third parties</li>
                    <li>Use content for commercial purposes</li>
                    <li>Remove any copyright or proprietary notices</li>
                    <li>Attempt to bypass security measures or access controls</li>
                  </ul>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">3. User Account</h4>
                  <p className="text-muted-foreground">
                    You are responsible for maintaining the confidentiality of your account credentials. 
                    Each account is for single-user access only. Sharing login credentials or allowing 
                    multiple users to access your account is prohibited and may result in account 
                    termination.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">4. Content Protection</h4>
                  <p className="text-muted-foreground">
                    The application employs various security measures to protect content. Any attempt 
                    to circumvent these measures, including but not limited to screen capture, recording, 
                    or unauthorized downloading, is strictly prohibited.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">5. Privacy Policy</h4>
                  <p className="text-muted-foreground">
                    We collect and process personal data in accordance with applicable data protection 
                    laws. Information collected includes email address, name, and usage data for the 
                    purpose of providing and improving our services. We do not sell or share your 
                    personal information with third parties except as required by law.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">6. Device Restrictions</h4>
                  <p className="text-muted-foreground">
                    Your account may be accessed from one device at a time. Simultaneous access from 
                    multiple devices is not permitted. The application tracks device sessions to ensure 
                    compliance with this policy.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">7. Termination</h4>
                  <p className="text-muted-foreground">
                    We reserve the right to suspend or terminate your access to the application at any 
                    time, without prior notice, for violation of these terms or for any other reason 
                    at our sole discretion.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">8. Disclaimer of Warranties</h4>
                  <p className="text-muted-foreground">
                    The application and its content are provided "as is" without warranty of any kind. 
                    We do not guarantee that the service will be uninterrupted, secure, or error-free.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">9. Limitation of Liability</h4>
                  <p className="text-muted-foreground">
                    In no event shall Dr. Hafiz Muhammad Usama Zuhair or mycalorics.com be liable for 
                    any indirect, incidental, special, consequential, or punitive damages arising from 
                    your use of or inability to use the application.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">10. Changes to Terms</h4>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these terms at any time. Continued use of the 
                    application after changes constitutes acceptance of the modified terms.
                  </p>
                </section>

                <section>
                  <h4 className="font-display font-semibold mb-2">11. Contact Information</h4>
                  <p className="text-muted-foreground">
                    For any questions regarding these terms, please contact us through{' '}
                    <a 
                      href="https://mycalorics.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      mycalorics.com
                    </a>
                    .
                  </p>
                </section>

                <div className="pb-4" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 bg-gradient-to-r from-transparent to-primary/5">
              {viewOnly ? (
                <Button
                  onClick={onClose}
                  className="w-full h-11 rounded-xl"
                >
                  Close
                </Button>
              ) : (
                <div className="space-y-3">
                  {!hasScrolledToBottom && (
                    <p className="text-xs text-center text-muted-foreground italic">
                      Please scroll to read all terms before accepting
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={onDecline}
                      className="flex-1 h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                    <Button
                      onClick={onAccept}
                      disabled={!hasScrolledToBottom}
                      className="flex-1 h-11 rounded-xl"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
