import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, Plus, X } from 'lucide-react';
import type { LocalAlbum } from '../lib/localStore';
import { localCreateAlbum, localAddToAlbum, localGetAlbums } from '../lib/localStore';
import type { MediaDoc } from '../types';

interface Props {
  familyId: string;
  uploaderUid: string;
  albums: LocalAlbum[];
  selectedIds: string[];
  allItems: MediaDoc[]; // for cover preview
  onDone: (updatedAlbums: LocalAlbum[]) => void;
  onClose: () => void;
}

export default function AlbumPickerModal({ familyId, uploaderUid, albums, selectedIds, allItems, onDone, onClose }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const addToExisting = (albumId: string) => {
    localAddToAlbum(familyId, albumId, selectedIds);
    onDone(localGetAlbums(familyId));
  };

  const createAndAdd = () => {
    if (!newName.trim()) return;
    localCreateAlbum(familyId, newName.trim(), uploaderUid, selectedIds);
    onDone(localGetAlbums(familyId));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(env(safe-area-inset-bottom) + 24px)', maxHeight: '70dvh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: 17 }}>Add to Album</h3>
          <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}><X size={16} /></button>
        </div>

        {/* Create new */}
        {creating ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input autoFocus className="input" placeholder="Album name…" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createAndAdd(); }}
              style={{ flex: 1 }} />
            <button className="btn-primary" style={{ width: 'auto', padding: '0 20px' }} onClick={createAndAdd}>Create</button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px', background: 'var(--bg-glass)', border: '1.5px dashed var(--border-strong)', borderRadius: 12, cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
            <Plus size={18} /> New Album
          </button>
        )}

        {/* Existing albums */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {albums.map(album => {
            const cover = allItems.find(i => i.id === album.coverMediaId);
            return (
              <button key={album.id} onClick={() => addToExisting(album.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: 'var(--border)', flexShrink: 0 }}>
                  {cover && <img src={cover.thumbnailURL || cover.downloadURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {!cover && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FolderPlus size={20} color="var(--text-muted)" /></div>}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{album.name}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{album.mediaIds.length} photos</p>
                </div>
              </button>
            );
          })}
          {albums.length === 0 && !creating && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No albums yet — create your first one above!</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
