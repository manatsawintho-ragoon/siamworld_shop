import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import SessionToastBridge from '@/components/SessionToastBridge';
import PageTitleManager from '@/components/PageTitle';
import ActivityTracker from '@/components/ActivityTracker';

/**
 * The provider stack shared by both root layouts.
 *
 * There are two roots because <html lang> has to differ: the customer site
 * renders per locale under [locale], while /admin is Thai-only. Extracting the
 * stack here keeps them from drifting apart, which is the usual failure mode
 * when a provider is added to one root and forgotten in the other.
 *
 * FacebookFab is deliberately NOT here: it is a marketing widget and has no
 * business on the operator back office.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SessionToastBridge />
        <PageTitleManager />
        <ActivityTracker />
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
