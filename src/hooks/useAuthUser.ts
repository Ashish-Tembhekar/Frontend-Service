// src/hooks/useAuthUser.ts
"use client"; // This hook must be a client component as it uses browser APIs (Firebase Client SDK)

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Import the auth instance and providers from your Firebase configuration file
// Assumes the config file exports these correctly (Step 1 & 4 from previous response)
import { auth, googleProvider, microsoftProvider, db } from '../lib/firebase/config';

// --- Type Definitions ---

export interface AuthUser {
  uid: string;
  email: string | null;
  username: string | null;
  // Add other user profile data here if needed (e.g., displayName, photoURL)
}

interface AuthHook {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<User>;
  signUpEmail: (email: string, password: string, username: string) => Promise<User>;
  signInGoogle: () => Promise<User>;
  signInMicrosoft: () => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
}

// --- Main Hook Implementation ---

export function useAuthUser(): AuthHook {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Effect to subscribe to the Firebase Auth state change event.
   * This is the core listener that updates the `user` state globally.
   */
  useEffect(() => {
    // The onAuthStateChanged listener runs when the component mounts, and whenever
    // the user signs in, signs out, or their token refreshes.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        // Fetch username from Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          let username = null;
          if (userDocSnap.exists()) {
            username = userDocSnap.data()?.username || null;
          }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: username,
          });
        } catch (error) {
          console.error('Error fetching user data from Firestore:', error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: null,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  // --- Authentication Actions (Memoized with useCallback) ---
  
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // User state is updated automatically by the onAuthStateChanged listener
    return result.user; 
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, username: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Save username to Firestore
    try {
      const userDocRef = doc(db, 'users', result.user.uid);
      await setDoc(userDocRef, {
        username: username,
        email: email,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving user data to Firestore:', error);
      // Continue even if Firestore save fails
    }

    // User state is updated automatically by the onAuthStateChanged listener
    return result.user;
  }, []);

  const signInGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    // User state is updated automatically by the onAuthStateChanged listener
    return result.user;
  }, []);

  const signInMicrosoft = useCallback(async () => {
    const result = await signInWithPopup(auth, microsoftProvider);
    // User state is updated automatically by the onAuthStateChanged listener
    return result.user;
  }, []);
  
  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  // --- Return Exposed State and Actions ---
  
  return {
    user,
    loading,
    signOut,
    signInEmail,
    signUpEmail,
    signInGoogle,
    signInMicrosoft,
    resetPassword,
  };
}