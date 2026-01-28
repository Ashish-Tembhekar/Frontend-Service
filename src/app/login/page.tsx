// src/app/login/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/Auth/LoginForm';
import { ForgotPasswordModal } from '@/components/Auth/ForgotPasswordModal';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to the appropriate page
  useEffect(() => {
    if (!loading && user) {
      if (user.isApproved) {
        router.push('/');
      } else {
        router.push('/pending-approval');
      }
    }
  }, [user, loading, router]);

  // Show a full screen spinner while loading to prevent flash of unauthenticated content
  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-700">Loading user session...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <LoginForm onForgotPassword={() => setIsModalOpen(true)} />
      <ForgotPasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}