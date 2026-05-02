import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { storage } from './config';
import { computeImageHash } from '../utils/hash';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

export interface UploadResult {
  downloadURL: string;
  thumbnailURL: string;
  storagePath: string;
  sizeBytes: number;
  pHash: string;
  type: 'image' | 'video';
}

const MAX_IMAGE_SIZE_MB = 2;
const MAX_RETRIES = 3;

// ─── Main Upload Function ─────────────────────────────────────────────────────

export async function uploadMedia(
  file: File,
  familyId: string,
  uploaderUid: string,
  onProgress?: (p: UploadProgress) => void
): Promise<UploadResult> {
  const type = file.type.startsWith('video') ? 'video' : 'image';

  let fileToUpload: File = file;
  let thumbnailFile: File | null = null;

  if (type === 'image') {
    console.log('[uploadMedia] Compressing image...', file.name);
    // Compress original
    fileToUpload = await imageCompression(file, {
      maxSizeMB: MAX_IMAGE_SIZE_MB,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
    });

    console.log('[uploadMedia] Generating thumbnail...', file.name);
    // Generate thumbnail (lower res)
    thumbnailFile = await imageCompression(file, {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 400,
      useWebWorker: true,
    });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const basePath = `families/${familyId}/${uploaderUid}/${Date.now()}`;
  const fullPath = `${basePath}/full.${ext}`;
  const thumbPath = `${basePath}/thumb.${ext}`;

  // Compute perceptual hash for dedup (images only)
  let pHash = '';
  if (type === 'image') {
    console.log('[uploadMedia] Computing hash...', file.name);
    pHash = await computeImageHash(fileToUpload);
  }

  console.log('[uploadMedia] Starting upload to storage...', fullPath);

  // Upload full
  const downloadURL = await uploadWithRetry(
    fileToUpload,
    fullPath,
    onProgress,
    MAX_RETRIES
  );

  // Upload thumbnail
  let thumbnailURL = downloadURL;
  if (thumbnailFile) {
    thumbnailURL = await uploadWithRetry(thumbnailFile, thumbPath, undefined, MAX_RETRIES);
  }

  return {
    downloadURL,
    thumbnailURL,
    storagePath: fullPath,
    sizeBytes: fileToUpload.size,
    pHash,
    type,
  };
}

// ─── Upload With Retry ────────────────────────────────────────────────────────

async function uploadWithRetry(
  file: File,
  path: string,
  onProgress?: (p: UploadProgress) => void,
  retries = MAX_RETRIES
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await uploadToStorage(file, path, onProgress);
    } catch (err) {
      lastError = err as Error;
      // Exponential back-off: 1s, 2s, 4s
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('Upload failed after retries');
}

function uploadToStorage(
  file: File,
  path: string,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    task.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const percentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percentage,
          state: snapshot.state as UploadProgress['state'],
        });
      },
      (err) => {
        console.error('[uploadToStorage] Task failed:', path, err);
        reject(err);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteMediaFromStorage(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
