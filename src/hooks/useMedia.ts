import { useState, useEffect, useCallback, useRef } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { getMediaPage, subscribeToRecentMedia } from '../firebase/firestore';
import { isFirebaseConfigured } from '../firebase/config';
import { localGetMediaWithURLs } from '../lib/localStore';
import type { MediaDoc } from '../types';
import { Timestamp } from 'firebase/firestore';

// Shape returned by localGetMediaWithURLs (async, per item)
interface LocalMediaWithURL {
  id: string; familyId: string; uploaderUid: string; uploaderName?: string;
  type: 'image' | 'video'; name: string; sizeBytes: number; takenAt: number;
  aiLabels: string[]; isDuplicate: boolean; pHash: string;
  width: number; height: number; hasThumb: boolean;
  downloadURL: string; thumbnailURL: string;
}

function toMediaDoc(m: LocalMediaWithURL): MediaDoc {
  return {
    id: m.id,
    familyId: m.familyId,
    uploaderUid: m.uploaderUid,
    type: m.type,
    storagePath: m.id,
    downloadURL: m.downloadURL,
    thumbnailURL: m.thumbnailURL,
    sizeBytes: m.sizeBytes,
    takenAt: Timestamp.fromDate(new Date(m.takenAt)),
    eventId: null,
    faceIds: [],
    aiLabels: m.aiLabels,
    pHash: m.pHash,
    isDuplicate: m.isDuplicate,
    albumIds: [],
    width: m.width,
    height: m.height,
  };
}

// ─── Gallery hook ─────────────────────────────────────────────────────────────

export function useMediaGallery(familyId: string | null) {
  const [items, setItems] = useState<MediaDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);

  const refresh = useCallback(async () => {
    if (!familyId) return;

    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        const raw = await localGetMediaWithURLs(familyId);
        setItems(raw.map(toMediaDoc));
        setHasMore(false);
      } else {
        const { items: newItems, lastDoc } = await getMediaPage(familyId, cursorRef.current ?? undefined);
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        cursorRef.current = lastDoc;
        setHasMore(!!lastDoc);
      }
    } catch (e) {
      console.error('Gallery fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  const fetchNextPage = useCallback(async () => {
    if (!familyId || loading || !hasMore) return;
    if (!isFirebaseConfigured) return; // local has no pagination

    setLoading(true);
    try {
      const { items: newItems, lastDoc } = await getMediaPage(familyId, cursorRef.current ?? undefined);
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
      });
      cursorRef.current = lastDoc;
      setHasMore(!!lastDoc);
    } catch (e) {
      console.error('Fetch next page error:', e);
    } finally {
      setLoading(false);
    }
  }, [familyId, loading, hasMore]);

  useEffect(() => {
    if (!familyId) { setItems([]); return; }
    setItems([]);
    cursorRef.current = null;
    setHasMore(!isFirebaseConfigured ? false : true);
    refresh();
  }, [familyId]);

  return { items, loading, hasMore, fetchNextPage, refresh };
}

// ─── Recent media hook ────────────────────────────────────────────────────────

export function useRecentMedia(familyId: string | null, count = 12) {
  const [items, setItems] = useState<MediaDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!familyId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        const raw = await localGetMediaWithURLs(familyId);
        setItems(raw.slice(0, count).map(toMediaDoc));
      }
    } finally {
      setLoading(false);
    }
  }, [familyId, count]);

  useEffect(() => {
    if (!familyId) { setItems([]); setLoading(false); return; }

    if (!isFirebaseConfigured) {
      refresh();
      return;
    }

    const unsub = subscribeToRecentMedia(
      familyId,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      count,
      (err) => {
        console.error('Recent media fetch error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [familyId, count]);

  return { items, loading, refresh };
}
