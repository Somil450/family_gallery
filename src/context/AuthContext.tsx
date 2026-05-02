/**
 * Unified App Context — works in two modes:
 *
 *  LOCAL mode  (default, no Firebase config required)
 *   → localStorage + IndexedDB, fully functional on a single device
 *   → Real users, real families, real invite codes, real images
 *
 *  FIREBASE mode (when real credentials are in .env)
 *   → Full Firebase Auth + Firestore + Storage, multi-device sync
 */

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { subscribeToAuthState } from '../firebase/auth';
import { subscribeToUser, subscribeToFamily } from '../firebase/firestore';
import { isFirebaseConfigured } from '../firebase/config';
import type { UserDoc, FamilyDoc } from '../types';
import {
  localGetCurrentUser,
  localGetFamily,
  type LocalUser,
  type LocalFamily,
} from '../lib/localStore';
import { Timestamp } from 'firebase/firestore';

// ─── Convert local types to shared types ─────────────────────────────────────

function toUserDoc(u: LocalUser): UserDoc {
  return {
    uid: u.uid,
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
    familyId: u.familyId,
    role: u.role,
    storageUsedBytes: u.storageUsedBytes,
    createdAt: Timestamp.fromDate(new Date(u.createdAt)),
    fcmTokens: u.fcmTokens,
  };
}

function toFamilyDoc(f: LocalFamily): FamilyDoc {
  return {
    id: f.id,
    name: f.name,
    adminUid: f.adminUid,
    inviteCode: f.inviteCode,
    inviteCodeExpiry: Timestamp.fromDate(new Date(f.inviteCodeExpiry)),
    memberUids: f.memberUids,
    storageUsedBytes: f.storageUsedBytes,
    storageLimitBytes: f.storageLimitBytes,
    createdAt: Timestamp.fromDate(new Date(f.createdAt)),
  };
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Only set in Firebase mode */
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  family: FamilyDoc | null;
  loading: boolean;
  /** true = using localStorage backend (no Firebase credentials) */
  isLocalMode: boolean;
  members: (UserDoc | LocalUser)[];
  /** Call this to force a re-read of localStorage after mutations */
  refreshLocal: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userDoc: null,
  family: null,
  members: [],
  loading: true,
  isLocalMode: false,
  refreshLocal: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // ── LOCAL MODE ─────────────────────────────────────────────────────────────
  if (!isFirebaseConfigured) {
    return <LocalProvider>{children}</LocalProvider>;
  }

  // ── FIREBASE MODE ──────────────────────────────────────────────────────────
  return <FirebaseProvider>{children}</FirebaseProvider>;
}

// ─── Local provider ───────────────────────────────────────────────────────────

function LocalProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  const refreshLocal = () => setTick(t => t + 1);

  const rawUser = localGetCurrentUser();
  const userDoc = rawUser ? toUserDoc(rawUser) : null;
  const rawFamily = rawUser?.familyId ? localGetFamily(rawUser.familyId) : null;
  const family = rawFamily ? toFamilyDoc(rawFamily) : null;
  const members = family ? localGetFamilyMembers(family.memberUids) : [];

  return (
    <AuthContext.Provider value={{
      firebaseUser: null,
      userDoc,
      family,
      members,
      loading: false,
      isLocalMode: true,
      refreshLocal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Firebase provider ────────────────────────────────────────────────────────

function FirebaseProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [family, setFamily] = useState<FamilyDoc | null>(null);
  const [members, setMembers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToAuthState((user) => {
      setFirebaseUser(user);
      if (!user) { setUserDoc(null); setFamily(null); setLoading(false); }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    return subscribeToUser(firebaseUser.uid, (doc) => {
      setUserDoc(doc);
      setLoading(false);
    });
  }, [firebaseUser]);

  useEffect(() => {
    if (!userDoc?.familyId) { setFamily(null); return; }
    return subscribeToFamily(userDoc.familyId, setFamily);
  }, [userDoc?.familyId]);

  useEffect(() => {
    if (!family?.id) { setMembers([]); return; }
    getFamilyMembers(family.id).then(setMembers);
  }, [family?.id, family?.memberUids.length]);

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      userDoc,
      family,
      members,
      loading,
      isLocalMode: false,
      refreshLocal: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}
