import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  runTransaction,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { FamilyDoc, MediaDoc, UserDoc } from '../types';
import { nanoid } from '../utils/nanoid';

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export function subscribeToUser(uid: string, cb: (u: UserDoc | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    cb(snap.exists() ? (snap.data() as UserDoc) : null);
  });
}

// ─── Families ─────────────────────────────────────────────────────────────────

export async function createFamily(
  adminUid: string,
  familyName: string
): Promise<string> {
  const familyId = nanoid(20);
  const inviteCode = generateInviteCode();
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await setDoc(doc(db, 'families', familyId), {
    name: familyName,
    adminUid,
    inviteCode,
    inviteCodeExpiry: inviteExpiry,
    memberUids: [adminUid],
    storageUsedBytes: 0,
    storageLimitBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'users', adminUid), {
    familyId,
    role: 'admin',
  });

  return familyId;
}

export async function joinFamilyByCode(
  uid: string,
  inviteCode: string
): Promise<string> {
  const q = query(
    collection(db, 'families'),
    where('inviteCode', '==', inviteCode.toUpperCase())
  );
  const snaps = await getDocs(q);

  if (snaps.empty) throw new Error('Invalid invite code');

  const familySnap = snaps.docs[0];
  const familyId = familySnap.id;
  const userRef = doc(db, 'users', uid);
  const familyRef = doc(db, 'families', familyId);

  await runTransaction(db, async (transaction) => {
    const fSnap = await transaction.get(familyRef);
    if (!fSnap.exists()) throw new Error('Family not found');
    
    const fData = fSnap.data() as FamilyDoc;
    if (new Date() > fData.inviteCodeExpiry.toDate()) {
      throw new Error('Invite code has expired');
    }

    transaction.update(familyRef, {
      memberUids: arrayUnion(uid),
    });

    transaction.update(userRef, {
      familyId,
      role: 'member',
    });
  });

  return familyId;
}

export async function leaveFamily(uid: string, familyId: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const familyRef = doc(db, 'families', familyId);

  await runTransaction(db, async (transaction) => {
    const fSnap = await transaction.get(familyRef);
    if (!fSnap.exists()) throw new Error('Family not found');
    
    const fData = fSnap.data() as FamilyDoc;
    if (fData.adminUid === uid) {
      throw new Error('Admins cannot leave the vault');
    }

    transaction.update(familyRef, {
      memberUids: arrayRemove(uid),
    });

    transaction.update(userRef, {
      familyId: null,
      role: null,
    });
  });
}

export async function disbandFamily(adminUid: string, familyId: string): Promise<void> {
  const userRef = doc(db, 'users', adminUid);
  const familyRef = doc(db, 'families', familyId);

  await runTransaction(db, async (transaction) => {
    const fSnap = await transaction.get(familyRef);
    if (!fSnap.exists()) throw new Error('Family not found');
    
    const fData = fSnap.data() as FamilyDoc;
    if (fData.adminUid !== adminUid) {
      throw new Error('Only the admin can disband the vault');
    }

    // Delete family doc
    transaction.delete(familyRef);
    
    // Reset admin user
    transaction.update(userRef, {
      familyId: null,
      role: null,
    });

    // NOTE: Other members will be orphaned. 
    // In a production app, we would use a Cloud Function to clean up all members.
  });
}

export async function getFamilyDoc(familyId: string): Promise<FamilyDoc | null> {
  const snap = await getDoc(doc(db, 'families', familyId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as FamilyDoc) : null;
}

export function subscribeToFamily(
  familyId: string,
  cb: (f: FamilyDoc | null) => void
) {
  return onSnapshot(doc(db, 'families', familyId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as FamilyDoc) : null);
  });
}

export async function regenerateInviteCode(familyId: string): Promise<string> {
  const newCode = generateInviteCode();
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, 'families', familyId), {
    inviteCode: newCode,
    inviteCodeExpiry: expiry,
  });
  return newCode;
}

export async function getFamilyMembers(familyId: string): Promise<UserDoc[]> {
  const family = await getFamilyDoc(familyId);
  if (!family) return [];
  const promises = family.memberUids.map((uid) => getUserDoc(uid));
  const results = await Promise.all(promises);
  return results.filter(Boolean) as UserDoc[];
}

// ─── Media (paginated, real-time) ─────────────────────────────────────────────

const PAGE_SIZE = 20;

export async function getMediaPage(
  familyId: string,
  cursor?: QueryDocumentSnapshot
): Promise<{ items: MediaDoc[]; lastDoc: QueryDocumentSnapshot | null }> {
  // Bypassing composite index requirement by filtering and sorting client-side.
  // Note: We ignore pagination here to make it work without indexes.
  if (cursor) return { items: [], lastDoc: null };

  const q = query(
    collection(db, 'media'),
    where('familyId', '==', familyId)
  );

  const snaps = await getDocs(q);
  const allDocs = snaps.docs.map((d) => ({ id: d.id, ...d.data() } as MediaDoc));
  const filtered = allDocs.filter(d => !d.isDuplicate);
  filtered.sort((a, b) => b.takenAt.toMillis() - a.takenAt.toMillis());
  
  return { items: filtered, lastDoc: null };
}

export function subscribeToRecentMedia(
  familyId: string,
  cb: (items: MediaDoc[]) => void,
  count = 12,
  onError?: (error: Error) => void
) {
  // To avoid requiring a composite index which the user cannot deploy,
  // we fetch raw documents for the family and filter/sort on the client.
  const q = query(
    collection(db, 'media'),
    where('familyId', '==', familyId),
    limit(50) // Fetch a bit more to account for duplicates we might filter out
  );
  return onSnapshot(q, (snap) => {
    const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaDoc));
    const filtered = allDocs.filter(d => !d.isDuplicate);
    filtered.sort((a, b) => b.takenAt.toMillis() - a.takenAt.toMillis());
    cb(filtered.slice(0, count));
  }, onError);
}

export async function addMediaDoc(mediaData: Omit<MediaDoc, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'media'), mediaData);

  // update family storage usage
  await updateDoc(doc(db, 'families', mediaData.familyId), {
    storageUsedBytes: increment(mediaData.sizeBytes),
  });
  await updateDoc(doc(db, 'users', mediaData.uploaderUid), {
    storageUsedBytes: increment(mediaData.sizeBytes),
  });

  return ref.id;
}

export async function deleteMediaDoc(
  mediaId: string,
  familyId: string,
  uploaderUid: string,
  sizeBytes: number
): Promise<void> {
  await deleteDoc(doc(db, 'media', mediaId));
  await updateDoc(doc(db, 'families', familyId), {
    storageUsedBytes: increment(-sizeBytes),
  });
  await updateDoc(doc(db, 'users', uploaderUid), {
    storageUsedBytes: increment(-sizeBytes),
  });
}

export async function getMediaByFace(
  familyId: string,
  faceId: string
): Promise<MediaDoc[]> {
  const q = query(
    collection(db, 'media'),
    where('familyId', '==', familyId),
    where('faceIds', 'array-contains', faceId),
    orderBy('takenAt', 'desc'),
    limit(50)
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() } as MediaDoc));
}

export async function searchMedia(
  familyId: string,
  searchTerm: string
): Promise<MediaDoc[]> {
  const term = searchTerm.toLowerCase();
  const q = query(
    collection(db, 'media'),
    where('familyId', '==', familyId),
    where('aiLabels', 'array-contains', term),
    orderBy('takenAt', 'desc'),
    limit(50)
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() } as MediaDoc));
}

// ─── "On This Day" Memories ───────────────────────────────────────────────────

export async function getOnThisDayMedia(
  familyId: string
): Promise<MediaDoc[]> {
  const now = new Date();
  const results: MediaDoc[] = [];

  for (let yearsAgo = 1; yearsAgo <= 5; yearsAgo++) {
    const targetDate = new Date(now);
    targetDate.setFullYear(now.getFullYear() - yearsAgo);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'media'),
      where('familyId', '==', familyId),
      where('takenAt', '>=', dayStart),
      where('takenAt', '<=', dayEnd),
      limit(5)
    );
    const snaps = await getDocs(q);
    results.push(...snaps.docs.map((d) => ({ id: d.id, ...d.data() } as MediaDoc)));
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
