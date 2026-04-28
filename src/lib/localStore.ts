/**
 * Local-first data layer — fully functional without Firebase.
 * Uses localStorage for metadata and IndexedDB for image blobs.
 * When the user adds real Firebase credentials, everything migrates automatically.
 */

import { idbSet, idbGet, idbDelete } from './idb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  familyId: string | null;
  role: 'admin' | 'member' | null;
  storageUsedBytes: number;
  createdAt: number;
  fcmTokens: string[];
}

export interface LocalFamily {
  id: string;
  name: string;
  adminUid: string;
  inviteCode: string;
  inviteCodeExpiry: number;
  memberUids: string[];
  storageUsedBytes: number;
  storageLimitBytes: number;
  createdAt: number;
}

export interface LocalMedia {
  id: string;
  familyId: string;
  uploaderUid: string;
  uploaderName: string;
  type: 'image' | 'video';
  name: string;
  sizeBytes: number;
  takenAt: number;
  aiLabels: string[];
  isDuplicate: boolean;
  pHash: string;
  width: number;
  height: number;
  hasThumb: boolean;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const K = {
  currentUser: 'fv:user',
  users:       'fv:users',
  families:    'fv:families',
  invites:     'fv:invites',
  media:       (fid: string) => `fv:media:${fid}`,
};

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function ls_get<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); }
  catch { return null; }
}
function ls_set(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ─── ID + code generation ─────────────────────────────────────────────────────

function uid(prefix = 'id'): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Array.from(r).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

// ─── User ─────────────────────────────────────────────────────────────────────

export function localGetCurrentUser(): LocalUser | null {
  return ls_get<LocalUser>(K.currentUser);
}

export function localCreateUser(displayName: string): LocalUser {
  const user: LocalUser = {
    uid: uid('user'),
    displayName: displayName.trim(),
    email: '',
    photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`,
    familyId: null,
    role: null,
    storageUsedBytes: 0,
    createdAt: Date.now(),
    fcmTokens: [],
  };
  _saveUser(user);
  ls_set(K.currentUser, user);
  return user;
}

export function localUpdateCurrentUser(patch: Partial<LocalUser>): LocalUser {
  const cur = localGetCurrentUser()!;
  const updated = { ...cur, ...patch };
  _saveUser(updated);
  ls_set(K.currentUser, updated);
  return updated;
}

export function localGetUser(userUid: string): LocalUser | null {
  const map = ls_get<Record<string, LocalUser>>(K.users) ?? {};
  return map[userUid] ?? null;
}

export function localGetFamilyMembers(memberUids: string[]): LocalUser[] {
  const map = ls_get<Record<string, LocalUser>>(K.users) ?? {};
  return memberUids.map(u => map[u]).filter(Boolean) as LocalUser[];
}

function _saveUser(user: LocalUser) {
  const map = ls_get<Record<string, LocalUser>>(K.users) ?? {};
  map[user.uid] = user;
  ls_set(K.users, map);
}

// ─── Family ───────────────────────────────────────────────────────────────────

export function localCreateFamily(admin: LocalUser, familyName: string): LocalFamily {
  const inviteCode = generateInviteCode();
  const family: LocalFamily = {
    id: uid('family'),
    name: familyName.trim(),
    adminUid: admin.uid,
    inviteCode,
    inviteCodeExpiry: Date.now() + 7 * 86400_000,
    memberUids: [admin.uid],
    storageUsedBytes: 0,
    storageLimitBytes: 10 * 1024 ** 3,
    createdAt: Date.now(),
  };
  _saveFamily(family);
  _addInvite(inviteCode, family.id);
  localUpdateCurrentUser({ familyId: family.id, role: 'admin' });
  return family;
}

export function localJoinFamily(user: LocalUser, code: string): LocalFamily {
  const invites = ls_get<Record<string, string>>(K.invites) ?? {};
  const familyId = invites[code.toUpperCase()];
  if (!familyId) throw new Error('Invalid invite code — please check and try again.');

  const fams = ls_get<Record<string, LocalFamily>>(K.families) ?? {};
  const family = fams[familyId];
  if (!family) throw new Error('Family vault not found.');
  if (Date.now() > family.inviteCodeExpiry) throw new Error('This invite code has expired. Ask your admin to regenerate it.');

  if (!family.memberUids.includes(user.uid)) {
    family.memberUids.push(user.uid);
    _saveFamily(family);
  }
  localUpdateCurrentUser({ familyId: family.id, role: 'member' });
  return family;
}

export function localGetFamily(familyId: string): LocalFamily | null {
  const fams = ls_get<Record<string, LocalFamily>>(K.families) ?? {};
  return fams[familyId] ?? null;
}

export function localRegenerateCode(familyId: string): string {
  const fams = ls_get<Record<string, LocalFamily>>(K.families) ?? {};
  const fam = fams[familyId];
  if (!fam) throw new Error('Family not found');

  const invites = ls_get<Record<string, string>>(K.invites) ?? {};
  delete invites[fam.inviteCode];

  const newCode = generateInviteCode();
  fam.inviteCode = newCode;
  fam.inviteCodeExpiry = Date.now() + 7 * 86400_000;

  _saveFamily(fam);
  _addInvite(newCode, familyId);
  return newCode;
}

export function localUpdateFamilyStorage(familyId: string, deltaBytes: number) {
  const fams = ls_get<Record<string, LocalFamily>>(K.families) ?? {};
  if (fams[familyId]) {
    fams[familyId].storageUsedBytes = Math.max(0, fams[familyId].storageUsedBytes + deltaBytes);
    ls_set(K.families, fams);
  }
}

function _saveFamily(fam: LocalFamily) {
  const fams = ls_get<Record<string, LocalFamily>>(K.families) ?? {};
  fams[fam.id] = fam;
  ls_set(K.families, fams);
}

function _addInvite(code: string, familyId: string) {
  const invites = ls_get<Record<string, string>>(K.invites) ?? {};
  invites[code] = familyId;
  ls_set(K.invites, invites);
}

// ─── Media ────────────────────────────────────────────────────────────────────

export function localGetMediaMeta(familyId: string): LocalMedia[] {
  return ls_get<LocalMedia[]>(K.media(familyId)) ?? [];
}

export async function localAddMedia(
  familyId: string,
  uploader: LocalUser,
  file: File,
  onProgress?: (pct: number) => void
): Promise<LocalMedia & { downloadURL: string; thumbnailURL: string }> {
  const mediaId = uid('media');
  onProgress?.(10);

  // Store full blob
  await idbSet(mediaId, file);
  onProgress?.(60);

  // Generate thumbnail
  let hasThumb = false;
  let width = 0;
  let height = 0;
  if (file.type.startsWith('image/')) {
    try {
      const { blob: thumb, w, h } = await createThumbnail(file, 600);
      await idbSet(`${mediaId}_thumb`, thumb);
      hasThumb = true;
      width = w;
      height = h;
    } catch { /* no thumb */ }
  }
  onProgress?.(90);

  const meta: LocalMedia = {
    id: mediaId,
    familyId,
    uploaderUid: uploader.uid,
    uploaderName: uploader.displayName,
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    sizeBytes: file.size,
    takenAt: file.lastModified || Date.now(),
    aiLabels: guessLabels(file.name),
    isDuplicate: false,
    pHash: '',
    width,
    height,
    hasThumb,
  };

  // Prepend to list (newest first)
  const all = localGetMediaMeta(familyId);
  all.unshift(meta);
  ls_set(K.media(familyId), all);

  // Update storage counters
  localUpdateFamilyStorage(familyId, file.size);
  const cur = localGetCurrentUser();
  if (cur?.uid === uploader.uid) {
    localUpdateCurrentUser({ storageUsedBytes: (cur.storageUsedBytes ?? 0) + file.size });
  }

  onProgress?.(100);

  const downloadURL = URL.createObjectURL(file);
  const thumbBlob = hasThumb ? await idbGet(`${mediaId}_thumb`) : null;
  const thumbnailURL = thumbBlob ? URL.createObjectURL(thumbBlob) : downloadURL;

  return { ...meta, downloadURL, thumbnailURL };
}

export async function localGetMediaWithURLs(
  familyId: string
): Promise<(LocalMedia & { downloadURL: string; thumbnailURL: string })[]> {
  const all = localGetMediaMeta(familyId);
  const result: (LocalMedia & { downloadURL: string; thumbnailURL: string })[] = [];

  for (const m of all) {
    const blob = await idbGet(m.id);
    if (!blob) continue;
    const downloadURL = URL.createObjectURL(blob);
    const thumbBlob = m.hasThumb ? await idbGet(`${m.id}_thumb`) : null;
    const thumbnailURL = thumbBlob ? URL.createObjectURL(thumbBlob) : downloadURL;
    result.push({ ...m, downloadURL, thumbnailURL });
  }
  return result;
}

export async function localDeleteMedia(media: LocalMedia): Promise<void> {
  const all = localGetMediaMeta(media.familyId);
  ls_set(K.media(media.familyId), all.filter(m => m.id !== media.id));
  await idbDelete(media.id);
  await idbDelete(`${media.id}_thumb`);
  localUpdateFamilyStorage(media.familyId, -media.sizeBytes);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createThumbnail(file: File, maxPx: number): Promise<{ blob: Blob; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve({ blob, w, h }) : reject(new Error('toBlob failed')), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}

const LABEL_HINTS: [string[], string[]][] = [
  [['beach', 'sea', 'ocean', 'sand', 'wave'], ['beach', 'ocean', 'travel']],
  [['mountain', 'hill', 'peak', 'trek', 'hike'], ['mountains', 'nature', 'adventure']],
  [['birthday', 'bday', 'cake'], ['birthday', 'celebration']],
  [['wedding', 'bride', 'groom'], ['wedding', 'celebration']],
  [['baby', 'infant', 'newborn'], ['baby', 'family']],
  [['food', 'meal', 'lunch', 'dinner', 'eat'], ['food', 'family']],
  [['park', 'garden', 'picnic'], ['outdoor', 'family']],
  [['christmas', 'xmas'], ['christmas', 'celebration']],
  [['diwali', 'festival'], ['festival', 'celebration']],
  [['graduation', 'grad'], ['graduation', 'achievement']],
  [['trip', 'travel', 'vacation', 'holiday'], ['travel', 'vacation']],
];

function guessLabels(filename: string): string[] {
  const lower = filename.toLowerCase();
  for (const [keywords, labels] of LABEL_HINTS) {
    if (keywords.some(k => lower.includes(k))) return labels;
  }
  return ['family'];
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function localSignOut(): void {
  localStorage.removeItem(K.currentUser);
}

// ─── Albums ───────────────────────────────────────────────────────────────────

export interface LocalAlbum {
  id: string;
  familyId: string;
  name: string;
  coverMediaId: string | null;
  mediaIds: string[];
  createdByUid: string;
  createdAt: number;
}

const K_ALBUMS = (fid: string) => `fv:albums:${fid}`;

export function localGetAlbums(familyId: string): LocalAlbum[] {
  return ls_get<LocalAlbum[]>(K_ALBUMS(familyId)) ?? [];
}

export function localCreateAlbum(familyId: string, name: string, createdByUid: string, initialIds: string[] = []): LocalAlbum {
  const album: LocalAlbum = {
    id: uid('album'),
    familyId,
    name: name.trim(),
    coverMediaId: initialIds[0] ?? null,
    mediaIds: [...initialIds],
    createdByUid,
    createdAt: Date.now(),
  };
  const all = localGetAlbums(familyId);
  all.unshift(album);
  ls_set(K_ALBUMS(familyId), all);
  return album;
}

export function localAddToAlbum(familyId: string, albumId: string, mediaIds: string[]): void {
  const all = localGetAlbums(familyId);
  const a = all.find(x => x.id === albumId);
  if (!a) return;
  const set = new Set(a.mediaIds);
  mediaIds.forEach(id => set.add(id));
  a.mediaIds = Array.from(set);
  if (!a.coverMediaId) a.coverMediaId = a.mediaIds[0] ?? null;
  ls_set(K_ALBUMS(familyId), all);
}

export function localRemoveFromAlbum(familyId: string, albumId: string, mediaIds: string[]): void {
  const all = localGetAlbums(familyId);
  const a = all.find(x => x.id === albumId);
  if (!a) return;
  const rm = new Set(mediaIds);
  a.mediaIds = a.mediaIds.filter(id => !rm.has(id));
  if (a.coverMediaId && rm.has(a.coverMediaId)) a.coverMediaId = a.mediaIds[0] ?? null;
  ls_set(K_ALBUMS(familyId), all);
}

export function localRenameAlbum(familyId: string, albumId: string, name: string): void {
  const all = localGetAlbums(familyId);
  const a = all.find(x => x.id === albumId);
  if (a) { a.name = name.trim(); ls_set(K_ALBUMS(familyId), all); }
}

export function localDeleteAlbum(familyId: string, albumId: string): void {
  ls_set(K_ALBUMS(familyId), localGetAlbums(familyId).filter(a => a.id !== albumId));
}
