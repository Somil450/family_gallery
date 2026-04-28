/**
 * Web Share Target handler.
 *
 * When the user shares photos/videos from another app (camera roll, WhatsApp, etc.)
 * to FamVault, the OS sends a POST to /share-target with the files.
 * This component intercepts that, auto-uploads the files, and redirects to the gallery.
 *
 * How it works:
 * - The manifest.json registers FamVault as a share target
 * - The service worker catches the POST and forwards files via postMessage
 * - On load, this component checks for pending shared files and uploads them
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUpload } from '../hooks/useUpload';
import { useAuth } from './AuthContext';

interface ShareTargetState {
  files: File[];
  active: boolean;
}

export function useShareTarget(onComplete?: () => void) {
  const { userDoc } = useAuth();
  const [state, setState] = useState<ShareTargetState>({ files: [], active: false });
  const { addFiles } = useUpload(onComplete);

  useEffect(() => {
    // Check if we arrived via share-target URL
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith('/share-target') && !url.searchParams.has('share-target')) return;

    // Clean URL without reload
    window.history.replaceState({}, '', '/');

    // The service worker will postMessage the files here
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'SHARE_TARGET_FILES') return;
      const files: File[] = event.data.files;
      if (!files?.length) return;

      if (!userDoc?.familyId) {
        toast.error('Join a family first to upload!');
        return;
      }

      setState({ files, active: true });
      addFiles(files);
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} received — uploading to vault!`);
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [userDoc?.familyId]);

  const dismiss = () => setState(s => ({ ...s, active: false }));

  return { sharedFiles: state.files, shareActive: state.active, dismissShare: dismiss };
}

// ── Share Target Toast (shown when files arrive) ──────────────────────────────
export function ShareTargetToast({ files, onDismiss }: { files: File[]; onDismiss: () => void }) {
  if (!files.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -32 }}
        style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20,20,35,0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124,106,255,0.35)',
          borderRadius: 16, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          zIndex: 9999, maxWidth: 400, width: '90%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          color: '#fff',
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Upload size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 14 }}>Uploading to vault…</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
            {files.length} file{files.length > 1 ? 's' : ''} received
          </p>
        </div>
        <button onClick={onDismiss} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
