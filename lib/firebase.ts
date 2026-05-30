import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Initialize Firebase only on the client side
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return app;
};

const getFirebaseAuth = (): Auth => {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
};

const getFirebaseDb = (): Firestore => {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
};

const getFirebaseStorage = (): FirebaseStorage => {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
};

// Lazy getters - safe for both client and server imports
// On server, these will only throw if actually *called*, not on import
export { getFirebaseAuth as getAuth, getFirebaseDb as getDb, getFirebaseStorage as getStorage };

// For backward-compat: direct exports that initialize on first access
// These are safe because all pages that use them are 'use client'
export const getFirebaseInstances = () => ({
  app: getFirebaseApp(),
  auth: getFirebaseAuth(),
  db: getFirebaseDb(),
  storage: getFirebaseStorage(),
});

// Direct exports for client components (all consumers are 'use client')
if (typeof window !== 'undefined') {
  app = getFirebaseApp();
  auth = getFirebaseAuth();
  db = getFirebaseDb();
  storage = getFirebaseStorage();
}

export { app, auth, db, storage };
