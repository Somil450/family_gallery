import {
  signInWithPopup,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  User,
  ConfirmationResult,
  RecaptchaVerifier,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './config';

// ─── Google Sign-In ─────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await upsertUserDoc(result.user);
  return result.user;
}

// ─── Phone / OTP ─────────────────────────────────────────────────────────────

export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
  });
}

export async function sendOtp(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
}

export async function verifyOtp(
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<User> {
  const credential = await confirmationResult.confirm(otp);
  await upsertUserDoc(credential.user);
  return credential.user;
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function logOut(): Promise<void> {
  await signOut(auth);
}

// ─── Auth State Observer ──────────────────────────────────────────────────────

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── Upsert User Document in Firestore ───────────────────────────────────────

async function upsertUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName ?? 'Family Member',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      familyId: null,
      role: null,
      storageUsedBytes: 0,
      createdAt: serverTimestamp(),
      fcmTokens: [],
    });
  }
}
