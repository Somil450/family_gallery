import { useState, useCallback, useRef } from 'react';
import { serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { uploadMedia } from '../firebase/storage';
import { addMediaDoc } from '../firebase/firestore';
import { analyzeImage, extractLabels } from '../utils/vision';
import { isDuplicateHash } from '../utils/hash';
import { nanoid } from '../utils/nanoid';
import type { UploadItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { isFirebaseConfigured } from '../firebase/config';
import { localAddMedia, localGetCurrentUser } from '../lib/localStore';

export function useUpload(onUploadComplete?: () => void) {
  const { firebaseUser, userDoc } = useAuth();
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const processingRef = useRef(false);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setQueue(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processFile = useCallback(async (item: UploadItem) => {
    if (!userDoc?.familyId) return;

    // ── LOCAL MODE ─────────────────────────────────────────────────────────────
    if (!isFirebaseConfigured) {
      const localUser = localGetCurrentUser();
      if (!localUser) return;

      try {
        updateItem(item.id, { status: 'compressing', progress: 5 });
        await localAddMedia(
          userDoc.familyId,
          localUser,
          item.file,
          (pct) => updateItem(item.id, { status: pct < 90 ? 'uploading' : 'processing', progress: Math.round(pct * 0.9) })
        );
        updateItem(item.id, { status: 'done', progress: 100 });
        onUploadComplete?.();
      } catch (err: any) {
        updateItem(item.id, { status: 'error', error: err.message ?? 'Upload failed' });
      }
      return;
    }

    // ── FIREBASE MODE ──────────────────────────────────────────────────────────
    if (!firebaseUser) return;
    const familyId = userDoc.familyId;

    try {
      updateItem(item.id, { status: 'compressing', progress: 5 });

      const result = await uploadMedia(item.file, familyId, firebaseUser.uid, (p) => {
        updateItem(item.id, { status: 'uploading', progress: Math.round(5 + p.percentage * 0.7) });
      });

      updateItem(item.id, { status: 'processing', progress: 80 });

      // Duplicate check
      let isDuplicate = false;
      if (result.pHash && result.type === 'image') {
        const q = query(collection(db, 'media'), where('familyId', '==', familyId), where('type', '==', 'image'));
        const snaps = await getDocs(q);
        for (const snap of snaps.docs) {
          const existingHash = snap.data().pHash as string;
          if (existingHash && isDuplicateHash(result.pHash, existingHash)) { isDuplicate = true; break; }
        }
      }

      // AI analysis
      let aiLabels: string[] = [];
      if (result.type === 'image' && !isDuplicate) {
        const visionResult = await analyzeImage(result.downloadURL);
        if (visionResult) aiLabels = extractLabels(visionResult);
      }

      const mediaId = await addMediaDoc({
        familyId,
        uploaderUid: firebaseUser.uid,
        type: result.type,
        storagePath: result.storagePath,
        downloadURL: result.downloadURL,
        thumbnailURL: result.thumbnailURL,
        sizeBytes: result.sizeBytes,
        takenAt: new Date(item.file.lastModified || Date.now()) as any,
        eventId: null,
        faceIds: [],
        aiLabels,
        pHash: result.pHash,
        isDuplicate,
        albumIds: [],
      });

      updateItem(item.id, { status: 'done', progress: 100, mediaId });
      onUploadComplete?.();
    } catch (err: any) {
      updateItem(item.id, { status: 'error', error: err.message ?? 'Upload failed' });
    }
  }, [firebaseUser, userDoc, updateItem, onUploadComplete]);

  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: nanoid(10),
      file,
      status: 'queued' as const,
      progress: 0,
      previewURL: URL.createObjectURL(file),
    }));

    setQueue(prev => [...prev, ...newItems]);

    (async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      for (const item of newItems) await processFile(item);
      processingRef.current = false;
    })();
  }, [processFile]);

  const removeItem = useCallback((id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewURL);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const clearDone = useCallback(() => {
    setQueue(prev => prev.filter(i => i.status !== 'done'));
  }, []);

  return { queue, addFiles, removeItem, clearDone };
}
