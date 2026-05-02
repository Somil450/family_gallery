import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Share2, Trash2, FolderPlus, X, Images, FolderOpen, Plus, Pencil, ChevronLeft, Search } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useMediaGallery } from '../../hooks/useMedia';
import { useSelection } from '../../hooks/useSelection';
import { isFirebaseConfigured } from '../../firebase/config';
import { searchMedia, deleteMediaDoc } from '../../firebase/firestore';
import {
  localGetMediaMeta, localDeleteMedia, localGetAlbums, localCreateAlbum,
  localAddToAlbum, localRemoveFromAlbum, localDeleteAlbum, localRenameAlbum,
  type LocalAlbum,
} from '../../lib/localStore';
import type { MediaDoc } from '../../types';
import MediaLightbox from '../../components/MediaLightbox';
import AlbumPickerModal from '../../components/AlbumPickerModal';
import InputModal from '../../components/InputModal';

type View = 'photos' | 'albums' | 'album-detail';

export default function GalleryScreen() {
  const { userDoc, refreshLocal } = useAuth();
  const fid = userDoc?.familyId ?? null;
  const { items, loading, hasMore, fetchNextPage, refresh } = useMediaGallery(fid);
  const sel = useSelection();

  const [view, setView] = useState<View>('photos');
  const [openAlbum, setOpenAlbum] = useState<LocalAlbum | null>(null);
  const [albums, setAlbums] = useState<LocalAlbum[]>([]);
  const [lightbox, setLightbox] = useState<MediaDoc | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [renameAlbum, setRenameAlbum] = useState<LocalAlbum | null>(null);
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState<LocalAlbum | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<MediaDoc[] | null>(null);

  const { ref: sentinel, inView } = useInView({ threshold: 0 });
  useEffect(() => { if (inView && hasMore) fetchNextPage(); }, [inView, hasMore]);

  useEffect(() => { if (fid) setAlbums(localGetAlbums(fid)); }, [fid]);

  const refreshAlbums = () => { if (fid) setAlbums(localGetAlbums(fid)); };

  // Display items for current view
  const displayItems = (() => {
    if (view === 'album-detail' && openAlbum) return items.filter(i => openAlbum.mediaIds.includes(i.id));
    if (searchResults) return searchResults;
    return items;
  })();

  // Tap: open lightbox (normal) or toggle select (selection mode)
  const handleTap = (item: MediaDoc) => {
    if (sel.selectionMode) sel.toggle(item.id);
    else setLightbox(item);
  };

  // Batch delete
  const batchDelete = async () => {
    if (!fid) return;
    const count = sel.selected.size;
    const yes = window.confirm(`Delete ${count} memory${count > 1 ? 's' : ''}? This cannot be undone.`);
    if (!yes) return;
    const metas = localGetMediaMeta(fid);
    let deleted = 0;
    for (const id of sel.selected) {
      try {
        if (!isFirebaseConfigured) {
          const m = metas.find(x => x.id === id);
          if (m) await localDeleteMedia(m);
        } else {
          const item = items.find(i => i.id === id);
          if (item) {
            await deleteMediaDoc(item.id, item.familyId, item.uploaderUid, item.sizeBytes);
          }
        }
        deleted++;
      } catch (err) {
        console.error('[batchDelete] failed for', id, err);
      }
    }
    if (openAlbum) localRemoveFromAlbum(fid, openAlbum.id, Array.from(sel.selected));
    await refresh();
    refreshAlbums();
    refreshLocal();
    sel.exit();
    toast.success(`${deleted} memory${deleted > 1 ? 's' : ''} deleted`);
  };

  // Batch share
  const batchShare = async () => {
    const toShare = displayItems.filter(i => sel.selected.has(i.id)).slice(0, 10);
    try {
      const files = await Promise.all(toShare.map(async item => {
        const r = await fetch(item.downloadURL);
        const b = await r.blob();
        return new File([b], `famvault.${item.type === 'video' ? 'mp4' : 'jpg'}`, { type: b.type });
      }));
      if (navigator.canShare?.({ files })) await navigator.share({ files, title: 'Family Memories' });
      else toast('Share not supported on this device');
    } catch (e: any) { if (e?.name !== 'AbortError') toast.error('Share failed'); }
  };

  // Search
  const handleSearch = (q: string) => {
    setSearchQ(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const term = q.toLowerCase();
    setSearchResults(items.filter(i => i.aiLabels.some(l => l.toLowerCase().includes(term))));
  };

  return (
    <div className="page-content" style={{ paddingBottom: 90 }}>
      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <MediaLightbox
            item={lightbox}
            allItems={displayItems}
            onClose={() => setLightbox(null)}
            onDeleted={() => { refresh(); refreshAlbums(); setLightbox(null); }}
          />
        )}
      </AnimatePresence>

      {/* Album picker */}
      <AnimatePresence>
        {showAlbumPicker && fid && (
          <AlbumPickerModal
            familyId={fid}
            uploaderUid={userDoc!.uid}
            albums={albums}
            selectedIds={Array.from(sel.selected)}
            allItems={items}
            onDone={updated => { setAlbums(updated); setShowAlbumPicker(false); sel.exit(); toast.success('Added to album!'); }}
            onClose={() => setShowAlbumPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* New Album Modal */}
      <AnimatePresence>
        {showNewAlbum && fid && userDoc && (
          <InputModal
            title="Create Album"
            placeholder="Album name…"
            confirmLabel="Create"
            onClose={() => setShowNewAlbum(false)}
            onConfirm={(name) => {
              localCreateAlbum(fid, name, userDoc.uid, []);
              refreshAlbums();
              setShowNewAlbum(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Rename Album Modal */}
      <AnimatePresence>
        {renameAlbum && fid && (
          <InputModal
            title="Rename Album"
            placeholder="Album name…"
            defaultValue={renameAlbum.name}
            confirmLabel="Rename"
            onClose={() => setRenameAlbum(null)}
            onConfirm={(name) => {
              localRenameAlbum(fid, renameAlbum.id, name);
              refreshAlbums();
              if (openAlbum?.id === renameAlbum.id) {
                setOpenAlbum(localGetAlbums(fid).find(a => a.id === openAlbum.id) ?? null);
              }
              setRenameAlbum(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Album Modal */}
      <AnimatePresence>
        {confirmDeleteAlbum && fid && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
            onClick={() => setConfirmDeleteAlbum(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '24px 20px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
            >
              <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Delete Album</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>Are you sure you want to delete "{confirmDeleteAlbum.name}"? The photos will remain in your gallery.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setConfirmDeleteAlbum(null)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => {
                  localDeleteAlbum(fid, confirmDeleteAlbum.id);
                  setConfirmDeleteAlbum(null);
                  if (openAlbum?.id === confirmDeleteAlbum.id) {
                    setView('albums');
                    setOpenAlbum(null);
                  }
                  refreshAlbums();
                  toast.success('Album deleted');
                }}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Selection bar ── */}
      <AnimatePresence>
        {sel.selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', backdropFilter: 'blur(16px)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sel.selected.size > 0 ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={sel.exit}><X size={16} /></button>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{sel.selected.size} selected</span>
              </div>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => sel.selectAll(displayItems.map(i => i.id))}>Select All</button>
            </div>
            {sel.selected.size > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <SelBtn icon={<Share2 size={14} />} label="Share" onClick={batchShare} />
                <SelBtn icon={<FolderPlus size={14} />} label="Album" onClick={() => setShowAlbumPicker(true)} accent />
                {view === 'album-detail' && openAlbum && fid && (
                  <SelBtn icon={<X size={14} />} label="Remove" onClick={() => {
                    localRemoveFromAlbum(fid, openAlbum.id, Array.from(sel.selected));
                    refreshAlbums();
                    setOpenAlbum(prev => prev ? { ...prev, mediaIds: prev.mediaIds.filter(id => !sel.selected.has(id)) } : prev);
                    sel.exit(); toast.success('Removed from album');
                  }} />
                )}
                <SelBtn icon={<Trash2 size={14} />} label="Delete" onClick={batchDelete} danger />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      {view === 'album-detail' && openAlbum ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px 10px' }}>
          <button className="btn-icon" style={{ width: 36, height: 36 }} onClick={() => { setView('albums'); setOpenAlbum(null); sel.exit(); }}><ChevronLeft size={18} /></button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{openAlbum.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{displayItems.length} photo{displayItems.length !== 1 ? 's' : ''}</p>
          </div>
          <AlbumActions onRename={() => setRenameAlbum(openAlbum)} onDelete={() => setConfirmDeleteAlbum(openAlbum)} />
        </div>
      ) : (
        <div style={{ padding: '20px 16px 8px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Gallery</h1>
        </div>
      )}

      {/* ── Tabs (only on main views) ── */}
      {view !== 'album-detail' && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
          {(['photos', 'albums'] as const).map(v => (
            <button key={v} className={`chip ${view === v ? 'active' : ''}`} onClick={() => { setView(v); sel.exit(); setSearchResults(null); setSearchQ(''); }}>
              {v === 'photos' ? <><Images size={13} /> Photos</> : <><FolderOpen size={13} /> Albums</>}
            </button>
          ))}
        </div>
      )}

      {/* ── Photos view ── */}
      {(view === 'photos' || view === 'album-detail') && (
        <>
          {/* Search (only all-photos) */}
          {view === 'photos' && (
            <div className="search-bar" style={{ margin: '0 16px 12px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input placeholder="Search memories…" value={searchQ} onChange={e => handleSearch(e.target.value)} />
              {searchQ && <button onClick={() => { setSearchQ(''); setSearchResults(null); }}><X size={14} /></button>}
            </div>
          )}

          {loading && items.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : displayItems.length === 0 ? (
            <EmptyPhotos inAlbum={view === 'album-detail'} />
          ) : (
            <div className="masonry-grid">
              {displayItems.map((item, i) => (
                <PhotoCard
                  key={item.id}
                  item={item}
                  index={i}
                  selected={sel.selected.has(item.id)}
                  selectionMode={sel.selectionMode}
                  onTap={() => handleTap(item)}
                  longPressProps={sel.getLongPressProps(item.id)}
                />
              ))}
              {hasMore && <div ref={sentinel} style={{ height: 1 }} />}
            </div>
          )}
        </>
      )}

      {/* ── Albums view ── */}
      {view === 'albums' && (
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={() => setShowNewAlbum(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '14px 16px', background: 'var(--bg-glass)', border: '1.5px dashed var(--border-strong)', borderRadius: 14, cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}
          >
            <Plus size={18} /> Create New Album
          </button>

          {albums.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <FolderOpen size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>No albums yet</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select photos and tap "Album" to create one</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {albums.map(album => {
                const cover = items.find(i => i.id === album.coverMediaId);
                return (
                  <motion.div key={album.id} whileTap={{ scale: 0.96 }}
                    onClick={() => { setOpenAlbum(album); setView('album-detail'); }}
                    style={{ cursor: 'pointer', borderRadius: 14, overflow: 'hidden', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                    <div style={{ aspectRatio: '1', background: 'var(--border)', overflow: 'hidden' }}>
                      {cover
                        ? <img src={cover.thumbnailURL || cover.downloadURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FolderOpen size={28} color="var(--text-muted)" /></div>}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.name}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{album.mediaIds.length} photo{album.mediaIds.length !== 1 ? 's' : ''}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Photo card with long-press selection ──────────────────────────────────────
function PhotoCard({ item, index, selected, selectionMode, onTap, longPressProps }: {
  item: MediaDoc; index: number; selected: boolean; selectionMode: boolean;
  onTap: () => void; longPressProps: ReturnType<ReturnType<typeof useSelection>['getLongPressProps']>;
}) {
  return (
    <motion.div
      className="masonry-item"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onTap}
      {...longPressProps}
      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' }}
    >
      {item.type === 'video'
        ? <video src={item.downloadURL} muted playsInline style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
        : <img src={item.thumbnailURL || item.downloadURL} alt="" loading="lazy" style={{ aspectRatio: index % 5 === 0 ? '3/4' : '4/3' }} />}

      {/* Selection overlay */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              background: selected ? 'rgba(108,99,255,0.30)' : 'rgba(0,0,0,0.08)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 6,
              border: selected ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'border 0.15s',
            }}
          >
            <motion.div
              animate={{ scale: selected ? 1 : 0.9 }}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: selected ? 'var(--accent)' : 'rgba(255,255,255,0.25)',
                border: `2px solid ${selected ? 'var(--accent)' : 'rgba(255,255,255,0.7)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              {selected && <Check size={12} color="#fff" strokeWidth={3} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyPhotos({ inAlbum }: { inAlbum: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
      <Images size={36} style={{ margin: '0 auto 10px', opacity: 0.25 }} />
      <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{inAlbum ? 'Album is empty' : 'No photos yet'}</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{inAlbum ? 'Add photos from the gallery' : 'Upload your first memory!'}</p>
    </div>
  );
}

// ── Selection action button ───────────────────────────────────────────────────
function SelBtn({ icon, label, onClick, danger, accent }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; accent?: boolean }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
      background: danger ? 'rgba(255,77,109,0.12)' : accent ? 'rgba(124,106,255,0.12)' : 'var(--bg-glass)',
      color: danger ? 'var(--danger)' : accent ? 'var(--accent)' : 'var(--text-primary)',
      fontWeight: 600, fontSize: 12,
    }}>
      {icon} {label}
    </button>
  );
}

// ── Album inline actions (rename/delete) ──────────────────────────────────────
function AlbumActions({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn-icon" style={{ width: 34, height: 34 }} title="Rename" onClick={onRename}>
        <Pencil size={14} />
      </button>
      <button className="btn-icon" style={{ width: 34, height: 34, color: 'var(--danger)' }} title="Delete album" onClick={onDelete}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
