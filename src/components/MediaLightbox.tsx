import { useState, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { X, Share2, Download, Trash2, Info, Check } from 'lucide-react';
import { format } from 'date-fns';
import type { MediaDoc } from '../types';
import { deleteMediaDoc } from '../firebase/firestore';
import { deleteMediaFromStorage } from '../firebase/storage';
import { localDeleteMedia, localGetMediaMeta } from '../lib/localStore';
import { isFirebaseConfigured } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface Props {
  item: MediaDoc;
  allItems?: MediaDoc[];
  onClose: () => void;
  onDeleted?: () => void;
}

export default function MediaLightbox({ item: initial, allItems, onClose, onDeleted }: Props) {
  const { userDoc, refreshLocal } = useAuth();
  const [item, setItem] = useState(initial);
  const [showControls, setShowControls] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const items = allItems ?? [item];
  const idx = items.findIndex(i => i.id === item.id);
  const canDelete = userDoc?.uid === item.uploaderUid || userDoc?.role === 'admin';

  const goTo = useCallback((newIdx: number) => {
    if (newIdx >= 0 && newIdx < items.length) {
      setItem(items[newIdx]);
      setShowInfo(false);
    }
  }, [items]);

  // Swipe to navigate / close
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      // Horizontal swipe → prev/next
      if (offset.x < -60 || velocity.x < -400) goTo(idx + 1);
      else if (offset.x > 60 || velocity.x > 400) goTo(idx - 1);
    } else if (offset.y > 120 || velocity.y > 600) {
      // Swipe down → close
      onClose();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setConfirmDelete(false);
    try {
      if (!isFirebaseConfigured) {
        const metas = localGetMediaMeta(item.familyId);
        const meta = metas.find(m => m.id === item.id);
        if (!meta) throw new Error(`Media not found: ${item.id}`);
        await localDeleteMedia(meta);
        refreshLocal();
      } else {
        await deleteMediaFromStorage(item.storagePath);
        await deleteMediaDoc(item.id, item.familyId, item.uploaderUid, item.sizeBytes);
      }
      toast.success('Memory deleted');
      onDeleted?.();
      onClose();
    } catch (err: any) {
      console.error('[Delete]', err);
      toast.error(`Delete failed: ${err?.message ?? 'unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share && navigator.canShare) {
        const res = await fetch(item.downloadURL);
        const blob = await res.blob();
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        const file = new File([blob], `famvault.${ext}`, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Family Memory' });
          return;
        }
      }
      if (navigator.share) await navigator.share({ url: item.downloadURL, title: 'Family Memory · FamVault' });
      else { await navigator.clipboard.writeText(item.downloadURL); toast.success('Link copied!'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch (e: any) { if (e?.name !== 'AbortError') toast.error('Could not share'); }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = item.downloadURL;
    a.download = `famvault-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
    a.click();
  };

  const dateStr = (() => {
    try {
      const d = (item.takenAt as any)?.toDate?.() ?? new Date(typeof item.takenAt === 'number' ? item.takenAt : 0);
      return format(d, 'MMM d, yyyy · h:mm a');
    } catch { return ''; }
  })();

  return (
    <motion.div
      key="lb"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, userSelect: 'none' }}
      onClick={() => { setShowControls(v => !v); setShowInfo(false); }}
    >
      {/* ── Media with drag gesture ── */}
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={{ left: 0.25, right: 0.25, top: 0.05, bottom: 0.35 }}
        onDragEnd={handleDragEnd}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}
        whileDrag={{ cursor: 'grabbing' }}
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0.6, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
            onClick={() => { setShowControls(v => !v); setShowInfo(false); }}
          >
            {item.type === 'video' ? (
              <video
                src={item.downloadURL}
                controls autoPlay playsInline
                style={{ maxHeight: '100dvh', maxWidth: '100%', objectFit: 'contain' }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <img
                src={item.downloadURL}
                alt=""
                draggable={false}
                style={{ maxHeight: '100dvh', maxWidth: '100%', objectFit: 'contain' }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Controls (tap to reveal) ── */}
      <AnimatePresence>
        {showControls && (
          <>
            {/* Top bar */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                padding: 'calc(env(safe-area-inset-top) + 14px) 18px 32px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10,
              }}
            >
              <button onClick={onClose}
                style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(8px)' }}>
                <X size={20} />
              </button>
              {dateStr && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}>{dateStr}</span>}
              <button onClick={e => { e.stopPropagation(); setShowInfo(v => !v); }}
                style={{ width: 38, height: 38, borderRadius: '50%', background: showInfo ? 'rgba(124,106,255,0.4)' : 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(8px)' }}>
                <Info size={18} />
              </button>
            </motion.div>

            {/* Bottom bar */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '40px 24px calc(env(safe-area-inset-bottom) + 28px)',
                background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)',
                display: 'flex', justifyContent: 'center', gap: 20, zIndex: 10,
              }}
            >
              <LbBtn icon={copied ? <Check size={18} color="#2ee89a" /> : <Share2 size={18} />} label="Share" onClick={handleShare} />
              <LbBtn icon={<Download size={18} />} label="Save" onClick={handleDownload} />
              {canDelete && !confirmDelete && (
                <LbBtn icon={<Trash2 size={18} color="#ff4d6d" />} label="Delete" onClick={() => setConfirmDelete(true)} danger />
              )}
              {canDelete && confirmDelete && (
                <>
                  <LbBtn icon={<X size={18} />} label="Cancel" onClick={() => setConfirmDelete(false)} />
                  <LbBtn icon={<Trash2 size={18} color="#ff4d6d" />} label="Confirm" onClick={handleDelete} loading={deleting} danger />
                </>
              )}
            </motion.div>

            {/* Info panel */}
            <AnimatePresence>
              {showInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', bottom: 120, left: 20, right: 20,
                    background: 'rgba(15,15,30,0.92)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '14px 18px', zIndex: 11,
                  }}
                >
                  {dateStr && <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{dateStr}</p>}
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {(item.sizeBytes / 1024 / 1024).toFixed(1)} MB{item.width ? ` · ${item.width}×${item.height}` : ''}
                  </p>
                  {item.aiLabels.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                      {item.aiLabels.map(l => <span key={l} style={{ fontSize: 10, background: 'rgba(124,106,255,0.25)', color: '#c4baff', padding: '2px 9px', borderRadius: 99, fontWeight: 700 }}>{l}</span>)}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>

      {/* Slide position dots */}
      {items.length > 1 && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, zIndex: 5 }}>
          {items.slice(Math.max(0, idx - 4), idx + 5).map((_, i) => {
            const ri = Math.max(0, idx - 4) + i;
            return <div key={ri} style={{ width: ri === idx ? 14 : 4, height: 4, borderRadius: 99, background: ri === idx ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s' }} />;
          })}
        </div>
      )}
    </motion.div>
  );
}

function LbBtn({ icon, label, onClick, loading, danger }: { icon: React.ReactNode; label: string; onClick: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      background: danger ? 'rgba(255,77,109,0.18)' : 'rgba(255,255,255,0.12)',
      border: `1px solid ${danger ? 'rgba(255,77,109,0.35)' : 'rgba(255,255,255,0.15)'}`,
      borderRadius: 14, padding: '11px 18px', cursor: 'pointer',
      backdropFilter: 'blur(12px)', color: '#fff', minWidth: 60,
      transition: 'background 0.15s, transform 0.1s',
    }}>
      {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : icon}
      <span style={{ fontSize: 10, fontWeight: 700, color: danger ? '#ff4d6d' : 'rgba(255,255,255,0.75)', letterSpacing: 0.4 }}>{label}</span>
    </button>
  );
}
