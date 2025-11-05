// src/contexts/AuthContext.tsx
'use client'

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthUser, AuthUser } from '../hooks/useAuthUser';
import { User } from 'firebase/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<User>;
  signUpEmail: (email: string, password: string, username: string) => Promise<User>;
  signInGoogle: () => Promise<User>;
  signInMicrosoft: () => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuthUser();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};