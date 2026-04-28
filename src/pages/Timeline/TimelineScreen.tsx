import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Calendar, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMediaGallery } from '../../hooks/useMedia';
import { getOnThisDayMedia } from '../../firebase/firestore';
import type { MediaDoc } from '../../types';
import MediaLightbox from '../../components/MediaLightbox';

type GroupedMedia = { year: number; month: string; items: MediaDoc[] }[];

export default function TimelineScreen() {
  const { userDoc } = useAuth();
  const { items, loading, hasMore, fetchNextPage } = useMediaGallery(userDoc?.familyId ?? null);
  const [memories, setMemories] = useState<MediaDoc[]>([]);
  const [lightboxItem, setLightboxItem] = useState<MediaDoc | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'memories'>('timeline');

  useEffect(() => {
    if (!userDoc?.familyId) return;
    getOnThisDayMedia(userDoc.familyId).then(setMemories);
  }, [userDoc?.familyId]);

  // Load all pages for timeline
  useEffect(() => {
    if (hasMore && !loading && items.length < 200) fetchNextPage();
  }, [items.length]);

  const grouped: GroupedMedia = useMemo(() => {
    const map = new Map<string, MediaDoc[]>();
    items.forEach((item) => {
      const date = (item.takenAt as any)?.toDate?.() ?? new Date();
      const key = format(date, 'yyyy-MMMM');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([key, groupItems]) => {
      const [year, month] = key.split('-');
      return { year: parseInt(year), month, items: groupItems };
    });
  }, [items]);

  return (
    <div className="page-content">
      {lightboxItem && <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}

      <div style={{ padding: '24px 20px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Memories</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Your family story over time</p>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 4, margin: '0 20px 20px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
        {(['timeline', 'memories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? 'var(--accent)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            {tab === 'timeline' ? '📅 Timeline' : '✨ On This Day'}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' ? (
        <div style={{ padding: '0 20px', position: 'relative' }}>
          {/* Vertical line */}
          <div className="timeline-line" style={{ left: 36 }} />

          {grouped.map((group, gi) => (
            <motion.div
              key={`${group.year}-${group.month}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: gi * 0.05 }}
              style={{ marginBottom: 28, paddingLeft: 52 }}
            >
              {/* Month/Year badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative', left: -52 }}>
                <div className="timeline-dot" style={{ marginLeft: 12 }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{group.month}</span>
                  <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>{group.year}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{group.items.length} memories</span>
              </div>

              {/* Photo row */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {group.items.slice(0, 8).map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLightboxItem(item)}
                    style={{ flexShrink: 0, width: 90, height: 90, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <img
                      src={item.thumbnailURL || item.downloadURL}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  </motion.div>
                ))}
                {group.items.length > 8 && (
                  <div style={{ flexShrink: 0, width: 90, height: 90, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>+{group.items.length - 8}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>more</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <span className="spinner" />
            </div>
          )}

          {!loading && grouped.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>Start uploading to build your timeline!</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          {memories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <Sparkles size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>No memories from past years on this date yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                ✨ On This Day — {format(new Date(), 'MMMM d')}
              </p>
              {memories.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="glass-card"
                  style={{ overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setLightboxItem(item)}
                >
                  <img src={item.thumbnailURL || item.downloadURL} alt="" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>
                      {(item.takenAt as any)?.toDate ? format((item.takenAt as any).toDate(), 'MMMM d, yyyy') : ''}
                    </p>
                    {item.aiLabels.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {item.aiLabels.slice(0, 3).map((l) => (
                          <span key={l} className="badge badge-primary">{l}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
