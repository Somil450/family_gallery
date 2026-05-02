import imageCompression from 'browser-image-compression';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

export interface UploadResult {
  downloadURL: string;
  thumbnailURL: string;
  storagePath: string; // We'll store the public_id here
  sizeBytes: number;
  pHash: string;
  type: 'image' | 'video';
}

const CLOUD_NAME = 'dwen6h0ua';
const UPLOAD_PRESET = 'famvault';

// ─── Main Upload Function (Cloudinary) ────────────────────────────────────────

export async function uploadMedia(
  file: File,
  familyId: string,
  uploaderUid: string,
  onProgress?: (p: UploadProgress) => void
): Promise<UploadResult> {
  const type = file.type.startsWith('video') ? 'video' : 'image';

  // We can still compress images locally before sending to Cloudinary to save bandwidth
  let fileToUpload: File | Blob = file;
  if (type === 'image') {
    try {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      });
    } catch (err) {
      console.warn('[Cloudinary] Compression failed, uploading original', err);
    }
  }

  // Cloudinary Upload via Fetch
  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `families/${familyId}/${uploaderUid}`);
  
  // Custom metadata for Cloudinary
  formData.append('context', `familyId=${familyId}|uploaderUid=${uploaderUid}`);

  const xhr = new XMLHttpRequest();
  const promise = new Promise<any>((resolve, reject) => {
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          bytesTransferred: event.loaded,
          totalBytes: event.total,
          percentage: (event.loaded / event.total) * 100,
          state: 'running',
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        console.error('[Cloudinary] Upload Error:', xhr.responseText);
        reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Cloudinary network error'));
    xhr.send(formData);
  });

  const response = await promise;

  // Generate Thumbnail URL using Cloudinary transformations
  // For videos, Cloudinary can generate a frame at 1s
  const thumbnailURL = type === 'video'
    ? response.secure_url.replace('/upload/', '/upload/w_400,c_limit,q_auto,f_jpg,so_1/')
    : response.secure_url.replace('/upload/', '/upload/w_400,c_limit,q_auto/');

  return {
    downloadURL: response.secure_url,
    thumbnailURL: thumbnailURL,
    storagePath: response.public_id,
    sizeBytes: response.bytes,
    pHash: '', // Cloudinary handles dedup if configured, or we can use public_id
    type,
  };
}

// ─── Delete (Cloudinary doesn't allow unsigned deletes for security) ──────────
// We will just remove the record from Firestore. The storage will be managed 
// via Cloudinary dashboard or a small edge function later if needed.

export async function deleteMediaFromStorage(publicId: string): Promise<void> {
  console.log('[Cloudinary] Unsigned delete not possible via client. Record removed from DB.', publicId);
  // In a real production app, you'd call a secure backend function here.
}
