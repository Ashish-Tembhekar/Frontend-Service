// src/lib/firebase/config.ts

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider     // Import Google Provider
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration (using NEXT_PUBLIC_ env vars)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase for Client Side
// This prevents initializing the app multiple times in development (Next.js HMR)
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export auth instance for use in our context/hooks
export const auth = getAuth(firebaseApp);

// Export Firestore instance for user data storage
export const db = getFirestore(firebaseApp);

// Export Providers
export const googleProvider = new GoogleAuthProvider();