import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Cloud, Image as Img, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useRecentMedia } from '../../hooks/useMedia';
import { localGetFamilyMembers, type LocalUser } from '../../lib/localStore';
import { isFirebaseConfigured } from '../../firebase/config';
import { getFamilyMembers } from '../../firebase/firestore';
import type { UserDoc, MediaDoc } from '../../types';
import MediaLightbox from '../../components/MediaLightbox';

interface Props {
  onTabChange?: (tab: string) => void;
}

export default function HomeScreen({ onTabChange }: Props) {
  const { userDoc, family, members } = useAuth();
  const { items: recentMedia, loading } = useRecentMedia(userDoc?.familyId ?? null, 12);
  const [lightboxItem, setLightboxItem] = useState<MediaDoc | null>(null);



  const storagePercent = family
    ? Math.min(100, (family.storageUsedBytes / family.storageLimitBytes) * 100)
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-content">
      {lightboxItem && <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px 16px' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{greeting},</p>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{userDoc?.displayName?.split(' ')[0] ?? 'Friend'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-icon"><Bell size={18} /></button>
          <div className="avatar" style={{ width: 40, height: 40, fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
            {userDoc?.photoURL
              ? <img src={userDoc.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : userDoc?.displayName?.[0]?.toUpperCase() ?? 'U'
            }
          </div>
        </div>
      </div>

      {/* Family name + storage */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card"
        style={{ margin: '0 20px 20px', padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cloud size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{family?.name ?? 'Family Vault'}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {fmtBytes(family?.storageUsedBytes ?? 0)} / {fmtBytes(family?.storageLimitBytes ?? 10737418240)}
          </span>
        </div>
        <div className="progress-track">
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${storagePercent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Family members */}
      {members.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="section-header">
            <span className="section-title">Family</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, padding: '0 20px 20px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {members.map((m) => (
              <div key={m.uid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div className="avatar" style={{ width: 52, height: 52, fontSize: 18, overflow: 'hidden' }}>
                  {m.photoURL
                    ? <img src={m.photoURL} alt={m.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : m.displayName[0]?.toUpperCase()
                  }
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 56, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.displayName.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent / Empty state */}
      <div className="section-header" style={{ marginTop: 4 }}>
        <span className="section-title">Recent</span>
        {recentMedia.length > 0 && (
          <button className="btn-ghost" onClick={() => onTabChange?.('gallery')} style={{ fontSize: 12 }}>
            See all
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="spinner" />
        </div>
      ) : recentMedia.length === 0 ? (
        /* ── Beautiful empty state ── */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ margin: '20px', textAlign: 'center' }}
        >
          <div className="glass-card" style={{ padding: '40px 24px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, background: 'var(--grad-primary)',
              margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0.85,
            }}>
              <Img size={36} color="#fff" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Your vault is ready!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Start uploading your family photos and videos. Everything stays private and just for you.
            </p>
            <button className="btn-primary" onClick={() => onTabChange?.('upload')}>
              <Plus size={18} /> Upload Your First Photo
            </button>
          </div>

          {/* Tip cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {[
              { emoji: '📸', title: 'Upload any photo or video', desc: 'JPEG, PNG, MP4, and more supported.' },
              { emoji: '👨‍👩‍👧', title: 'Invite your family', desc: 'Share your invite code from the Profile tab.' },
              { emoji: '🔒', title: 'Completely private', desc: 'Only your family members can view your vault.' },
            ].map(tip => (
              <div key={tip.title} className="glass-card" style={{ display: 'flex', gap: 14, padding: '14px 16px', textAlign: 'left' }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{tip.emoji}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{tip.title}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="masonry-grid" style={{ paddingBottom: 0 }}>
          {recentMedia.map((item, i) => (
            <motion.div
              key={item.id}
              className="masonry-item"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setLightboxItem(item)}
            >
              {item.type === 'video' ? (
                <video src={item.downloadURL} muted playsInline style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
              ) : (
                <img
                  src={item.thumbnailURL || item.downloadURL}
                  alt={item.aiLabels[0] ?? 'Memory'}
                  loading="lazy"
                  style={{ aspectRatio: i % 3 === 0 ? '3/4' : '4/3' }}
                />
              )}
              {item.aiLabels.length > 0 && (
                <div style={{ position: 'absolute', bottom: 6, left: 6 }}>
                  <span className="badge" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)', fontSize: 9 }}>
                    {item.aiLabels[0]}
                  </span>
                </div>
              )}
              <div style={{ position: 'absolute', top: 6, right: 6 }}>
                <span className="badge" style={{ background: 'rgba(124,106,255,0.7)', color: '#fff', backdropFilter: 'blur(4px)', fontSize: 8, padding: '2px 6px' }}>
                  {members.find(m => m.uid === item.uploaderUid)?.displayName.split(' ')[0] ?? 'User'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtBytes(b: number): string {
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
