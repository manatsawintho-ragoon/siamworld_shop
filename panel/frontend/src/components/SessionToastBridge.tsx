'use client';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';

/**
 * Bridges sessionMessage from AuthContext → Toast notifications.
 * Must be mounted inside both <AuthProvider> and <ToastProvider>.
 */
export default function SessionToastBridge() {
  const { sessionMessage, clearSessionMessage } = useAuth();
  const { warning } = useToast();

  useEffect(() => {
    if (!sessionMessage) return;
    warning('เซสชันสิ้นสุด', sessionMessage);
    clearSessionMessage();
  }, [sessionMessage, warning, clearSessionMessage]);

  return null;
}
