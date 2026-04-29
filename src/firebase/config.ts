import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, PhoneAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCSBcUxynTbwjarSvFk3_Rz2spYPGNVfz4",
  authDomain: "famvault-dd2a1.firebaseapp.com",
  projectId: "famvault-dd2a1",
  storageBucket: "famvault-dd2a1.firebasestorage.app",
  messagingSenderId: "946254449780",
  appId: "1:946254449780:web:0346a81f983ac8c7c75521",
  measurementId: "G-JQQ7HG4B13"
};

// Check if we have real Firebase credentials (not the demo placeholders)
export const isFirebaseConfigured =
  !!firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('DEMO') &&
  !firebaseConfig.apiKey.includes('placeholder');

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

export const phoneProvider = new PhoneAuthProvider(auth);

export default app;
