import { Timestamp } from 'firebase/firestore';

export interface UserDoc {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  familyId: string | null;
  role: 'admin' | 'member' | null;
  storageUsedBytes: number;
  createdAt: Timestamp;
  fcmTokens: string[];
}

export interface FamilyDoc {
  id: string;
  name: string;
  adminUid: string;
  inviteCode: string;
  inviteCodeExpiry: Timestamp;
  memberUids: string[];
  storageUsedBytes: number;
  storageLimitBytes: number;
  createdAt: Timestamp;
}

export interface MediaDoc {
  id: string;
  familyId: string;
  uploaderUid: string;
  type: 'image' | 'video';
  storagePath: string;
  downloadURL: string;
  thumbnailURL: string;
  sizeBytes: number;
  takenAt: Timestamp;
  eventId: string | null;
  faceIds: string[];
  aiLabels: string[];
  pHash: string;
  isDuplicate: boolean;
  albumIds: string[];
  width?: number;
  height?: number;
}

export interface AlbumDoc {
  id: string;
  familyId: string;
  name: string;
  createdByUid: string;
  allowedUids: string[];
  coverURL: string;
  mediaCount: number;
  createdAt: Timestamp;
}

export type UploadItem = {
  id: string;
  file: File;
  status: 'queued' | 'compressing' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  previewURL: string;
  error?: string;
  mediaId?: string;
};
