import { useDeepLinking } from '@/hooks/useDeepLinking';

/**
 * Component that handles deep linking in the app.
 * Must be rendered inside BrowserRouter.
 */
export function DeepLinkHandler() {
  useDeepLinking();
  return null;
}
